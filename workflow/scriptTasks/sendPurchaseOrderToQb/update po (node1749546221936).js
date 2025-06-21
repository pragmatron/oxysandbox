const axios = require('axios');

try {
  // 1) Fetch the existing PO to get its SyncToken
  const getConfig = {
    method: 'get',
    url: `https://quickbooks.api.intuit.com/v3/company/${context.companyId}/purchaseorder/${context.payload.purchaseOrderId}?minorversion=40`,
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${context.refreshed.access_token}`
    }
  };
  const fetchResponse = await axios(getConfig);
  const poData = fetchResponse.data.PurchaseOrder;
  const syncToken = poData.SyncToken;

  context.data.latestPO = poData;
  context.data.syncToken = syncToken;

  // 2) Build your sparse update payload
  const body = {
    Id: context.payload.purchaseOrderId,
    SyncToken: syncToken,  // required
    sparse: true,          // only send fields you’re changing
    DocNumber: context.payload.name,
    Line: context.payload.lines,
    VendorRef: { value: context.vendor?.Id || '' },
    TxnDate: context.payload.date,
    // APAccountRef: { name: "Accounts Payable (A/P)", value: "22" },
    ShipAddr: {
      Line1: context.payload.shippingAddress1,
      City: context.payload.shippingCity,
      CountrySubDivisionCode: context.payload.shippingState,
      PostalCode: context.payload.shippingZipCode,
      Country: context.payload.shippingCountry || 'USA'
    }
  };

  context.data.bodySent = body;

  // 3) Send the update request
  const updateConfig = {
    method: 'post',
    url: `https://quickbooks.api.intuit.com/v3/company/${context.companyId}/purchaseorder?minorversion=40`,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${context.refreshed.access_token}`
    },
    data: body
  };
  const updateResponse = await axios(updateConfig);
  context.data.apiresponsepo = updateResponse.data;

} catch (err) {
  // default to the JS Error.message
  let message = err.message;

  // if QuickBooks returned a structured Fault, grab its first error message
  if (err.response?.data?.Fault?.Error?.length) {
    message = err.response.data.Fault.Error[0].Message;
  }

  context.data.errorMessage = message;
}