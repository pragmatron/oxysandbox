return async (rowData, batch) => {
    $setGlobalModel('sendingToQb', true);

    // Get lines
    let lines = $getGrid('aRInvoiceLines').filter(line => {
        return line.invoice == rowData.rowKey
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
            taxCode = "";
        }

        // Construct the primary line
        const primaryLine = {
            "Description": `${l.name}` + (l.description && l.description !== null ? `-${l.description}` : ''),
            "DetailType": "SalesItemLineDetail",
            "SalesItemLineDetail": {
                "TaxCodeRef": {"value": taxCode},
                "Qty": l.quantity,
                "UnitPrice": l.unitPrice,
                "ItemRef": {"name": l.$part$display}
            },
            "LineNum": (idx * 2) + 1,
            "Amount": l.extendedAmount
        };

        return primaryLine
    }).flat(); // Flatten the array of arrays into a single array

    console.log('lines are', lines);

    let payload = {
        name: rowData.name,
        dueDate: moment(rowData.dueDate).format('YYYY-MM-DD'),
        lines,
        TxnDate: moment(rowData.invoiceDate).format('YYYY-MM-DD'),
        customerName: rowData.$soldToCustomer$display,
        // trackingNum: rowData.salesOrder ? rowData.$salesOrder$display : '',
        terms: rowData.terms ? rowData.$terms$display : '',
        email: rowData.$soldToCustomer.emailAccount,
        customerPhone: rowData.$soldToCustomer.phoneNumber,
        invoiceId: rowData.quickbooksInvoiceID
    };

    console.log(payload);

    let d = await this.$wfGetData('-NtLsue_WP0rzbJohsab', payload);
    $setGlobalModel('sendingToQb', false);

    console.log(`Result for ${rowData.name} is: `, d);

    if(batch) {
         if (d.customerMissing) {
            console.error('Customer not found. Please assign a customer whose name matches a customer in QuickBooks');
            $setGlobalModel('sendingToQb', false);
        } else if (d.foundMissingItems) {
            console.error('Line Product not found. Please assign a line product to each line whose name matches a product in QuickBooks');
            $setGlobalModel('sendingToQb', false);
        } else if (d.invoiceCreateError) {
            console.error('Error creating an invoice, see the console for more info.');
            $setGlobalModel('sendingToQb', false);
        } else {
            let doc = d.apiresponseinv.Invoice.Id;

            if(rowData.quickbooksInvoiceID) {
                console.log('Invoice Updated - ' + doc);
            } else {
                console.log('Invoice Created - ' + doc);

            }
            
            if(doc) {
                $dgSetRowVals('aRInvoices', rowData.rowKey, {
                    quickbooksInvoiceID: doc || null
                })
                
            }

            $setGlobalModel('sendingToQb', false);

        
        }
        
        return
    }

    if (d.customerMissing) {
        alert('Customer not found. Please assign a customer whose name matches a customer in QuickBooks');
        $setGlobalModel('sendingToQb', false);
    } else if (d.foundMissingItems) {
        alert('Line Product not found. Please assign a line product to each line whose name matches a product in QuickBooks');
        $setGlobalModel('sendingToQb', false);
    } else if (d.invoiceCreateError) {
        alert('Error creating an invoice, see the console for more info.');
        $setGlobalModel('sendingToQb', false);
    } else {
        let doc = d.apiresponseinv.Invoice.Id;

        if(rowData.quickbooksInvoiceID) {
             alert('Invoice Updated - ' + doc);
        } else {
             alert('Invoice Created - ' + doc);

        }
        
        if(doc) {
            $dgSetRowVals('aRInvoices', rowData.rowKey, {
                quickbooksInvoiceID: doc || null
            })
            
        }

        $setGlobalModel('sendingToQb', false);

       
    }
}





