
const qs = require('qs');
//Body sample from API explorer examples
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
}

context.data.bodySent = body

try {

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `https://quickbooks.api.intuit.com/v3/company/${context.companyId}/invoice?minorversion=40`,
    headers: { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json',
      'Authorization': `Bearer ${context.refreshed.access_token}`
    },
    data : body
  };

  let response = await axios(config)

  response = response.data


  context.data.apiresponseinv = response
} catch(err) {
  context.data.apierrorinv =err
  context.data.invoiceCreateError = err.message
}




