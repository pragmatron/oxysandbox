const axios = require('axios');
const qs = require('qs');

// Save body structure
const body = {
  "DocNumber": context.payload.name,
  "Line": context.payload.lines,
  "CustomerRef": {
    "value": context.customer.Id
  },
  "DueDate": context.payload.dueDate || '',
  "TxnDate": context.payload.TxnDate,
  "SalesTermRef": {
    "value": context.customerTerms ? context.customerTerms : ''
  }
};

context.data.bodySent = body;

try {
  // 1. Get existing invoice to retrieve SyncToken
  const getUrl = `https://quickbooks.api.intuit.com/v3/company/${context.companyId}/invoice/${context.payload.invoiceId}?minorversion=40`;

  const getResponse = await axios({
    method: 'get',
    url: getUrl,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${context.refreshed.access_token}`
    }
  });

  const existingInvoice = getResponse.data.Invoice;

  // 2. Add Id and SyncToken to the update body
  body.Id = existingInvoice.Id;
  body.SyncToken = existingInvoice.SyncToken;

  // Optional: copy unchanged fields if necessary (e.g., currency, exchange rate)
  // body.CurrencyRef = existingInvoice.CurrencyRef;

  // 3. Send update request
  const updateUrl = `https://quickbooks.api.intuit.com/v3/company/${context.companyId}/invoice?minorversion=40`;

  const updateResponse = await axios({
    method: 'post',
    url: updateUrl,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${context.refreshed.access_token}`
    },
    data: body
  });

  context.data.apiresponseinv = updateResponse.data;

} catch (err) {
  context.data.apierrorinv = err;
  context.data.invoiceCreateError = err.message;
}