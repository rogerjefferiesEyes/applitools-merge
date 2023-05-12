import {ApplitoolsMergeHelper} from './applitoolsMergeHelper'

(async function compareAndMergeBranches(){
    const applitoolsMergeHelper = new ApplitoolsMergeHelper(process.env.APPLITOOLS_API_KEY, process.env.APPLITOOLS_TEAM_ID);
    if(process.env.Environment == process.env.APPLITOOLS_MERGE_TARGET_BRANCH_NAME){
        console.log(`Branch Name and Baseline Branch Name are the same (${process.env.Environment})! Skipping merge...`);
        return;
    }
    await applitoolsMergeHelper.mergeBranches(
        process.env.Environment, 
        process.env.APPLITOOLS_MERGE_TARGET_BRANCH_NAME, 
        false
    );
})();
