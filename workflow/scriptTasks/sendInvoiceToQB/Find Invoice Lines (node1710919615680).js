if (context.err) return;

if (context.payload.lines && context.payload.lines.length) {
  const lines = context.payload.lines;

  // 1) Preload the “Service” item’s Id
  let serviceItemId;
  try {
    const serviceConfig = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://quickbooks.api.intuit.com/v3/company/${context.companyId}/query?query=select * from Item WHERE FullyQualifiedName = 'Service'`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${context.refreshed.access_token}`
      }
    };
    const svcResp = await axios(serviceConfig);
    const svcItems = svcResp.data?.QueryResponse?.Item;
    if (svcItems && svcItems.length > 0) {
      serviceItemId = svcItems[0].Id;
    } else {
      throw new Error("‘Service’ item not found in QuickBooks");
    }
  } catch (err) {
    // if Service lookup fails, capture and bail out (or handle as you see fit)
    context.data.apierror = err.message;
    return;
  }

  // 2) Process each line, falling back to serviceItemId when needed
  for (let i = 0; i < lines.length; i++) {
    try {
      const name = lines[i].SalesItemLineDetail.ItemRef.name;
      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://quickbooks.api.intuit.com/v3/company/${context.companyId}/query?query=select * from Item WHERE FullyQualifiedName = '${name}'`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${context.refreshed.access_token}`
        }
      };

      const resp = await axios(config);
      const items = resp.data?.QueryResponse?.Item;

      if (items && items.length > 0) {
        // Found the exact item
        lines[i].SalesItemLineDetail.ItemRef.value = items[0].Id;
      } else {
        // Fallback to “Service”
        lines[i].SalesItemLineDetail.ItemRef.value = serviceItemId;
      }

    } catch (err) {
      context.data.apierror = err.message;
      // optionally continue to next line or break, as desired
    }
  }

  context.data.linesModified = lines;
}