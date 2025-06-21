async function updatePurchaseLines(rowData) {
    $setGlobalModel('sendingPOToQb', true);

    if(!rowData.quickbooksID) {
        alert('Quickbooks Purchase Order ID required to update the Purchase Order')
        $setGlobalModel('sendingPOToQb', false);
        return
    }

    console.log('sending to qb', rowData)
    let deposit = 0
    let purchaseLines = $getGrid('purchaseLines')


    // Get lines
    let lines = purchaseLines.filter(line => {
        return line.purchaseOrder == rowData.rowKey //&& !line.description?.includes('DEPOSIT')
    }).flatMap((l, idx) => {
        let taxCode = "3"; // Default tax code

        // E
        if (l.taxCategory === '-Np_Vpp_-cetPgx3oDMl') {
            taxCode = "3";
        }
        // G
        if (l.taxCategory === '-Np_VmqR7yJBF9EtTsJj') {
            taxCode = "2";
        }
        // No tax?
        if (l.taxCategory === '-Ndjjx0GJp7RBCfyNzc7' || !l.taxCategory) {
            taxCode = "NON";
        }

                let itemRef = {"name": 'Expenses', "value": ""}

        // Construct the primary line
        const primaryLine = {
            "Description": `${l.$part$display}${l.description ? '-' : ''}${l.description ? l.description : ''}`,
            "DetailType": "ItemBasedExpenseLineDetail",
            "ItemBasedExpenseLineDetail": {
                "TaxCodeRef": {"value": taxCode},
                "Qty": l.quantity,
                "UnitPrice": l.unitPrice,
                "ItemRef": itemRef,
                // "AccountRef": {
                //     "value": "456",
                // }
            },
            "LineNum": (idx * 2) + 1,
            "Amount": l.totalLinePrice
        };

        return [primaryLine];

    }).flat(); // Flatten the array of arrays into a single array

    console.log('lines are', lines);

    let payload = {
        name: rowData.name,
        date: moment(rowData.date).format('YYYY-MM-DD'),
        lines,
        vendorName: rowData.$vendor$display ? rowData.$vendor$display.trim() : '',
        terms: rowData.$terms$display || '',
        vendorEmail: rowData.$vendor?.email ? rowData.$vendor?.email : null,
        vendorPhone: rowData.$vendor?.phone ? rowData.$vendor?.phone : null,
        purchasingPhone: rowData.purchasingPhone ? rowData.purchasingPhone : null,
        purchasingAddress1: rowData.$vendor?.purchasingAddress1 ? rowData.$vendor?.purchasingAddress1.trim() : '',
        purchasingCity: rowData.$vendor?.purchasingCity ? rowData.$vendor?.purchasingCity.trim() : '',
        purchasingState: rowData.$vendor?.purchasingState ? rowData.$vendor?.purchasingState.trim() : '',
        purchasingZipCode: rowData.$vendor?.purchasingZipCode ? rowData.$vendor?.purchasingZipCode.trim() : '',
        shippingAddress1: rowData.$vendor?.shippingAddress1 ? rowData.$vendor?.shippingAddress1.trim() : '',
        shippingCity: rowData.$vendor?.shippingCity ? rowData.$vendor?.shippingCity.trim() : '',
        shippingState: rowData.$vendor?.shippingState ? rowData.$vendor?.shippingState.trim() : '',
        shippingZipCode: rowData.$vendor?.shippingZipCode ? rowData.$vendor?.shippingZipCode.trim() : '',
        shippingCountry: rowData.$vendor?.shippingCountry ? rowData.$vendor?.shippingCountry.trim() : '',
        purchaseOrderId: rowData.quickbooksID
    };

    console.log('payload: ', payload)

    let updated = await $vm.$wfGetData('-OSO1Lh8JuAfeJSGmyvi', payload)

    console.log('updated', updated)

    if (updated.errorMessage) {
        // something went wrong on the server
        alert(`❌ Failed to update PO: ${updated.errorMessage}`);
    }
    else if (updated?.apiresponsepo?.PurchaseOrder?.Id) {
        alert('✅ Purchase Order updated successfully');
    }
    else {
        // fallback—shouldn't happen, but good to guard
        alert('❌ Unexpected response from server');
    }

    $setGlobalModel('sendingPOToQb', false);

}

window.updatePurchaseLines = updatePurchaseLines