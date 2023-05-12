import {ApplitoolsMergeHelper} from './applitoolsMergeHelper'

(async function testCompareAndMergeBranches(){
    const applitoolsMergeHelper = new ApplitoolsMergeHelper(process.env.APPLITOOLS_API_KEY, process.env.APPLITOOLS_TEAM_ID, "http://eyes.applitools.com", true);
    await applitoolsMergeHelper.mergeBranches(process.env.Environment, process.env.APPLITOOLS_MERGE_TARGET_BRANCH_NAME, true);

    if(applitoolsMergeHelper.isConflictDetected){
        console.log('Baseline Conflict Detected! Please use the Applitools Compare & Merge Dashboard to resolve!');
    }else if(applitoolsMergeHelper.isChangeDetected){
        console.log('Baseline changes detected, but it is safe to merge. (No conflict detected.) Merging branches...');
        await applitoolsMergeHelper.mergeBranches(process.env.Environment, process.env.APPLITOOLS_MERGE_TARGET_BRANCH_NAME, false);
    }
})();
