const axios = require('axios');

const accessToken = context.accessToken;
const accountId = '3968308'; // Replace with your account ID
const endpoints = context.payload.endpoints || [];
const rowKey = context.payload.rowKey;

const countUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;

for (let endpoint of endpoints) {
  const tableID = endpoint.tableID;
  if (!tableID) {
    console.warn('❗ Missing tableID in endpoint:', endpoint);
    continue;
  }

  const countQuery = `SELECT COUNT(*) AS total FROM ${tableID}`;

  try { 
    if(!endpoint.count && !endpoint.doNotInclude) {
      const countResponse = await axios.post(countUrl, { q: countQuery }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'transient'
        },
      });

      const countRetrieved = countResponse.data?.items?.[0]?.total || 0;
      console.log(`✅ Retrieved count for ${tableID}: ${countRetrieved}`);

      await createLog(
        callDash,                 // Workspace ID
        '',                       // User ID or leave empty
        countRetrieved,           // Count value
        'netSuiteTables',         // Grid/Table name
        endpoint.rowKey,                   // Row key
        'count'                   // Cell key (use tableID as key for each table's count)
      );
    }

  } catch (err) {
    console.error(`❌ Failed to fetch count for ${tableID}:`, err.response?.data || err.message);
    await createLog(
      callDash,
      '',
      'ERROR',
      'netSuiteTables',
        endpoint.rowKey,                   // Row key
        'error'  
    );
  }
}