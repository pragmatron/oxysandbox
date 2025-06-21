const axios = require('axios');
const XLSX = require('xlsx');

const accessToken = context.accessToken;
const accountId = '3968308'; // Replace with your account ID
let offset = context.payload.skipFirst || 0;  // Using offset for pagination
const limit = 1000; // Number of records per call
let aggregatedData = [];
let retrievedData = [];
const maxSize = context.payload.maxSize; // Optional: max number of records to retrieve

// First, get the total count of records from the endpoint specified
const countQuery = `SELECT COUNT(*) AS total FROM ${context.payload.endpoint}`;
const countUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;

let totalRecords = 0;
try {
  const countResponse = await axios.post(countUrl, { q: countQuery }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'transient'
    },
  });

  // Assuming the response structure contains an items property:
  totalRecords = countResponse.data?.items && countResponse.data.items[0]?.total;
  console.log(`Total number of records in ${context.payload.endpoint}: ${totalRecords}`);
  context.data.totalRecords = totalRecords;

} catch (err) {
  console.error('Failed to fetch record count:', err.response?.data || err.message);
  context.error = 'Failed to retrieve record count';
}

// Now retrieve the actual data using the count as a stoppage condition.
try {
  // Loop until our offset reaches or exceeds the total number of records.
  do {
    // Construct the SuiteQL query using Oracle's OFFSET/FETCH syntax with an ORDER BY clause.
    // Replace 'id' with the appropriate unique field if necessary.
    let query = `SELECT * FROM ${context.payload.endpoint}`;
    if(context.payload.orderBy) {
      query += ` ORDER BY ${context.payload.orderBy}`
    }
    context.data.query = query
    console.log(`Executing SuiteQL query: ${query}`);
    
    // SuiteQL uses a POST endpoint.
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${limit}&offset=${offset}`;
    const response = await axios.post(url, { q: query }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'transient'
      },
    });
    
    // Use the items property if present, otherwise default to an empty array.
    retrievedData = response.data?.items || [];
    
    aggregatedData = aggregatedData.concat(retrievedData);
    
    // If maxSize is set and reached, break out of the loop (and slice to maxSize)
    if (maxSize && aggregatedData.length >= maxSize) {
      aggregatedData = aggregatedData.slice(0, maxSize);
      break;
    }
    
    // Increment the offset for the next batch.
    offset += limit;
  } while (offset < totalRecords && retrievedData.length > 0);
  
  console.log(`Total records retrieved: ${aggregatedData.length}`);
  
  // Convert aggregated data into an Excel workbook.
  const worksheet = XLSX.utils.json_to_sheet(aggregatedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  // Generate Excel file as a buffer.
  const excelBinaryData = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  
  // Upload the Excel file to your app's file field.
  await uploadFilesToRecord({
    workspaceId: callDash,             // Workspace id for your app.
    gridId: 'extractNetSuiteData',     // Dashboard or grid id.
    rowKey: context.payload.rowKey,    // Record row key.
    cellKey: 'downloadedData',         // File field key.
    files: [{
      name: `${context.payload.endpoint}-${Date.now()}.xlsx`,  // Filename with a timestamp.
      data: excelBinaryData                  // Excel file data as a Buffer.
    }]
  });
  
  context.data.numberOfRetrievedRecords = aggregatedData.length;
  console.log('✅ Data exported and uploaded successfully');
  
} catch (err) {
  console.error('❌ Failed to fetch data:', err.response?.data || err.message);
  context.error = 'Failed to retrieve data';
}