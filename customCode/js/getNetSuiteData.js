async function getNetSuiteData(rowData) {
    
    $setGlobalModel('gettingNetSuiteData', true)

    console.log('retrieving data for endpoint: ', rowData.name)
    let payload = {
        endpoint: rowData.endpoint,
        rowKey: rowData.rowKey,
        maxSize: rowData.maxAmount,
        skipFirst: rowData.skip,
        fieldsToPull: rowData.fieldsToPull,
        orderBy: rowData.orderBy
    }

    let result = await $vm.$wfGetData('-OMfsWZSC1VPTZF0pg0Z', payload)
    console.log('result is: ', result)
    if(result.numberOfRetrievedRecords) {
        $dgSetRowVals('extractNetSuiteData', rowData.rowKey, {
            numberOfRetrievedRecords: result.numberOfRetrievedRecords
        })

        alert('finished retrieving the records')
            $setGlobalModel('gettingNetSuiteData', false)

    } else {


   
         $setGlobalModel('gettingNetSuiteData', false)
        alert('something went wrong retrieving the errors check console')
    }
    

}

window.getNetSuiteData = getNetSuiteData