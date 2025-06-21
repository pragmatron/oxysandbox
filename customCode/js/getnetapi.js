async function getnetapi() {

    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');

    let payload = {}
    if(codeFromUrl) {
        let codeVerifier = $getDashboardModel('oAuth2')['-OMfmDqCbjIsec9iVbzf'].codeverifier
        payload = {
            code: codeFromUrl || '',
            codeVerifier: codeVerifier || ''
        };
    }


    // payload = {}
    let d = await $vm.$wfGetData('-OMMxHgXye95ICvKRna-', payload)

    console.log('got :' , d)

    if(d.codeVerifier && d.url) {
        $dgSetRowVals('oAuth2', '-OMfmDqCbjIsec9iVbzf', {
            codeverifier: d.codeVerifier
        })

        window.open(d.url, '_blank');
    }
}

// const urlParams = new URLSearchParams(window.location.search);
// const codeFromUrl = urlParams.get('code');

// if(codeFromUrl) {
//     getnetapi()
// }

window.getnetapi = getnetapi