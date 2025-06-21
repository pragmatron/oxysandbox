<template>
  <div class="truecommerce-extractor">
    <h4 class="extractor-title">TrueCommerce Bulk Transaction Extraction</h4>
    <p class="extractor-description mb-3">
      This tool will extract multiple transactions from TrueCommerce, checking for duplicates.
    </p>
    
    <div class="settings-panel mb-3">
      <b-form-group label="Maximum transactions to process:">
        <b-form-input v-model="maxTransactions" type="number" min="1" max="50"></b-form-input>
        <small class="text-muted">Recommended: 5 (higher values may cause timeouts)</small>
      </b-form-group>
    </div>
    
    <b-button 
      @click="runExtraction" 
      variant="primary" 
      size="lg"
      :disabled="extractionInProgress"
      class="extraction-button"
    >
      {{extractionInProgress ? 'Extraction in progress...' : 'Extract TrueCommerce Data'}}
    </b-button>
    
    <div v-if="extractionResult" class="mt-3">
      <b-alert :variant="extractionResult.success ? 'success' : 'danger'" show>
        {{extractionResult.success ? extractionResult.message || 'Extraction completed!' : 'Extraction failed: ' + extractionResult.error}}
      </b-alert>
    </div>
    
    <div v-if="extractionStats.processed > 0" class="mt-3">
      <b-card no-body>
        <b-card-header>
          <h5 class="mb-0">Extraction Results</h5>
        </b-card-header>
        <b-list-group flush>
          <b-list-group-item>Total transactions found: <b>{{extractionStats.total}}</b></b-list-group-item>
          <b-list-group-item>Already existing in Tangle: <b>{{extractionStats.skipped}}</b></b-list-group-item>
          <b-list-group-item>Newly processed: <b>{{extractionStats.processed}}</b></b-list-group-item>
          <b-list-group-item>Processing limit reached: <b>{{extractionStats.limitReached ? 'Yes' : 'No'}}</b></b-list-group-item>
        </b-list-group>
      </b-card>
    </div>
    
    <div v-if="extractionInProgress" class="mt-3">
      <b-progress :value="extractionProgress" :max="100" animated variant="info"></b-progress>
      <p class="text-center mt-2 text-muted">
        <small>{{extractionProgressMessage}}</small>
      </p>
    </div>
  </div>
</template>

<script>
module.exports = {
  name: 'TrueCommerceBulkExtractor',
  data() {
    return {
      extractionInProgress: false,
      extractionResult: null,
      maxTransactions: 5,
      currentTransactionIndex: 0,
      extractionStats: {
        total: 0,
        processed: 0,
        skipped: 0,
        limitReached: false
      },
      extractionProgress: 0,
      extractionProgressMessage: 'Preparing extraction...'
    }
  },
  methods: {
    async runExtraction() {
      this.extractionInProgress = true;
      this.extractionResult = null;
      this.extractionProgress = 0;
      this.extractionProgressMessage = 'Starting TrueCommerce extraction... (process may take a few minutes to complete)';
      
      // Reset stats
      this.extractionStats = {
        total: 0,
        processed: 0,
        skipped: 0,
        limitReached: false
      };
      
      console.log('Starting TrueCommerce bulk extraction...');
      
      try {
        // First, fetch existing PO numbers from Tangle to avoid duplicates
        const existingPONumbers = await this.fetchExistingPONumbers();
        console.log(`Found ${existingPONumbers.length} existing PO numbers in Tangle`);
        
        // Run the extraction process
        const result = await this.runTrueCommerceScript(existingPONumbers);
        this.extractionResult = result;
        
        if (result) {
          console.log('Extraction completed successfully!');
          // Update stats from the result
          if (result.stats) {
            this.extractionStats = result.stats;
          }
        } else {
          console.log(`Extraction failed`);
        }
      } catch (error) {
        this.extractionResult = { success: false, error: error.message };
        console.log(`Error during extraction: ${error.message}`);
      } finally {
        this.extractionInProgress = false;
      }
    },
    
    async fetchExistingPONumbers() {
      try {
        // Get all records from the opportunities table
        const opportunities = $getGrid('opportunities');
        
        // Extract PO numbers
        const poNumbers = opportunities
          .filter(opp => opp.pONumber) // Filter out records without PO numbers
          .map(opp => opp.pONumber.trim().toLowerCase()); // Normalize for comparison
          
        return poNumbers;
      } catch (error) {
        console.error('Error fetching existing PO numbers:', error);
        return [];
      }
    },
    
    async runTrueCommerceScript(existingPONumbers) {
      console.log('Preparing Puppeteer script for bulk extraction...', this.maxTransactions);
      
      // IMPORTANT CHANGE: We'll stringify the existingPONumbers array and include it directly in the userActions function
      // This ensures it's available in the Puppeteer environment
      console.log(existingPONumbers)
      const userActionsString = `
      async (page) => {
  // Define the existing PO numbers directly in the function
  const existingPONumbers = ${JSON.stringify(existingPONumbers)};
  const maxToProcess = ${parseInt(this.maxTransactions) || 20};
  
  // Function to ensure element is visible and clickable
  const waitForElementToBeReady = async (selector, timeout = 30000) => {
    console.log('Waiting for element to be ready: ' + selector);
    
    try {
      // First wait for the selector to exist in DOM
      await page.waitForSelector(selector, { timeout });
      
      // Then verify it's visible and has dimensions
      await page.waitForFunction((sel) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none' &&
               style.opacity !== '0';
      }, { timeout }, selector);
      
      console.log('Element is ready: ' + selector);
      return true;
    } catch (error) {
      console.log('Element not ready or not found: ' + selector + '. Error: ' + error.message);
      return false;
    }
  };
  
  // Safer click function with retries
  const safeClick = async (selector, options = {}) => {
    const { timeout = 30000, clickCount = 1, delay = 100 } = options;
    
    const isReady = await waitForElementToBeReady(selector, timeout);
    if (!isReady) {
      console.log('Could not safely click ' + selector + ' - element not ready');
      return false;
    }
    
    try {
      await page.click(selector, { clickCount, delay });
      console.log('Successfully clicked: ' + selector);
      return true;
    } catch (error) {
      console.log('Click failed on first attempt for ' + selector + '. Retrying...');
      // Add a small delay and try again
      await page.waitForTimeout(2000);
      try {
        await page.click(selector, { clickCount, delay });
        console.log('Successfully clicked on second attempt: ' + selector);
        return true;
      } catch (secondError) {
        console.log('Failed to click ' + selector + ' after multiple attempts: ' + secondError.message);
        return false;
      }
    }
  };
  
  // Function to extract transaction details once a transaction is open
  const extractTransactionDetails = async () => {
    // Define a reusable function for extracting data by field labels
    const extractDataByLabels = async (labelSelectors) => {
      try {
        return await page.evaluate((selectors) => {
          const result = {};
          
          // Helper function to get value by label text
          const getValueByLabel = (labelText) => {
            // Find all spans that might contain the label text
            const spans = Array.from(document.querySelectorAll('span'));
            const labelSpan = spans.find(span => span.textContent && span.textContent.trim() === labelText);
            if (!labelSpan) return '';
            
            // Navigate up to the field cell
            let fieldCell = labelSpan;
            while (fieldCell && (!fieldCell.hasAttribute('data-hj-test-id') || fieldCell.getAttribute('data-hj-test-id') !== 'field-cell')) {
              fieldCell = fieldCell.parentElement;
              if (!fieldCell) return '';
            }
            
            // Try different ways to get the value
            
            // Check for input
            const input = fieldCell.querySelector('input:not([type="hidden"])');
            if (input && input.value) return input.value;
            
            // Check for dropdown
            const dropdown = fieldCell.querySelector('.k-dropdown-wrap .k-input');
            if (dropdown) return dropdown.textContent.trim();
            
            // Check for datepicker
            const datepicker = fieldCell.querySelector('[data-role="datepicker"]');
            if (datepicker && datepicker.value) return datepicker.value;
            
            // Check for label with value
            const valueLabel = fieldCell.querySelector('tc-label span');
            if (valueLabel && valueLabel !== labelSpan) return valueLabel.textContent.trim();
            
            // Check for textarea
            const textarea = fieldCell.querySelector('textarea');
            if (textarea && textarea.value) return textarea.value;
            
            // Check for any other text content
            const controlContainer = fieldCell.querySelector('.control-container');
            if (controlContainer) {
              const text = controlContainer.textContent.trim();
              if (text && text !== labelText) return text;
            }
            
            return '';
          };
          
          const parseNumeric = (value) => {
            if (!value) return 0;
            const cleanedValue = value.replace(/[^\\d.-]/g, '');
            return parseFloat(cleanedValue) || 0;
          };
          
          // Extract each field based on the provided selectors
          for (const [key, config] of Object.entries(selectors)) {
            let value = getValueByLabel(config.label);
            if (config.isNumeric) value = parseNumeric(value);
            result[key] = value;
          }
          
          return result;
        }, labelSelectors);
      } catch (error) {
        console.log('Error extracting data by labels: ' + error.message);
        return {}; // Return empty object instead of failing
      }
    };
    
    try {
      // This will hold all our transaction data
      const transactionData = {
        main: {},
        items: [],
        shipping: {},
        terms: {},
        billTo: {},
        shipTo: {},
        misc: {}
      };
      
      // First extract data from the Main tab (which is open by default)
      console.log('Extracting data from Main tab...');
      transactionData.main = await extractDataByLabels({
        partnerName: { label: 'Partner Name' },
        type: { label: 'Type' },
        poNumber: { label: 'PO #' },
        documentNum: { label: 'Document Num' },
        poDate: { label: 'PO Date' },
        calculatedTotalAmount: { label: 'Calculated Total Amount', isNumeric: true }
      });
      
      // Click on Items tab to extract the items data
      console.log('Clicking Items tab to extract items data...');
      const itemsTabSelector = '.k-tabstrip-items li[aria-controls="tbsItems"]';
      const itemsTabReady = await waitForElementToBeReady(itemsTabSelector, 30000);
      
      if (itemsTabReady) {
        await safeClick(itemsTabSelector);
        
        // Wait for the Items tab content to load
        console.log('Waiting for Items tab content to load...');
        await page.waitForTimeout(3000);
        
        // Wait for the data grid to be visible and loaded
        const gridReady = await waitForElementToBeReady('#Loop_100Grid', 30000);
        
        if (gridReady) {
          // Extract the data rows using page.evaluate
          try {
            const items = await page.evaluate(() => {
              const results = [];
              
              // Helper function to safely parse numeric values
              const parseNumeric = (value) => {
                if (!value) return 0;
                const cleanedValue = value.replace(/[^\d.-]/g, '');
                return parseFloat(cleanedValue) || 0;
              };
              
              // First, get the header row and create a mapping of header names to column indices
              const headerCells = document.querySelectorAll('#Loop_100Grid thead th');
              const headerMap = {};
              
              headerCells.forEach((cell, index) => {
                // Get the header text from different possible elements
                let headerText = '';
                
                // Try data-title attribute first (most reliable)
                headerText = cell.getAttribute('data-title');
                
                // If data-title not available, try inner link text
                if (!headerText) {
                  const link = cell.querySelector('a.k-link');
                  if (link) headerText = link.textContent.trim();
                }
                
                // If still no text, try cell's own text content
                if (!headerText) {
                  headerText = cell.textContent.trim();
                }
                
                // Store the mapping (normalize by removing special characters and spaces)
                if (headerText) {
                  // Store both the original header and a normalized version for more flexible matching
                  headerMap[headerText] = index;
                  headerMap[headerText.toLowerCase().replace(/[^a-z0-9]/g, '')] = index;
                }
              });
              
              console.log('Header mapping created:', JSON.stringify(headerMap));
              
              // Define a function to get column index by header name (with fallbacks)
              const getColumnIndex = (headerNames) => {
                // Try each possible header name in order
                for (const name of headerNames) {
                  // Try exact match
                  if (headerMap[name] !== undefined) return headerMap[name];
                  
                  // Try normalized match
                  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (headerMap[normalized] !== undefined) return headerMap[normalized];
                }
                return -1; // Not found
              };
              
              // Get the index for each column we need (with fallback options)
              const upcIndex = getColumnIndex(['UPC #', 'UPC', 'UPC Number']);
              const buyersItemIndex = getColumnIndex(["Buyer's Item #", "Buyers Item #", "Buyer Item #"]);
              const upcCaseCodeIndex = getColumnIndex(['UPC Case Code', 'Case Code']);
              const descriptionIndex = getColumnIndex(['Description', 'Desc', 'Item Description']);
              const qtyIndex = getColumnIndex(['Qty']);
              const uomIndex = getColumnIndex(['UOM', 'Unit of Measure']);
              const priceIndex = getColumnIndex(['Price']);
              const innerPacksIndex = getColumnIndex(['# Inner Packs', 'Inner Packs']);
              const packSizeIndex = getColumnIndex(['Pack Size']);
              const packUOMIndex = getColumnIndex(['Pack UOM']);
              const palletBlockAndTiersIndex = getColumnIndex(['Pallet Block and Tiers', 'Pallet Block/Tiers']);
              const termsTypeIndex = getColumnIndex(['Terms Type']);
              const termsBasisIndex = getColumnIndex(['Terms Basis']);
              const discountIndex = getColumnIndex(['Discount %', 'Discount']);
              const discountDaysDueIndex = getColumnIndex(['Discount Days Due']);
              const dueDateIndex = getColumnIndex(['Due Date']);
              const netDaysDueIndex = getColumnIndex(['Net Days Due']);
              const freeGoodsAllowanceIndex = getColumnIndex(['Free Goods Allowance']);
              const nonPerformanceAllowanceIndex = getColumnIndex(['Non-Performance Allowance', 'Performance Allowance']);
              
              // Get all table rows from the grid
              const rows = document.querySelectorAll('#Loop_100Grid tbody tr');
              
              // Process each row
              rows.forEach((row, rowIndex) => {
                // Skip if this is not a data row or doesn't have cells
                if (!row.hasAttribute('data-uid') || row.cells.length < 3) return;
                
                // Helper function to safely get cell content by column name
                const getCellValue = (columnIndex, isNumeric = false) => {
                  if (columnIndex === -1 || !row.cells[columnIndex]) return isNumeric ? 0 : '';
                  const value = row.cells[columnIndex].textContent.trim();
                  return isNumeric ? parseNumeric(value) : value;
                };
                
                // Extract cell values using the mapped indices
                const item = {
                  uPC: getCellValue(upcIndex),
                  buyersItem: getCellValue(buyersItemIndex),
                  uPCCaseCode: getCellValue(upcCaseCodeIndex),
                  description: getCellValue(descriptionIndex),
                  quantity: getCellValue(qtyIndex),
                  uOM: getCellValue(uomIndex),
                  price: getCellValue(priceIndex),
                  innerPacks: getCellValue(innerPacksIndex),
                  packSize: getCellValue(packSizeIndex),
                  packUOM: getCellValue(packUOMIndex),
                  palletBlockAndTiers: getCellValue(palletBlockAndTiersIndex),
                  termsType: getCellValue(termsTypeIndex),
                  termsBasis: getCellValue(termsBasisIndex),
                  discount: getCellValue(discountIndex),
                  discountDaysDue: getCellValue(discountDaysDueIndex),
                  dueDate: getCellValue(dueDateIndex),
                  netDaysDue: getCellValue(netDaysDueIndex),
                  freeGoodsAllowance: getCellValue(freeGoodsAllowanceIndex),
                  nonPerformanceAllowance: getCellValue(nonPerformanceAllowanceIndex)
                };
                console.log('Item data is as follows ', item)
                
                // Calculate totals for convenience
                item.lineTotal = item.quantity * item.price;
                
                // Log data extraction for debugging (first few rows only)
                if (rowIndex < 2) {
                  console.log('Row ' + rowIndex + ' extracted:', JSON.stringify(item));
                }
                
                results.push(item);
              });
              
              return results;
            });
            
            // Add the items to the transaction data
            transactionData.items = items || [];
            console.log('transactionData', transactionData.items)
          } catch (error) {
            transactionData.items = []; // Ensure we have an empty array at minimum
          }
        }
      }
      
      // Click on Shipping tab to extract shipping info
      console.log('Clicking Shipping tab to extract shipping info...');
      const shippingTabSelector = '.k-tabstrip-items li[aria-controls="tbsShipping"]';
      
      if (await waitForElementToBeReady(shippingTabSelector, 30000)) {
        await safeClick(shippingTabSelector);
        await page.waitForTimeout(3000);
        
        // Extract data from Shipping tab
        console.log('Extracting data from Shipping tab...');
        transactionData.shipping = await extractDataByLabels({
          requestedDeliveryDate: { label: 'Requested Delivery' },
          shipDate: { label: 'Ship Date' },
          transportationMethod: { label: 'Transportation Method' },
          description: { label: 'Description' },
          quantityOrdered: { label: 'Quantity Ordered', isNumeric: true },
          weight: { label: 'Weight', isNumeric: true },
          volume: { label: 'Volume (CF)', isNumeric: true }
        });
      }
      
      // Click on Terms tab to extract terms info
      console.log('Clicking Terms tab to extract terms info...');
      const termsTabSelector = '.k-tabstrip-items li[aria-controls="tbsTerms"]';
      
      if (await waitForElementToBeReady(termsTabSelector, 30000)) {
        await safeClick(termsTabSelector);
        await page.waitForTimeout(3000);
        
        // Extract terms data
        console.log('Extracting data from Terms tab...');
        transactionData.terms = await extractDataByLabels({
          type: { label: 'Type' },
          basedOn: { label: 'Based On' },
          discount: { label: 'Discount %', isNumeric: true },
          discountDueDate: { label: 'Discount Due Date' },
          discountDaysDue: { label: 'Discount Days Due', isNumeric: true },
          dueDate: { label: 'Due Date' },
          netDaysDue: { label: 'Net Days Due', isNumeric: true }
        });
      }
      
      // Click on Addresses tab to extract address info
      console.log('Clicking Addresses tab to extract address info...');
      const addressesTabSelector = '.k-tabstrip-items li[aria-controls="tbsAddresses"]';
      
      if (await waitForElementToBeReady(addressesTabSelector, 30000)) {
        await safeClick(addressesTabSelector);
        await page.waitForTimeout(3000);
        
        // Extract Bill To address (should be active by default)
        console.log('Extracting Bill To address information...');
        transactionData.billTo = await extractDataByLabels({
          name: { label: 'Name' },
          address1: { label: 'Address 1' },
          address2: { label: 'Address 2' },
          city: { label: 'City' },
          state: { label: 'State' },
          zip: { label: 'Zip Code' }
        });
        
        // Click on Ship To tab within Addresses tab
        console.log('Clicking Ship To tab...');
        const shipToTabSelector = '#pgcBill_To-tab-2';
        
        if (await waitForElementToBeReady(shipToTabSelector, 30000)) {
          await safeClick(shipToTabSelector);
          await page.waitForTimeout(2000);
          
          // Extract Ship To address
          console.log('Extracting Ship To address information...');
          transactionData.shipTo = await extractDataByLabels({
            name: { label: 'Name' },
            address1: { label: 'Address 1' },
            address2: { label: 'Address 2' },
            city: { label: 'City' },
            state: { label: 'State' },
            zip: { label: 'Zip Code' }
          });
        }
      }
      
      // Click on Misc tab to extract any additional info
      console.log('Clicking Misc tab to extract additional info...');
      const miscTabSelector = '.k-tabstrip-items li[aria-controls="tbsMisc_"]';
      
      if (await waitForElementToBeReady(miscTabSelector, 30000)) {
        await safeClick(miscTabSelector);
        await page.waitForTimeout(3000);
        
        // Extract miscellaneous data
        console.log('Extracting data from Misc tab...');
        transactionData.misc = await extractDataByLabels({
          specialInstructions: { label: 'Special Instructions' },
          customerNotes: { label: 'Customer Notes' },
          internalNotes: { label: 'Invoice Instructions' }
        });
      }
      
      return transactionData;
    } catch (error) {
      // Return a skeleton object to prevent errors downstream
      return {
        main: { documentNum: '', poNumber: '' },
        items: [],
        shipping: {},
        terms: {},
        billTo: {},
        shipTo: {},
        misc: {}
      };
    }
  };
  
  // Create and save a new sales order in Tangle
  const createSalesOrder = async (transactionData) => {
    // Extract all the relevant parts of the transaction data
    const { main, shipping, billTo, shipTo, terms, misc, items } = transactionData;
    
          // Create a sales order object to return
    return {
      // Main tab data
      quoteDate: main?.poDate || new Date().toISOString(),
      name: 'SO-' + (main?.poNumber || main?.documentNum || new Date().getTime()),
      pONumber: main?.poNumber || main?.documentNum || '',
      documentNum: main?.documentNum || '',
      pODate: main?.poDate || '',
      partnerName: main?.partnerName || '',
      type: main?.type || '',
      totalQuoteLinePrice: main?.calculatedTotalAmount || 0,
      
      // Shipping tab data
      requestedDeliveryDate: shipping?.requestedDeliveryDate || '',
      customerPickUpDate: shipping?.shipDate || '',
      transportationMethod: shipping?.transportationMethod || '',
      location: shipping?.description || '',
      quantityOrdered: shipping?.quantityOrdered || 0,
      weightlbs: shipping?.weight || 0,
      volumeCF: shipping?.volume || 0,
      
      // Ship To address
      address1: shipTo?.address1 || '',
      address2: shipTo?.address2 || '',
      city: shipTo?.city || '',
      stateProvince: shipTo?.state || '',
      postalCode: shipTo?.zip || '',
      
      // Bill To address
      billAddress1: billTo?.address1 || '',
      billAddress2: billTo?.address2 || '',
      billingCity: billTo?.city || '',
      billingStateProvince: billTo?.state || '',
      billingPostalCode: billTo?.zip || '',
      
      // Terms data
      terms: terms?.type || '',
      dueDate: terms?.dueDate || '',
      
      // Misc data
      specialInstructions: misc?.specialInstructions || '',
      customerNotes: misc?.customerNotes || '',
      internalNotes: misc?.internalNotes || '',
      
      // Sales lines
      salesLines: items?.map((item, index) => ({
        description: item?.description || '',
        quantity: item?.quantity || 0,
        unitPrice: item?.price || 0,
        totalLineAmount: (item?.quantity || 0) * (item?.price || 0),
        lineItemNumber: index + 1,
        uOM: item?.uOM || '',
        uPCCaseCode: item.uPCCaseCode || '',   
        innerPacks: item.innerPacks,
        packSize: item.packSize,
        packUOM: item.packUOM,
        palletBlockAndTiers: item.palletBlockAndTiers,
        termsType: item.termsType,
        termsBasis: item.termsBasis,
        discount: item.discount,
        discountDaysDue: item.discountDaysDue,
        dueDate: item.dueDate,
        netDaysDue: item.netDaysDue,
        freeGoodsAllowance: item.freeGoodsAllowance,
        nonPerformanceAllowance: item.nonPerformanceAllowance,
      })) || []
    };
  };
  
  console.log('Opening TrueCommerce Foundry...');
  
  // Set viewport and navigate to site with longer timeout
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto('https://foundry.truecommerce.com/core/Default.html', { 
    waitUntil: 'networkidle0',
    timeout: 60000
  });
  
  console.log('Page loaded, waiting for login form...');
  await page.waitForTimeout(3000);
  
  console.log('Entering login credentials...');
  
  // Login process - enter username with safer approach
  if (await waitForElementToBeReady('hj-field-table-row:nth-of-type(1) input')) {
    await page.click('hj-field-table-row:nth-of-type(1) input');
    await page.type('hj-field-table-row:nth-of-type(1) input', 'wayne@tangle.io', { delay: 100 });
  } else {
    console.log('Username field not found');
    return { success: false, error: 'Login form not found' };
  }
  
  // Enter password with safer approach
  if (await waitForElementToBeReady('hj-field-table-row:nth-of-type(2) input')) {
    await page.click('hj-field-table-row:nth-of-type(2) input');
    await page.type('hj-field-table-row:nth-of-type(2) input', 'T4n9L3!@1886', { delay: 100 });
  } else {
    console.log('Password field not found');
    return { success: false, error: 'Password field not found' };
  }
  
  console.log('Submitting login...');
  
  // Click login button and wait for navigation
  if (await waitForElementToBeReady('button')) {
    // Click login and wait for navigation to complete
    try {
      await Promise.all([
        page.click('button'),
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
      ]);
    } catch (e) {
      console.log('Navigation promise rejected, but continuing...');
    }
  } else {
    console.log('Login button not found');
    return { success: false, error: 'Login button not found' };
  }
  
  console.log('Login submitted, waiting for dashboard to load...');
  
  // Add a substantial wait after login to ensure dashboard is fully loaded
  await page.waitForTimeout(10000);
  
  console.log('Looking for menu button...');
  
  // Try a more reliable selector for the menu button
  const menuButtonSelector = '#menuButtonToggle';
  
  // Wait for menu button with extended timeout
  if (!await waitForElementToBeReady(menuButtonSelector, 60000)) {
    console.log('Menu button not found after extended wait');
    return { success: false, error: 'Menu button not found' };
  }
  
  console.log('Menu button found, clicking...');
  await safeClick(menuButtonSelector);
  
  // Wait for menu to fully expand
  console.log('Waiting for menu to expand...');
  await page.waitForTimeout(3000);
  
  // Click Transaction Manager with safer approach
  console.log('Looking for Transaction Manager menu item...');
  const transactionManagerSelector = '#menu li:nth-of-type(4) a';
  
  if (!await waitForElementToBeReady(transactionManagerSelector, 30000)) {
    console.log('Transaction Manager menu item not found');
    return { success: false, error: 'Transaction Manager menu item not found' };
  }
  
  console.log('Clicking Transaction Manager...');
  await safeClick(transactionManagerSelector);
  
  // Wait for submenu to fully appear
  console.log('Waiting for submenu to appear...');
  await page.waitForTimeout(3000);
  
  // Click Transactions with safer approach
  console.log('Looking for Transactions menu item...');
  const transactionsSelector = '#menu li.current li:nth-of-type(1) a';
  
  if (!await waitForElementToBeReady(transactionsSelector, 30000)) {
    console.log('Transactions menu item not found');
    return { success: false, error: 'Transactions menu item not found' };
  }
  
  console.log('Clicking Transactions...');
  await safeClick(transactionsSelector);
  
  // Wait for transactions to load
  console.log('Waiting for transactions page to load...');
  await page.waitForTimeout(5000);
  
  // Click Received tab with safer approach
  console.log('Looking for Received tab...');
  const receivedTabSelector = '#FolderList > li:nth-of-type(2) > span';
  
  if (!await waitForElementToBeReady(receivedTabSelector, 30000)) {
    console.log('Received tab not found');
    return { success: false, error: 'Received tab not found' };
  }
  
  console.log('Clicking Received tab...');
  await safeClick(receivedTabSelector);
  
  // Wait for received transactions to load
  console.log('Waiting for received transactions to load...');
  await page.waitForTimeout(5000);
  
  // First get all transactions from the table - we need to extract their document numbers
  console.log('Extracting transaction list...');
  
  // Extract all transactions data from the table
  let transactions = [];
  try {
    transactions = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
      return rows.map((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return null;
        
        return {
          documentNum: cells[8]?.textContent?.trim() || '', // Document Num usually in column 6
          poNumber: cells[8]?.textContent?.trim() || '',    // PO # usually in column 7
          // Use array index directly instead of rowIndex to avoid inconsistencies
          index: index
        };
      }).filter(Boolean); // Remove any null entries
    });
  } catch (error) {
    transactions = [];
  }
  
      console.log('Found ' + transactions.length + ' transactions in the Received tab');
  
  if (transactions.length === 0) {
    return { 
      success: false, 
      error: 'No transactions found in the Received tab',
      stats: {
        total: 0,
        processed: 0,
        skipped: 0,
        limitReached: false
      }
    };
  }
  
  // Use existingPONumbers directly (converted to lowercase for case-insensitive comparison)
  const existingPONumbersLower = existingPONumbers.map(po => po.toLowerCase());
  
       // Add detailed logging for each transaction
const newTransactions = transactions.filter(transaction => {
  // Extract and normalize both document number and PO number
  const docNum = (transaction.documentNum || '').trim();
  const poNum = (transaction.poNumber || '').trim();
  
  // Log each transaction we're checking
  console.log('Checking transaction:', {
    docNum,
    poNum,
    docNumLower: docNum.toLowerCase(),
    poNumLower: poNum.toLowerCase()
  });
  
  // Skip if both are missing
  if (!docNum && !poNum) {
    console.log('SKIPPED: Both document number and PO number are empty');
    return false;
  }
  
  // Check if either exists in our list - with DETAILED logging
  let docNumExists = false;
  if (docNum) {
    docNumExists = existingPONumbersLower.includes(docNum.toLowerCase());
    console.log('Document Number ' + docNum + ' exists in Tangle? ' + docNumExists);
    
    // Extra check for numeric comparison
    if (!docNumExists) {
      const numericCheck = existingPONumbersLower.includes(String(parseInt(docNum)));
      console.log('  Numeric comparison check: ' + numericCheck);
      docNumExists = docNumExists || numericCheck;
    }
  }
  
  let poNumExists = false;
  if (poNum) {
    poNumExists = existingPONumbersLower.includes(poNum.toLowerCase());
    console.log('PO Number ' + poNum + ' exists in Tangle? ' + poNumExists);
    
    // Extra check for numeric comparison
    if (!poNumExists) {
      const numericCheck = existingPONumbersLower.includes(String(parseInt(poNum)));
      console.log('  Numeric comparison check: ' + numericCheck);
      poNumExists = poNumExists || numericCheck;
    }
  }
  
  // Handle comparison results
  const shouldSkip = docNumExists || poNumExists;
  console.log('Transaction ' + (docNum || poNum) + ' should be ' + (shouldSkip ? 'SKIPPED' : 'PROCESSED'));
  
  // Keep only if NEITHER exists
  return !shouldSkip;
});

// Log the filtered transaction list for final confirmation
console.log('After filtering: ' + newTransactions.length + ' out of ' + transactions.length + ' will be processed',
            newTransactions.map(t => ({documentNum: t.documentNum, poNumber: t.poNumber})));
            
  console.log(newTransactions.length + ' transactions are new and need processing');
  
  // Limit the number of transactions to process
  const transactionsToProcess = newTransactions.slice(0, maxToProcess);
  
  console.log('Will process ' + transactionsToProcess.length + ' out of ' + newTransactions.length + ' new transactions');
  
  // Statistics for tracking progress
  const stats = {
    total: transactions.length,
    processed: 0,
    skipped: transactions.length - newTransactions.length,
    limitReached: newTransactions.length > maxToProcess
  };
  
  // Array to collect all the sales orders we'll create
  const salesOrders = [];
  
  // Process each transaction
  for (let i = 0; i < transactionsToProcess.length; i++) {
    const transaction = transactionsToProcess[i];
    console.log('Processing transaction ' + (i+1) + '/' + transactionsToProcess.length + ': ' + transaction.documentNum);
    
    try {
      // Report progress back to the UI (20% for setup, 80% for processing transactions)
      const progressPercent = 20 + Math.floor((i / transactionsToProcess.length) * 80);
      // We need to set these as page properties so they can be accessed outside
      await page.evaluate((progress, message) => {
        window.extractionProgress = progress;
        window.extractionProgressMessage = message;
      }, progressPercent, 'Processing transaction ' + (i+1) + '/' + transactionsToProcess.length);
      
      // Make sure we're starting from the main transaction list view
      // This is crucial for reliable navigation between transactions
      
      // Verify we're on the Received tab and transaction list is visible
      let isOnTransactionList = false;
      try {
        isOnTransactionList = await page.evaluate(() => {
          // Check if we're on the transaction list page
          const transactionsTable = document.querySelector('#Transactions table');
          return !!transactionsTable && transactionsTable.offsetParent !== null;
        });
      } catch (error) {
        isOnTransactionList = false;
      }
      
      if (!isOnTransactionList) {
        console.log('Not on transaction list, navigating back...');
        
        // Try to find and click the specific back button first
        let backButtonExists = false;
        try {
          backButtonExists = await page.evaluate(() => {
            // Look for the specific back button with the data-hj-test-id attribute
            const backButton = document.querySelector('a[data-hj-test-id="active-thread-previous-button"]');
            return backButton && !backButton.classList.contains('disabled');
          });
        } catch (error) {
          backButtonExists = false;
        }
        
        if (backButtonExists) {
          console.log('Found specific back button, clicking it...');
          await safeClick('a[data-hj-test-id="active-thread-previous-button"]');
          await page.waitForTimeout(3000);
        } else {
          // If specific back button not found, try other close buttons
          let closeButtonSelector = null;
          try {
            closeButtonSelector = await page.evaluate(() => {
              const closeButtons = [
                '.close-button', '.k-window-actions .k-window-action', 
                'button.close', '.window-close', 'button[title="Close"]',
                'div.form-close-button', 'span.k-icon.k-i-close'
              ];
              
              for (const selector of closeButtons) {
                const button = document.querySelector(selector);
                if (button && button.offsetParent !== null) {
                  return selector;
                }
              }
              return null;
            });
          } catch (error) {
            console.log('Error finding close button: ' + error.message);
            closeButtonSelector = null;
          }
          
          if (closeButtonSelector) {
            await safeClick(closeButtonSelector);
            await page.waitForTimeout(3000);
          } else {
            // Try Escape key as fallback
            await page.keyboard.press('Escape');
            await page.waitForTimeout(3000);
          }
        }
        
        // Check again if we're on transaction list
        let backOnList = false;
        try {
          backOnList = await page.evaluate(() => {
            return !!document.querySelector('#Transactions table');
          });
        } catch (error) {
          backOnList = false;
        }
        
        if (!backOnList) {
          // Last resort: Re-navigate to the transactions page
          console.log('Still not on transaction list, re-navigating to Transactions...');
          
          // Click menu button
          if (await waitForElementToBeReady('#menuButtonToggle', 30000)) {
            await safeClick('#menuButtonToggle');
            await page.waitForTimeout(2000);
            
            // Click Transaction Manager
            if (await waitForElementToBeReady('#menu li:nth-of-type(4) a', 30000)) {
              await safeClick('#menu li:nth-of-type(4) a');
              await page.waitForTimeout(2000);
              
              // Click Transactions
              if (await waitForElementToBeReady('#menu li.current li:nth-of-type(1) a', 30000)) {
                await safeClick('#menu li.current li:nth-of-type(1) a');
                await page.waitForTimeout(5000);
              }
            }
          }
        }
      }
      
      // Now ensure we're on the Received tab
      let receivedTabActive = false;
      try {
        receivedTabActive = await page.evaluate(() => {
          const tab = document.querySelector('#FolderList > li:nth-of-type(2)');
          return tab && tab.classList.contains('active');
        });
      } catch (error) {
        receivedTabActive = false;
      }
      
      if (!receivedTabActive) {
        console.log('Received tab not active, clicking it...');
        await safeClick(receivedTabSelector);
        await page.waitForTimeout(3000); // Wait for content to load
      }
      
      // Get a fresh list of transactions to ensure accurate selection
      console.log('Getting updated transaction list...');
      let refreshedTransactions = [];
      try {
        refreshedTransactions = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
          return rows.map((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 6) return null;
            
            return {
              documentNum: cells[8]?.textContent?.trim() || '',
              poNumber: cells[8]?.textContent?.trim() || '',
              // Use array index directly instead of rowIndex
              index: index 
            };
          }).filter(Boolean);
        });
      } catch (error) {
        refreshedTransactions = [];
      }
      
      // Find our target transaction in the refreshed list
      const refreshedTransaction = refreshedTransactions.find(t => 
        (t.documentNum && transaction.documentNum && 
         t.documentNum.toLowerCase() === transaction.documentNum.toLowerCase()) || 
        (t.poNumber && transaction.poNumber && 
         t.poNumber.toLowerCase() === transaction.poNumber.toLowerCase())
      );
      
      if (!refreshedTransaction) {
        console.log('Cannot find transaction ' + transaction.documentNum + ' in the current view, skipping...');
        continue;
      }
      
      // We add 1 because CSS selectors are 1-based (first child is 1, not 0)
      const rowIndex = refreshedTransaction.index + 1; 
      console.log('Transaction found at row index ' + rowIndex);
      
      // Find the selector for this specific transaction based on its refreshed position
      const rowSelector = '#Transactions table tbody tr:nth-child(' + rowIndex + ') td:nth-of-type(6)';
      
      // Click on the row to open the transaction
      console.log('Opening transaction ' + transaction.documentNum + '...');
      
      // Use a more robust selector - try to find the row by document number first  
      let rowFoundAndClicked = false;
      
      try {
        // First try: Find the specific row containing the document number text
        console.log('Attempting to find the row by document content...');
        const docNumber = transaction.documentNum || '';
        const poNumber = transaction.poNumber || '';
        
        // FIX: Properly initialize and use rowsByContentIndex
        let rowsByContentIndex = null;
        try {
          rowsByContentIndex = await page.evaluate((docNum, poNum) => {
            // Find rows that contain our document/PO number
            const allRows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
            const matchingRows = allRows.filter(row => {
              const text = row.textContent.toLowerCase();
              return (docNum && text.includes(docNum.toLowerCase())) || 
                     (poNum && text.includes(poNum.toLowerCase()));
            });
            
            if (matchingRows.length > 0) {
              // Get the index of the first matching row
              const rowIndex = Array.from(document.querySelectorAll('#Transactions table tbody tr'))
                .findIndex(r => r === matchingRows[0]);
              return rowIndex >= 0 ? rowIndex + 1 : null; // Convert to 1-based for CSS
            }
            return null;
          }, docNumber, poNumber);
        } catch (error) {
          rowsByContentIndex = null;
        }
        
        if (rowsByContentIndex) {
          console.log('Found matching row by content at position ' + rowsByContentIndex);
          // Click on the 6th column (document number column) of this row
          const contentBasedSelector = '#Transactions table tbody tr:nth-child(' + rowsByContentIndex + ') td:nth-of-type(6)';
          const isReady = await waitForElementToBeReady(contentBasedSelector, 15000);
          if (isReady) {
            await safeClick(contentBasedSelector, { clickCount: 2 });
            rowFoundAndClicked = true;
            
            // Wait for transaction details to load
            console.log('Waiting for transaction details to load...');
            await page.waitForTimeout(5000);
          }
        } else {
          console.log('No matching rows found by document content');
        }
      } catch (err) {
        console.log('Error finding row by content, trying fallback method:', err.message);
      }
      
      // If we couldn't find/click by content, use the index-based approach
      if (!rowFoundAndClicked) {
        try {
          console.log('Trying to click row using selector: ' + rowSelector);
          const isReady = await waitForElementToBeReady(rowSelector, 15000);
          if (isReady) {
            await safeClick(rowSelector, { clickCount: 2 });
            
            // Wait for transaction details to load
            console.log('Waiting for transaction details to load...');
            await page.waitForTimeout(5000);
          } else {
            console.log('Row not ready for clicking: ' + rowSelector);
            continue;
          }
        } catch (err) {
          console.log('Error clicking row using selector ' + rowSelector + ':', err.message);
          console.log('Skipping to next transaction...');
          continue;
        }
      }
                await page.waitForTimeout(5000);

      // Verify we're actually in the transaction detail view
      let isInDetailView = false;
      try {
        isInDetailView = await page.evaluate(() => {
          // Look for common elements that would exist in the transaction detail view
          return !!(
            document.querySelector('.k-tabstrip-items') || 
            document.querySelector('[aria-controls="tbsItems"]') ||
            document.querySelector('[aria-controls="tbsShipping"]')
          );
        });
      } catch (error) {
        isInDetailView = false;
      }
      
      if (!isInDetailView) {
        console.log('Failed to open transaction detail view, retrying...');
        // Try clicking one more time
        if (await waitForElementToBeReady(rowSelector, 15000)) {
          await safeClick(rowSelector, { clickCount: 2 });
          await page.waitForTimeout(5000);
          
          // Check again
          try {
            const isNowInDetailView = await page.evaluate(() => {
              return !!(
                document.querySelector('.k-tabstrip-items') || 
                document.querySelector('[aria-controls="tbsItems"]')
              );
            });
            
            if (!isNowInDetailView) {
              console.log('Unable to open transaction ' + transaction.documentNum + ', skipping to next...');
              continue;
            }
          } catch (error) {
            console.log('Error re-checking if in detail view: ' + error.message);
            continue;
          }
        } else {
          console.log('Row selector ' + rowSelector + ' not ready for retry click, skipping transaction');
          continue;
        }
      }
      
      // Wait a bit longer for everything to fully load
      await page.waitForTimeout(3000);
      
      // Extract all the details for this transaction
      const transactionData = await extractTransactionDetails();
      console.log('Extracted details for transaction ' + transaction.documentNum);
      
      // Prepare the sales order data
      const salesOrderData = await createSalesOrder(transactionData);
      salesOrders.push(salesOrderData);
      
      // Update stats
      stats.processed++;
      
      // Close the transaction to return to the list
      console.log('Returning to transaction list...');
      
      // Look specifically for the "back to transactions" button you identified
      let backButtonExists = false;
      try {
        backButtonExists = await page.evaluate(() => {
          // Look for the specific back button with the data-hj-test-id attribute
          const backButton = document.querySelector('a[data-hj-test-id="active-thread-previous-button"]');
          return backButton && !backButton.classList.contains('disabled');
        });
      } catch (error) {
        backButtonExists = false;
      }
      
      if (backButtonExists) {
        // Use the specific back button
        console.log('Found specific back button, clicking it...');
        await safeClick('a[data-hj-test-id="active-thread-previous-button"]');
        await page.waitForTimeout(3000);
      } else {
        // Fall back to looking for other close buttons
        let closeSelector = null;
        try {
          closeSelector = await page.evaluate(() => {
            const closeButtons = [
              '.close-button', 
              '.k-window-actions .k-window-action', 
              'button.close',
              '.window-close',
              'button[title="Close"]',
              'div.form-close-button',
              'span.k-icon.k-i-close'
            ];
            
            for (const selector of closeButtons) {
              const button = document.querySelector(selector);
              if (button && button.offsetParent !== null) {
                return selector;
              }
            }
            
            // If no specific close button found, look for any clickable element with "close" text
            const closeElements = Array.from(document.querySelectorAll('button, a, span'))
              .filter(el => el.textContent && el.textContent.toLowerCase().includes('close') && 
                           el.offsetParent !== null);
            
            if (closeElements.length > 0) {
              // Try to get a unique selector for this element
              const el = closeElements[0];
              const tag = el.tagName.toLowerCase();
              if (el.id) return tag + '#' + el.id;
              if (el.className) return tag + '.' + el.className.replace(/\\s+/g, '.');
              return null;
            }
            
            return null;
          });
        } catch (error) {
          closeSelector = null;
        }
        
        if (closeSelector) {
          await safeClick(closeSelector);
        } else {
          console.log('No close button found, trying ESC key');
          await page.keyboard.press('Escape');
        }
      }
      
      // Wait for the transaction list to be visible again with confirmation
      console.log('Waiting to return to transaction list...');
      await page.waitForTimeout(3000);
      
      // Verify we're back at the transaction list
      let backAtList = false;
      try {
        backAtList = await page.evaluate(() => {
          return !!document.querySelector('#Transactions table');
        });
      } catch (error) {
        backAtList = false;
      }
      
      if (!backAtList) {
        console.log('Not back at transaction list yet, waiting longer...');
        await page.waitForTimeout(5000);
        
        // One more verification
        try {
          const finalCheck = await page.evaluate(() => {
            return !!document.querySelector('#Transactions table');
          });
          
          if (!finalCheck) {
            console.log('Warning: Could not confirm return to transaction list');
            // Try pressing Escape as a last resort
            await page.keyboard.press('Escape');
            await page.waitForTimeout(2000);
          }
        } catch (error) {
          // Try pressing Escape as a last resort
          await page.keyboard.press('Escape');
          await page.waitForTimeout(2000);
        }
      }
      
    } catch (error) {
      console.error('Error processing transaction' + transaction.documentNum + error);
      // Continue with next transaction, but first try to get back to the list view
      try {
        // Press Escape a couple times to try to get back to the main view
        await page.keyboard.press('Escape');
        await page.waitForTimeout(2000);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(3000);
      } catch (e) {
        console.log('Error during recovery:', e);
      }
    }
  }
  
  // Return all the data so we can create the sales orders in Tangle
  return {
    success: true,
    salesOrders: salesOrders,
    stats: stats,
    extractionProgress: 100,
    extractionProgressMessage: 'Completed processing ' + stats.processed + ' transactions'
  };
}`;
      
      try {
        // Call the Puppeteer helper function with our embedded user actions
        const res = await $runPuppeteer(userActionsString)
        let result = res.extractedData;

        console.log('result', result)
        if (result && result.salesOrders && result.salesOrders.length > 0) {
          console.log('creating sales orders')
          // Create the sales orders in Tangle from the returned data
          await this.createSalesOrders(result.salesOrders);
          
          // Update extraction progress
          this.extractionStats = result.stats || this.extractionStats;
          this.extractionProgress = 100;
          this.extractionProgressMessage = 'Extraction complete!';
          
          return {
            success: true,
            message: `Successfully processed ${this.extractionStats.processed} transactions`,
            stats: this.extractionStats
          };
        }
        
        // Return the result from the Puppeteer script
        return result || { 
          success: true, 
          message: "TrueCommerce extraction completed but no new transactions found",
          stats: {
            total: 0,
            processed: 0,
            skipped: 0,
            limitReached: false
          }
        };
      } catch (error) {
        console.error("Error in TrueCommerce extraction:", error);
        return { success: false, error: error.message };
      }
    },

    async createSalesOrders(salesOrders) {
      console.log('create sales orders called')
      if (!salesOrders || salesOrders.length === 0) {
        console.log("No sales orders to create");
        return;
      }
      
      const currentDate = new Date();
      const createdSalesOrders = [];
      
      try {
        for (const orderData of salesOrders) {
          console.log('creating sales order')
          // Extract sales lines data before removing it from the order object
          const salesLinesData = orderData.salesLines || [];
          // Make a copy of orderData without the salesLines property
          const { salesLines, ...salesOrderData } = orderData;
          
          // Add created date and defaults
          salesOrderData.createdDate = currentDate.toISOString();
          salesOrderData.status = 'New';
          salesOrderData.owner = this.fbUser?.uid || '';
          
          console.log('Creating sales order:', salesOrderData.name);
          
          // Add the sales order to the opportunities table
          const salesOrderKey = await $dgAddRow('opportunities', salesOrderData);
          console.log('Created sales order with key:', salesOrderKey);
          
          // Create sales lines for each item
          const createdLines = [];
          
          for (let i = 0; i < salesLinesData.length; i++) {
            const lineData = salesLinesData[i];
            const totalAmount = lineData.totalLineAmount || 0;
            
            // Map the fields from extracted data to sales line fields
            const mappedPart = $getGrid('tCMappings').find((item) => item.upc === lineData.description)?.part
            const salesLineData = {
              name: `Line ${lineData.lineItemNumber || (i + 1)}`,
              salesOrder: salesOrderKey,                 // Link to the opportunity
              uPCCaseCode: lineData.uPCCaseCode || '',   
              part: mappedPart,
              innerPacks: lineData.innerPacks,
              packSize: lineData.packSize,
              packUOM: lineData.packUOM,
              palletBlockAndTiers: lineData.palletBlockAndTiers,
              termsType: lineData.termsType,
              termsBasis: lineData.termsBasis,
              discount: lineData.discount,
              discountDaysDue: lineData.discountDaysDue,
              dueDate: lineData.dueDate,
              netDaysDue: lineData.netDaysDue,
              freeGoodsAllowance: lineData.freeGoodsAllowance,
              nonPerformanceAllowance: lineData.nonPerformanceAllowance,
              description: lineData.description || '',   // Description from extracted data
              quantity: lineData.quantity || 0,          // Quantity from extracted data
              unitPrice: lineData.unitPrice || 0,        // Unit price from extracted data
              totalLineAmount: totalAmount,              // Total line amount calculated
              lineItemNumber: lineData.lineItemNumber || (i + 1), // Line item number
              createdDate: currentDate.toISOString(),    // Current date for created date
              // Additional mapped fields
              state: 'New',                              // Default state as New
              status: 'Open',                            // Default status as Open
              uOM: lineData.uOM || '',                   // Unit of Measure
              customerNotes: lineData.customerNotes || '',
              
              // Calculated fields
              subtotal: totalAmount,
              totalCost: totalAmount,
              totalLinePrice: totalAmount
            };
            
            // Add the sales line to the database
            const lineKey = await $dgAddRow('salesLines', salesLineData);
            console.log(`Created sales line ${i+1} with key:`, lineKey);
            
            createdLines.push(lineKey);
          }
          
          createdSalesOrders.push({
            orderKey: salesOrderKey,
            name: salesOrderData.name,
            lineCount: createdLines.length
          });
        }
        
        // Show success alert with details
        this.$bvToast.toast(`Created ${createdSalesOrders.length} sales orders with their line items`, {
          title: 'Success',
          variant: 'success',
          solid: true,
          autoHideDelay: 5000
        });
        
        return createdSalesOrders;
        
      } catch (error) {
        console.error("Error creating sales orders:", error);
        
        // Show error toast
        this.$bvToast.toast(`Failed to create some sales orders: ${error.message}`, {
          title: 'Error',
          variant: 'danger',
          solid: true,
          autoHideDelay: 5000
        });
        
        return createdSalesOrders;
      }
    }
  }
}
</script>

<style>
.truecommerce-extractor {
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  max-width: 100%;
  margin: 0 auto;
}

.extractor-title {
  color: #2c3e50;
  margin-bottom: 15px;
}

.settings-panel {
  background-color: #f0f4f8;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #4e73df;
}

.extraction-button {
  width: 100%;
  margin-bottom: 15px;
}

.extractor-description {
  color: #6c757d;
}
</style>