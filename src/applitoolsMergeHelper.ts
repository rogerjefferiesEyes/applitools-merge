const axios = require('axios');

/**
 * Helper class, for performing Applitools Eyes branch merge operations using the REST API.
 */
export class ApplitoolsMergeHelper {

    applitoolsServerUrl:string = 'https://eyes.applitools.com';
    applitoolsOrgId = ''
    isConflictDetected = false;
    isChangeDetected = false;
    isDebug:boolean = false;
    
    config = {
        headers : { 
            'X-Eyes-Api-Key': '', 
            'Content-Type': 'application/json'
        }
    }

    /**
     * @param  {string} apiKey Applitools API Key
     * @param  {string} orgId Applitools Team/Org ID
     * @param  {string} serverUrl Applitools Server Url (Optional)
     * @param  {boolean} isDebug Enable/disable debugging output. (Optional. Default: false.)
     */
    constructor(apiKey:string, orgId:string, serverUrl?: string, isDebug?: boolean) {
        if(isDebug != undefined){
            this.isDebug = isDebug;
        }
        if(serverUrl){
            if(this.validateUrl(serverUrl)){
                this.applitoolsServerUrl = serverUrl;
            } else {
                console.log(`WARNING - Invalid value supplied for Applitools Server URL: ${serverUrl}. Using default Server URL: https://eyes.applitools.com.`)
            }
        }
        this.applitoolsOrgId = orgId;
        this.config.headers['X-Eyes-Api-Key'] = apiKey;
    }

    /**
     * Compare branches, and optionally merge source branch baselines into target branch.
     * @param  {String} sourceBranch Applitools branch to use as source for compare and merge actions
     * @param  {String} targetBranch Applitools branch to use as target for compare and merge actions
     * @param  {Boolean} compareOnly Compare branches without merging?
     */
    async mergeBranches(sourceBranch: String, targetBranch: String, compareOnly:Boolean): Promise<void> {
        this.isConflictDetected = false;
        this.isChangeDetected = true;
        var mergeUrl = `${this.applitoolsServerUrl}/api/baselines/branches/merge?accountId=${this.applitoolsOrgId}`
        var mergeRequestData  = JSON.stringify({
            "sourceBranch": sourceBranch,
            "targetBranch": targetBranch,
            "context": "",
            "onlyCheck": true
        });

        let mergeResponse;
        var mergeResult;


        mergeResponse = await axios.post(mergeUrl, mergeRequestData, this.config);

        if(mergeResponse.status == 202){
            mergeResult = await this.getApplitoolsResult(mergeResponse.headers['location']);
        }

        console.log(`\n\nApplitools Merge Compare Result:\n${JSON.stringify(mergeResult.data['changes'])}\n\n`);

        this.isChangeDetected = (mergeResult.data.changes.length > 0);
        if(this.isChangeDetected){
            console.log(`WARNING: ${mergeResult.data.changes.length} Change(s) detected between branches [${targetBranch}] <- [${sourceBranch}]!`)
            this.isConflictDetected = (mergeResult.data.conflicts > 0);
            if(this.isConflictDetected){
                console.log(`WARNING: ${await mergeResult.data.conflicts} Conflict(s) detected between branches [${targetBranch}] <- [${sourceBranch}]!`)
            }
            if(!compareOnly){
                let baselines = mergeResult.data.changes.map(({source: {id}, target: {state}}) => ({id, state}))
                console.log(`Merging Baselines:\n${JSON.stringify(baselines)}`)
                this.mergeBaselines(baselines);
                mergeRequestData  = JSON.stringify({
                    "sourceBranch": sourceBranch,
                    "targetBranch": targetBranch,
                    "context": "",
                    "onlyCheck": false
                });
                await axios.post(mergeUrl, mergeRequestData, this.config);
            }
        } else {
            console.log('No Baseline Change(s) detected. Nothing to merge.');
        }
    }

    /**
     * Merge the specified baseline id's/states, using the Applitools mergeActions API
     * @param  {Array} baselines Array of objects, each with a baseline id and state property representing a baseline to be merged.
     * @returns {Object} An object representing the final response from the Applitools mergeActions request.
     */
    async mergeBaselines(baselines){
        var mergeActionsUrl = `${this.applitoolsServerUrl}/api/baselines/mergeactions?accountId=${this.applitoolsOrgId}`
        var mergeActionsData  = { 
            updates: []
        };
        baselines.forEach(baseline => {
            mergeActionsData.updates.push({
                baselineId: baseline.id,
                merge: true,
                targetState: baseline.state
            })
        });

        console.log(`Merge Actions Request: \n${JSON.stringify(mergeActionsData)}`);
        console.log(`Debug?: ${this.isDebug}`);
        console.log(`Merging...`);

        if(this.isDebug === true){
            axios.interceptors.request.use(request => {
                // Strip out circular references in request object, while converting to JSON
                let cache = [];
                let requestBody = JSON.stringify(request, function(key, value) {
                    if (typeof value === "object" && value !== null) {
                      if (cache.indexOf(value) !== -1) {
                        // Circular reference found, discard key
                        return;
                      }
                      // Store value in our collection
                      cache.push(value);
                    }
                    return value;
                });
                console.log('Starting Request', requestBody)
                return request
            })
              
            axios.interceptors.response.use(response => {
                // Strip out circular references in response object, while converting to JSON
                let cache = [];
                let responseBody = JSON.stringify(response, function(key, value) {
                    if (typeof value === "object" && value !== null) {
                      if (cache.indexOf(value) !== -1) {
                        // Circular reference found, discard key
                        return;
                      }
                      // Store value in our collection
                      cache.push(value);
                    }
                    return value;
                });
                console.log('Response:', responseBody)
                return response
            })
        }

        await axios.post(mergeActionsUrl, mergeActionsData, Object.assign(this.config)).catch(
            function (error) {
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    console.log(error.response.data);
                    console.log(error.response.status);
                    console.log(error.response.headers);
                } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.log(error.request);
                } else {
                    // Something happened in setting up the request that triggered an Error
                    console.log('Error', error.message);
                }
                console.log(error.config);
          }
        );

    }

    /**
     * Poll and retrieve the final result response from an Applitools API Status URL.
     * @param  {String} statusUrl Status URL returned from an asynchronous or long-running Applitools API Operation.
     * @returns {Object} An object representing the final result response from the Applitools API Operation.
     */
    async getApplitoolsResult(statusUrl: String) : Promise<Object> {
        let resultUrl = '';
        var pollWaitMs = 1000;
        var maxPollCount = 10;
        var statusResponse;
        var resultResponse;

        statusUrl = `${statusUrl}?ordId=${this.applitoolsOrgId}`;

        for (var i = 0; i < maxPollCount; i++) {
            await new Promise(r => {
                console.log(`Sleeping for ${pollWaitMs} milliseconds before next status request (${i})...`);
                setTimeout(r, pollWaitMs)
            });

            statusResponse = await axios.get(statusUrl, this.config);

            if (statusResponse.status == 201 || statusResponse.status == 200) {
                resultUrl = `${statusResponse.headers['location']}?ordId=${this.applitoolsOrgId}`
                resultResponse = await axios.get(resultUrl, this.config);
                break;
            }       
        }

        return resultResponse;
    }

    /**
     * Validate that the supplied string value is a valid URL.
     * @param value String value to check.
     * @returns true if string is a valid URL, false if invalid.
     */
    validateUrl(value:string) {
        return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(value);
    }
    
}