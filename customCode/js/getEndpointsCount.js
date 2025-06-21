async function getEndpointsCount() {
    console.log('getting endpoints count')
    let endpoints = $getGrid('netSuiteTables')

    let payload = {
        endpoints,
    }

    let result = await $vm.$wfGetData('-ONJd0OIWeL2lGfdD7Ua', payload)

    console.log('result: ', result)
}

window.getEndpointsCount = getEndpointsCount
