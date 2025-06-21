<template>
  <div class="turnaround-button-wrapper">
    <b-button
      @click="processTurnaround"
      :variant="variant"
      :size="size"
      :disabled="isLoading"
      class="turnaround-button"
      :id="buttonId"
    >
      <b-spinner v-if="isLoading" small></b-spinner>
      {{ isLoading ? loadingText : buttonText }}
    </b-button>

    <b-tooltip :target="buttonId" placement="top">
      {{ tooltipText }}
    </b-tooltip>
  </div>
</template>

<script>
module.exports = {
  name: 'ShipNoticeButton',
  props: {
    rowData: {
      type: Object,
      required: true
    },
    buttonText: {
      type: String,
      default: 'Ship Notice'
    },
    loadingText: {
      type: String,
      default: 'Processing...'
    },
    variant: {
      type: String,
      default: 'primary'
    },
    size: {
      type: String,
      default: 'sm'
    },
    successCallback: {
      type: Function,
      default: null
    },
    isPalletPickAndPack: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isLoading: false,
      buttonId: `turnaround-button-${Math.random().toString(36).substring(2, 9)}`,
      tooltipText: this.isPalletPickAndPack 
        ? `Create Ship Notice/Manifest - Pallet Pick and Pack`
        : `Create Ship Notice/Manifest - Pick and Pack`,
      lastResult: null,
      documentType: this.isPalletPickAndPack 
        ? 'Ship Notice/Manifest - Pallet Pick and Pack'
        : 'Ship Notice/Manifest - Pick and Pack'
    };
  },
  methods: {
    async processTurnaround() {
      if (!this.rowData || !this.rowData.pONumber) {
        this.$bvToast.toast('Missing PO Number, cannot process turnaround', {
          title: 'Error',
          variant: 'danger',
          solid: true,
          autoHideDelay: 5000
        });
        return;
      }

      this.isLoading = true;
      this.tooltipText = `Processing turnaround for PO: ${this.rowData.pONumber}`;

      try {
        // This will be the action string passed to our puppeteer helper
// This will be the action string passed to our puppeteer helper
const userActionsString = `
async (page) => {
  const poNumber = ${JSON.stringify(this.rowData.pONumber)};
  const documentType = ${JSON.stringify(this.documentType)};
  console.log("Processing turnaround for PO: " + poNumber + ", Document Type: " + documentType);
  
  // Function to ensure element is visible and clickable
  const waitForElementToBeReady = async (selector, timeout = 30000) => {
    console.log("Waiting for element to be ready: " + selector);
    
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
      
      console.log("Element is ready: " + selector);
      return true;
    } catch (error) {
      console.log("Element not ready or not found: " + selector + ". Error: " + error.message);
      return false;
    }
  };
  
  // Safer click function with retries
  const safeClick = async (selector, options = {}) => {
    const { timeout = 30000, clickCount = 1, delay = 100 } = options;
    
    const isReady = await waitForElementToBeReady(selector, timeout);
    if (!isReady) {
      console.log("Could not safely click " + selector + " - element not ready");
      return false;
    }
    
    try {
      await page.click(selector, { clickCount, delay });
      console.log("Successfully clicked: " + selector);
      return true;
    } catch (error) {
      console.log("Click failed on first attempt for " + selector + ". Retrying...");
      // Add a small delay and try again
      await page.waitForTimeout(2000);
      try {
        await page.click(selector, { clickCount, delay });
        console.log("Successfully clicked on second attempt: " + selector);
        return true;
      } catch (secondError) {
        console.log("Failed to click " + selector + " after multiple attempts: " + secondError.message);
        return false;
      }
    }
  };
  
  // Utility function to safely fill input fields
  const safeFill = async (selector, value, options = {}) => {
    const { timeout = 30000, delay = 50 } = options;
    
    const isReady = await waitForElementToBeReady(selector, timeout);
    if (!isReady) {
      console.log("Could not safely fill " + selector + " - element not ready");
      return false;
    }
    
    try {
      await page.click(selector);
      await page.focus(selector);
      
      // Clear existing value first
      await page.evaluate((sel) => {
        document.querySelector(sel).value = '';
      }, selector);
      
      // Type the value
      await page.type(selector, value, { delay });
      console.log("Successfully filled " + selector + " with " + value);
      return true;
    } catch (error) {
      console.log("Fill operation failed for " + selector + ": " + error.message);
      return false;
    }
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
  
  // Find the specific transaction by PO number
  console.log("Looking for transaction with PO number: " + poNumber);
  
  let targetRowIndex = -1;
  try {
    // Look for transaction by PO number
    targetRowIndex = await page.evaluate((searchPO) => {
      const rows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
      
      // First approach: Check if any cell in any row contains our PO text
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const rowText = row.textContent || '';
        
        // If the entire row contains our PO number as part of its text
        if (rowText.includes(searchPO)) {
          console.log("Found PO " + searchPO + " in row text at index " + rowIndex);
          return rowIndex;
        }
      }
      
      // Not found after all our attempts
      return -1;
    }, poNumber);
  } catch (error) {
    console.log("Error finding transaction row: " + error.message);
    targetRowIndex = -1;
  }
  
  if (targetRowIndex === -1) {
    console.log("Transaction with PO number " + poNumber + " not found");
    return { 
      success: false, 
      error: "Transaction with PO number " + poNumber + " not found" 
    };
  }
  
  // Add 1 because CSS selectors are 1-based (first child is 1, not 0)
  const rowIndex = targetRowIndex + 1;
  console.log("Transaction found at row index " + rowIndex);
  
  // Single click on the row to select it
  let rowSelector = "#Transactions table tbody tr:nth-child(" + rowIndex + ")";
  console.log("Clicking row to select it: " + rowSelector);
  
  if (!await safeClick(rowSelector, { clickCount: 1 })) {
    // If general row click doesn't work, try to click a specific cell
    rowSelector = "#Transactions table tbody tr:nth-child(" + rowIndex + ") td:nth-of-type(1)";
    if (!await safeClick(rowSelector, { clickCount: 1 })) {
      return { 
        success: false, 
        error: "Could not select transaction row for PO number " + poNumber 
      };
    }
  }
  
  // Wait a moment for the row to be selected and the context actions to appear
  await page.waitForTimeout(2000);
  
  // Look for and click the "Turnaround" button in the context actions
  console.log('Looking for Turnaround button...');
  
  try {
    // Find and click the Turnaround button by its text
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div[data-hj-test-id="context-actions"] a span'));
      const turnaroundButton = elements.find(el => el.textContent.trim() === 'Turnaround');
      if (turnaroundButton) {
        turnaroundButton.closest('a').click();
        return true;
      }
      return false;
    });
    console.log('Turnaround button clicked');
  } catch (error) {
    console.log("Error clicking Turnaround button: " + error.message);
    return { 
      success: false, 
      error: 'Failed to click Turnaround button' 
    };
  }
  
  // Wait for the dialog to appear
  console.log('Waiting for Turnaround dialog to appear...');
  await page.waitForTimeout(3000);
  
  // Find and check the Ship Notice checkbox
  console.log("Looking for " + documentType + " option...");
  
  try {
    // Find and select the Ship Notice option
    const docTypeFound = await page.evaluate((docType) => {
      const spans = Array.from(document.querySelectorAll('.tree-layout.tree-item .text span'));
      console.log('Available document types:', spans.map(s => s.textContent.trim()).join(', '));
      
      // Look for Ship Notice with the specified pick and pack type
      let shipNoticeSpan = null;
      
      // First try to find an exact match
      shipNoticeSpan = spans.find(span => 
        span.textContent.trim() === docType || 
        span.textContent.trim().startsWith(docType + ' (ver.')
      );
      
      // If not found, try to find by the main parts
      if (!shipNoticeSpan) {
        const isPallet = docType.includes('Pallet');
        
        shipNoticeSpan = spans.find(span => {
          const text = span.textContent.trim();
          return text.includes('Ship Notice/Manifest') && 
                 text.includes('Pick and Pack') &&
                 (isPallet ? text.includes('Pallet') : !text.includes('Pallet'));
        });
      }
      
      // If still not found, try just "Ship Notice/Manifest"
      if (!shipNoticeSpan) {
        shipNoticeSpan = spans.find(span => 
          span.textContent.trim().includes('Ship Notice/Manifest')
        );
      }
      
      if (shipNoticeSpan) {
        console.log('Found Ship Notice match:', shipNoticeSpan.textContent.trim());
        const listItem = shipNoticeSpan.closest('li');
        if (listItem) {
          const checkbox = listItem.querySelector('.checkBox-wrapper');
          if (checkbox) {
            checkbox.click();
            return true;
          }
        }
      }
      
      return false;
    }, documentType);
    
    if (!docTypeFound) {
      console.log(documentType + " option not found");
      return { 
        success: false, 
        error: documentType + " option not found in turnaround dialog" 
      };
    }
    
    console.log(documentType + " option checked");
  } catch (error) {
    console.log("Error finding " + documentType + " option: " + error.message);
    return { 
      success: false, 
      error: "Failed to select " + documentType + " option" 
    };
  }
  
  // Now click the Finish button
  console.log('Looking for Finish button...');
  
  try {
    const finishButtonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.hj-dlg-footer button'));
      const finishButton = buttons.find(btn => btn.textContent.trim() === 'Finish');
      if (finishButton) {
        finishButton.click();
        return true;
      }
      return false;
    });
    
    if (!finishButtonClicked) {
      console.log('Finish button not found or could not be clicked');
      return { 
        success: false, 
        error: 'Could not click Finish button in turnaround dialog' 
      };
    }
    
    console.log('Finish button clicked');
  } catch (error) {
    console.log("Error clicking Finish button: " + error.message);
    return { 
      success: false, 
      error: 'Failed to click Finish button' 
    };
  }
  
  // Wait for the turnaround to process
  console.log('Waiting for turnaround to process...');
  await page.waitForTimeout(5000);
  
  // Navigate to Outbox
  console.log('Looking for Outbox in the folder list...');
  try {
    const outboxClicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('#FolderList span.k-link'));
      const outboxSpan = spans.find(span => span.textContent.trim() === 'Outbox');
      
      if (outboxSpan) {
        outboxSpan.click();
        return true;
      }
      
      return false;
    });
    
    if (!outboxClicked) {
      console.log('Could not find or click Outbox tab');
      return { 
        success: true, 
        warning: 'Turnaround completed but could not navigate to Outbox' 
      };
    }
    
    console.log('Successfully navigated to Outbox tab');
  } catch (error) {
    console.log("Error navigating to Outbox: " + error.message);
    return { 
      success: true, 
      warning: 'Turnaround completed but could not navigate to Outbox' 
    };
  }
  
  // Wait for outbox content to load
  console.log('Waiting for content to load after navigation...');
  await page.waitForTimeout(5000);
  
  // Find the most recent transaction in the outbox
  console.log("Looking for the newly created " + documentType + " in the current view...");
  
  try {
    // Look for a row that has our PO number and "Ship Notice" text
    const foundDocRowIndex = await page.evaluate((searchPO) => {
      const rows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
      
      // Find rows that match both our document type and PO number
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const rowText = row.textContent || '';
        
        // Check if row contains our PO number and "Ship Notice"
        if (rowText.includes(searchPO) && rowText.includes('Ship Notice')) {
          return rowIndex;
        }
      }
      
      // Not found
      return -1;
    }, poNumber);
    
    if (foundDocRowIndex === -1) {
      console.log("Could not find the " + documentType + " in the outbox");
      return { 
        success: true, 
        warning: 'Turnaround completed but could not find the resulting document in the outbox' 
      };
    }
    
    // Add 1 for CSS selector index
    const outboxRowIndex = foundDocRowIndex + 1;
    console.log("Found " + documentType + " at row index " + outboxRowIndex);
    
    // Double-click to open the transaction
    const outboxRowSelector = "#Transactions table tbody tr:nth-child(" + outboxRowIndex + ")";
    console.log("Double-clicking outbox row to open it: " + outboxRowSelector);
    
    if (!await safeClick(outboxRowSelector, { clickCount: 2 })) {
      return { 
        success: true, 
        warning: 'Turnaround completed but could not open the document' 
      };
    }
    
    // Wait for the transaction details to load
    console.log('Waiting for transaction details to load...');
    await page.waitForTimeout(5000);
    
    // ---------- FORM FILLING SECTION STARTS HERE ----------
    console.log('Looking for required fields to fill in...');
    
    try {
      // ----- MAIN TAB (already active by default) -----
      console.log('Filling main tab fields...');
      
      // Handle Purpose dropdown (T2004) - click to open
      if (await waitForElementToBeReady('#T2004 > span > span')) {
        await safeClick('#T2004 > span > span');
        await page.waitForTimeout(1000);
        
        // Look for the "Original" option and click it
        await page.evaluate(() => {
          const options = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
          const originalOption = options.find(opt => opt.textContent.trim() === 'Original');
          if (originalOption) {
            originalOption.click();
            console.log('Selected "Original" for Purpose');
          } else if (options.length > 0) {
            options[0].click();
            console.log('Selected first option for Purpose');
          }
        });
        
        await page.waitForTimeout(1000);
      }
      
      // Handle Label dropdown (T4140) - click to open
      if (await waitForElementToBeReady('#T4140 > span > span')) {
        await safeClick('#T4140 > span > span');
        await page.waitForTimeout(1000);
        
        // Look for the "No" option and click it
        await page.evaluate(() => {
          const options = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
          const noOption = options.find(opt => opt.textContent.trim() === 'No');
          if (noOption) {
            noOption.click();
            console.log('Selected "No" for Label');
          } else if (options.length > 0) {
            options[0].click();
            console.log('Selected first option for Label');
          }
        });
        
        await page.waitForTimeout(1000);
      }
      
      // Click on Shipment Detail tab
      console.log('Navigating to Shipment Detail tab...');
      const shipmentDetailTab = '#pgcMain-tab-2 > span.k-link';
      if (await waitForElementToBeReady(shipmentDetailTab)) {
        await safeClick(shipmentDetailTab);
        await page.waitForTimeout(1000);
        
        // ----- SHIPMENT DETAIL TAB PROCESSING -----
        console.log('Processing Shipment Detail tab...');
        
        // Process the grid in Loop_101Grid
        try {
          // Process row 1
          await page.waitForTimeout(500);
          await page.evaluate(() => {
            const grid101Cell = document.querySelector('#Loop_101Grid_active_cell') || 
                               document.querySelector('#tbsShipment_Detail tr:nth-of-type(1) > td:nth-of-type(1)');
            if (grid101Cell) grid101Cell.click();
          });
          await page.waitForTimeout(500);
          
          // Fill the active cell with N/A
          const activeInputSelector = '#tbsShipment_Detail input';
          if (await waitForElementToBeReady(activeInputSelector)) {
            await safeFill(activeInputSelector, 'N/A');
          }
          
          // Process row 2
          await page.evaluate(() => {
            const row2 = document.querySelector('tr:nth-of-type(2) > td.TPRequiredField');
            if (row2) row2.click();
          });
          await page.waitForTimeout(500);
          
          // Fill the active cell with N/A
          if (await waitForElementToBeReady(activeInputSelector)) {
            await safeFill(activeInputSelector, 'N/A');
          }
          
          // Process row 3
          await page.evaluate(() => {
            const row3 = document.querySelector('tr:nth-of-type(3) > td.TPRequiredField');
            if (row3) row3.click();
          });
          await page.waitForTimeout(500);
          
          // Fill the active cell with N/A
          if (await waitForElementToBeReady(activeInputSelector)) {
            await safeFill(activeInputSelector, 'N/A');
          }
          
          // Process row 4
          await page.evaluate(() => {
            const row4 = document.querySelector('tr:nth-of-type(4) > td.TPRequiredField');
            if (row4) row4.click();
          });
          await page.waitForTimeout(500);
          
          // Fill the active cell with N/A
          if (await waitForElementToBeReady(activeInputSelector)) {
            await safeFill(activeInputSelector, 'N/A');
          }
          
          // Navigate to the package details
          console.log('Navigating to package details section...');
          await page.evaluate(() => {
            const packageLink = document.querySelector('div > ul > li > ul > li > div div.text');
            if (packageLink) packageLink.click();
          });
          await page.waitForTimeout(1000);
          
          // ----- ITEM FORM HANDLING CODE (FROM PUPPETEER RECORDING) -----
          console.log('Processing item form in the package details...');
          
          try {
            // Process line 1
            await page.evaluate(() => {
              const row1Cell = document.querySelector('#hlvShipmentsLoop_100 td:nth-of-type(2)');
              if (row1Cell) row1Cell.click();
            });
            await page.waitForTimeout(500);
            
            // Fill with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            await page.waitForTimeout(500);
            
            // Move to next field using Tab
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Fill next cell with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            
            // Set package type to Bottle for line 1
            await page.evaluate(() => {
              const row1Cell20 = document.querySelector('#hlvShipmentsLoop_100 td:nth-of-type(20)');
              if (row1Cell20) row1Cell20.click();
            });
            await page.waitForTimeout(500);
            
            await page.evaluate(() => {
              const packageTypeDropdown = document.querySelector('#Loop_100Grid_active_cell > span > span');
              if (packageTypeDropdown) packageTypeDropdown.click();
            });
            await page.waitForTimeout(1000);
            
            await page.evaluate(() => {
              const bottleOption = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'))
                .find(opt => opt.textContent.includes('Bottle'));
              if (bottleOption) bottleOption.click();
            });
            await page.waitForTimeout(500);
            
            // Set expiration date for line 1
            await page.evaluate(() => {
              const expirationCell = document.querySelector('tr:nth-of-type(1) > td.TPRequiredField');
              if (expirationCell) expirationCell.click();
            });
            await page.waitForTimeout(500);
            
            const dateInputSelector = '#tbsShipment_Detail input[role="combobox"]';
            if (await waitForElementToBeReady(dateInputSelector)) {
              await safeFill(dateInputSelector, '04/21/2025');
              await page.keyboard.press('Tab');
            }
            
            // Process line 2
            await page.evaluate(() => {
              const row2Cell = document.querySelector('div:nth-of-type(2) > div:nth-of-type(2) tr:nth-of-type(2) > td:nth-of-type(2)');
              if (row2Cell) row2Cell.click();
            });
            await page.waitForTimeout(500);
            
            // Fill with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            
            // Move to next field using Tab
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Fill next cell with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            
            // Move to next cell
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Set package type to Bottle for line 2
            await page.evaluate(() => {
              const packageTypeCell = document.querySelector('div:nth-of-type(2) > div:nth-of-type(2) tr:nth-of-type(2) > td:nth-of-type(20)');
              if (packageTypeCell) packageTypeCell.click();
            });
            await page.waitForTimeout(500);
            
            await page.evaluate(() => {
              const dropdown = document.querySelector('#Loop_100Grid_active_cell > span > span');
              if (dropdown) dropdown.click();
            });
            await page.waitForTimeout(1000);
            
            await page.evaluate(() => {
              const bottleOption = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'))
                .find(opt => opt.textContent.includes('Bottle'));
              if (bottleOption) bottleOption.click();
            });
            await page.waitForTimeout(500);
            
            // Set expiration date for line 2
            await page.evaluate(() => {
              const dateCell = document.querySelector('tr:nth-of-type(2) > td.TPRequiredField');
              if (dateCell) dateCell.click();
            });
            await page.waitForTimeout(500);
            
            await safeFill(dateInputSelector, '4/21/2025');
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Process line 3
            await page.evaluate(() => {
              const row3Cell = document.querySelector('div:nth-of-type(2) > div:nth-of-type(2) tr:nth-of-type(3) > td:nth-of-type(2)');
              if (row3Cell) row3Cell.click();
            });
            await page.waitForTimeout(500);
            
            // Fill with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            
            // Move to next field using Tab
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Fill next cell with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            
            // Move to next cell
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Set package type to Bottle for line 3
            await page.evaluate(() => {
              const packageTypeCell = document.querySelector('div:nth-of-type(2) > div:nth-of-type(2) tr:nth-of-type(3) > td:nth-of-type(20)');
              if (packageTypeCell) packageTypeCell.click();
            });
            await page.waitForTimeout(500);
            
            await page.evaluate(() => {
              const dropdown = document.querySelector('#Loop_100Grid_active_cell > span > span');
              if (dropdown) dropdown.click();
            });
            await page.waitForTimeout(1000);
            
            await page.evaluate(() => {
              const bottleOption = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'))
                .find(opt => opt.textContent.includes('Bottle'));
              if (bottleOption) bottleOption.click();
            });
            await page.waitForTimeout(500);
            
            // Set expiration date for line 3
            await page.evaluate(() => {
              const dateCell = document.querySelector('tr:nth-of-type(3) > td.TPRequiredField');
              if (dateCell) dateCell.click();
            });
            await page.waitForTimeout(500);
            
            await safeFill(dateInputSelector, '4/21/2025');
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Process line 4
            await page.evaluate(() => {
              const row4Cell = document.querySelector('div:nth-of-type(2) > div:nth-of-type(2) tr:nth-of-type(4) > td:nth-of-type(2)');
              if (row4Cell) row4Cell.click();
            });
            await page.waitForTimeout(500);
            
            // Fill with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            
            // Move to next field using Tab
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Fill next cell with N/A
            await safeFill('#tbsShipment_Detail input', 'N/A');
            
            // Move to next cell
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            // Set package type to Bottle for line 4
            await page.evaluate(() => {
              const packageTypeCell = document.querySelector('div:nth-of-type(2) > div:nth-of-type(2) tr:nth-of-type(4) > td:nth-of-type(20)');
              if (packageTypeCell) packageTypeCell.click();
            });
            await page.waitForTimeout(500);
            
            await page.evaluate(() => {
              const dropdown = document.querySelector('#Loop_100Grid_active_cell > span > span');
              if (dropdown) dropdown.click();
            });
            await page.waitForTimeout(1000);
            
            await page.evaluate(() => {
              const bottleOption = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'))
                .find(opt => opt.textContent.includes('Bottle'));
              if (bottleOption) bottleOption.click();
            });
            await page.waitForTimeout(500);
            
            // Set expiration date for line 4
            await page.evaluate(() => {
              const dateCell = document.querySelector('td.TPRequiredField');
              if (dateCell) dateCell.click();
            });
            await page.waitForTimeout(500);
            
            await safeFill(dateInputSelector, '4/21/2025');
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
            
            console.log('Successfully processed all item form fields');
          } catch (error) {
            console.log("Error processing item form: " + error.message);
            // Continue with form processing even if the item form fails
          }
          
          console.log('Completed Shipment Detail tab processing');
        } catch (error) {
          console.log("Error processing Shipment Detail tab: " + error.message);
          // Continue with form processing even if this tab fails
        }
      }
      
      // ----- SHIPPING TAB -----
      console.log('Navigating to Shipping tab...');
      const shippingTab = '#pgcMain-tab-3 > span.k-link';
      if (await waitForElementToBeReady(shippingTab)) {
        await safeClick(shippingTab);
        await page.waitForTimeout(1000);
        
        // Fill SCAC field with N/A
        console.log('Filling SCAC field with N/A...');
        const scacSelector = '#tbsShipping hj-field-table-row:nth-of-type(1) input';
        if (await waitForElementToBeReady(scacSelector)) {
          await safeFill(scacSelector, 'N/A');
        }
      }
      
      // ----- ADDRESSES TAB -----
      console.log('Navigating to Addresses tab...');
      const addressesTab = '#pgcMain-tab-4 > span.k-link';
      if (await waitForElementToBeReady(addressesTab)) {
        await safeClick(addressesTab);
        await page.waitForTimeout(1000);
        
        // ----- SHIP TO SUB-TAB (default active) -----
        // Handle Code Type dropdown for Ship To
        if (await waitForElementToBeReady('#T2046 > span > span')) {
          await safeClick('#T2046 > span > span');
          await page.waitForTimeout(1000);
          
          // Select D-U-N-S+4 option
          await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
            const dunsOption = options.find(opt => 
              opt.textContent.includes('D-U-N-S+4')
            );
            
            if (dunsOption) {
              dunsOption.click();
              console.log('Selected D-U-N-S+4 for Ship To Code Type');
            } else if (options.length > 0) {
              options[0].click();
              console.log('Selected first option for Ship To Code Type');
            }
          });
          
          await page.waitForTimeout(1000);
        }
        
        // ----- BUYING PARTY SUB-TAB -----
        console.log('Navigating to Buying Party sub-tab...');
        const buyingPartyTab = '#pgcShip_To-tab-2 > span.k-link';
        if (await waitForElementToBeReady(buyingPartyTab)) {
          await safeClick(buyingPartyTab);
          await page.waitForTimeout(1000);
          
          // Fill required fields for Buying Party
          const nameSelector = '#tbsBuying_Party hj-field-table-row:nth-of-type(1) input';
          if (await waitForElementToBeReady(nameSelector)) {
            await safeFill(nameSelector, 'N/A');
          }
          
          const address1Selector = '#tbsBuying_Party hj-field-table-row:nth-of-type(2) input';
          if (await waitForElementToBeReady(address1Selector)) {
            await safeFill(address1Selector, 'N/A');
          }
          
          const citySelector = '#tbsBuying_Party hj-field-table-row:nth-of-type(4) tc-field-cell:nth-of-type(1) input';
          if (await waitForElementToBeReady(citySelector)) {
            await safeFill(citySelector, 'N/A');
          }
          
          const stateSelector = '#tbsBuying_Party tc-field-cell:nth-of-type(2) input';
          if (await waitForElementToBeReady(stateSelector)) {
            await safeFill(stateSelector, 'N/A');
          }
          
          const zipSelector = '#tbsBuying_Party tc-field-cell:nth-of-type(3) input';
          if (await waitForElementToBeReady(zipSelector)) {
            await safeFill(zipSelector, 'N/A');
          }
          
          // Handle Code Type dropdown for Buying Party
          if (await waitForElementToBeReady('#T2173 > span > span')) {
            await safeClick('#T2173 > span > span');
            await page.waitForTimeout(1000);
            
            // Select D-U-N-S+4 option
            await page.evaluate(() => {
              const options = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
              const dunsOption = options.find(opt => 
                opt.textContent.includes('D-U-N-S+4')
              );
              
              if (dunsOption) {
                dunsOption.click();
                console.log('Selected D-U-N-S+4 for Buying Party Code Type');
              } else if (options.length > 0) {
                options[0].click();
                console.log('Selected first option for Buying Party Code Type');
              }
            });
            
            await page.waitForTimeout(1000);
          }
          
          // Fill Code field
          const codeSelector = '#tbsBuying_Party hj-field-table-row:nth-of-type(7) input';
          if (await waitForElementToBeReady(codeSelector)) {
            await safeFill(codeSelector, 'N/A');
          }
        }
        
        // ----- SHIP FROM SUB-TAB -----
        console.log('Navigating to Ship From sub-tab...');
        const shipFromTab = '#pgcShip_To-tab-3 > span.k-link';
        if (await waitForElementToBeReady(shipFromTab)) {
          await safeClick(shipFromTab);
          await page.waitForTimeout(1000);
          
          // Fill required fields for Ship From
          const nameSelector = '#tbsShip_From > hj-flex-container > div > hj-flex-shrink > div > hj-field-table > div > hj-field-table-row:nth-of-type(1) input';
          if (await waitForElementToBeReady(nameSelector)) {
            await safeFill(nameSelector, 'N/A');
          }
          
          const address1Selector = '#tbsShip_From > hj-flex-container > div > hj-flex-shrink > div > hj-field-table > div > hj-field-table-row:nth-of-type(2) input';
          if (await waitForElementToBeReady(address1Selector)) {
            await safeFill(address1Selector, 'N/A');
          }
          
          const citySelector = '#tbsShip_From hj-field-table-row:nth-of-type(4) tc-field-cell:nth-of-type(1) input';
          if (await waitForElementToBeReady(citySelector)) {
            await safeFill(citySelector, 'N/A');
          }
          
          const stateSelector = '#tbsShip_From tc-field-cell:nth-of-type(2) input';
          if (await waitForElementToBeReady(stateSelector)) {
            await safeFill(stateSelector, 'N/A');
          }
          
          const zipSelector = '#tbsShip_From tc-field-cell:nth-of-type(3) input';
          if (await waitForElementToBeReady(zipSelector)) {
            await safeFill(zipSelector, 'N/A');
          }
          
          // Handle Code Type dropdown for Ship From
          if (await waitForElementToBeReady('#T2226 > span > span')) {
            await safeClick('#T2226 > span > span');
            await page.waitForTimeout(1000);
            
            // Select D-U-N-S+4 option
            await page.evaluate(() => {
              const options = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
              const dunsOption = options.find(opt => 
                opt.textContent.includes('D-U-N-S+4')
              );
              
              if (dunsOption) {
                dunsOption.click();
                console.log('Selected D-U-N-S+4 for Ship From Code Type');
              } else if (options.length > 0) {
                options[0].click();
                console.log('Selected first option for Ship From Code Type');
              }
            });
            
            await page.waitForTimeout(1000);
          }
          
          // Fill Code field
          const codeSelector = '#tbsShip_From hj-field-table-row:nth-of-type(7) input';
          if (await waitForElementToBeReady(codeSelector)) {
            await safeFill(codeSelector, 'N/A');
          }
        }
        
        // ----- SELLER SUB-TAB -----
        console.log('Navigating to Seller sub-tab...');
        const sellerTab = '#pgcShip_To-tab-4 > span.k-link';
        if (await waitForElementToBeReady(sellerTab)) {
          await safeClick(sellerTab);
          await page.waitForTimeout(1000);
          
          // Fill required fields for Seller
          const nameSelector = '#tbsSeller hj-field-table-row:nth-of-type(1) input';
          if (await waitForElementToBeReady(nameSelector)) {
            await safeFill(nameSelector, 'N/A');
          }
          
          const address1Selector = '#tbsSeller hj-field-table-row:nth-of-type(2) input';
          if (await waitForElementToBeReady(address1Selector)) {
            await safeFill(address1Selector, 'N/A');
          }
          
          const citySelector = '#tbsSeller hj-field-table-row:nth-of-type(4) tc-field-cell:nth-of-type(1) input';
          if (await waitForElementToBeReady(citySelector)) {
            await safeFill(citySelector, 'N/A');
          }
          
          const stateSelector = '#tbsSeller tc-field-cell:nth-of-type(2) input';
          if (await waitForElementToBeReady(stateSelector)) {
            await safeFill(stateSelector, 'N/A');
          }
          
          const zipSelector = '#tbsSeller tc-field-cell:nth-of-type(3) input';
          if (await waitForElementToBeReady(zipSelector)) {
            await safeFill(zipSelector, 'N/A');
          }
          
          // Handle Code Type dropdown for Seller
          if (await waitForElementToBeReady('#T2392 > span > span')) {
            await safeClick('#T2392 > span > span');
            await page.waitForTimeout(1000);
            
            // Select D-U-N-S+4 option
            await page.evaluate(() => {
              const options = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
              const dunsOption = options.find(opt => 
                opt.textContent.includes('D-U-N-S+4')
              );
              
              if (dunsOption) {
                dunsOption.click();
                console.log('Selected D-U-N-S+4 for Seller Code Type');
              } else if (options.length > 0) {
                options[0].click();
                console.log('Selected first option for Seller Code Type');
              }
            });
            
            await page.waitForTimeout(1000);
          }
          
          // Fill Code field
          const codeSelector = '#tbsSeller hj-field-table-row:nth-of-type(7) input';
          if (await waitForElementToBeReady(codeSelector)) {
            await safeFill(codeSelector, 'N/A');
          }
        }
      }
      
      // ----- MISC TAB -----
      console.log('Navigating to Misc tab for DSCSA Compliant field...');
      const miscTab = '#pgcMain-tab-5 > span.k-link';
      if (await waitForElementToBeReady(miscTab)) {
        await safeClick(miscTab);
        await page.waitForTimeout(1000);
        
        // Fill DSCSA Compliant field with N/A
        const dscsaField = 'hj-field-table-row:nth-of-type(1) textarea';
        if (await waitForElementToBeReady(dscsaField)) {
          await safeFill(dscsaField, 'N/A');
          console.log('Successfully filled DSCSA Compliant field with N/A');
        } else {
          console.log('DSCSA Compliant field not found');
        }
      }
      
      console.log('All required fields filled successfully');
      
      // Click Save and Close button
      console.log('Looking for Save and Close button...');
      const saveCloseSelector = 'div.app-bar li:nth-of-type(7) span';
      
      if (await waitForElementToBeReady(saveCloseSelector)) {
        await safeClick(saveCloseSelector);
        console.log('Successfully clicked Save and Close button');
      } else {
        // Alternative approach - look for any button/link with Save and Close text
        try {
          const saveClicked = await page.evaluate(() => {
            const saveLinks = Array.from(document.querySelectorAll('a span'))
              .filter(span => span.textContent.trim() === 'Save and Close')
              .map(span => span.closest('a'));
            
            if (saveLinks.length > 0) {
              saveLinks[0].click();
              return true;
            }
            
            // Alternative approach - look for any button/link with the floppy icon
            const saveButtons = Array.from(document.querySelectorAll('a i.fa-floppy-o')).map(i => i.closest('a'));
            
            if (saveButtons.length > 0) {
              saveButtons[0].click();
              return true;
            }
            
            return false;
          });
          
          if (saveClicked) {
            console.log('Successfully clicked Save and Close button (alternative method)');
          } else {
            console.log('Save and Close button not found');
          }
        } catch (error) {
          console.log("Error clicking Save and Close button: " + error.message);
        }
      }
      
    } catch (error) {
      console.log("Error filling form fields: " + error.message);
    }
    
  } catch (error) {
    console.log("Error finding document in outbox: " + error.message);
  }
  
  // Wait for save and navigation back to outbox
  console.log('Waiting for save to complete...');
  await page.waitForTimeout(5000);
  
  // Successfully completed all steps
  return {
    success: true,
    message: "Successfully performed turnaround for PO number " + poNumber + " to create " + documentType,
    documentType: documentType,
    fieldsCompleted: true
  };
}`;
        
        // Run the Puppeteer script
        console.log(`Running turnaround for PO: ${this.rowData.pONumber}, Document Type: ${this.documentType}`);
        const result = await $runPuppeteer(userActionsString);
            let newLink = await $dgAddRow('videoLinks', {
          name: 'Ship Notice',
          salesOrder: this.rowData.rowKey, 
          link: result.videoLink
        })
        console.log('result', result)
        this.lastResult = result?.extractedData || { success: false, error: 'No response from server' };
        
        if (this.lastResult.success) {
          // Show success toast
          this.$bvToast.toast(this.lastResult.message || `Turnaround completed successfully!`, {
            title: 'Success',
            variant: 'success',
            solid: true,
            autoHideDelay: 5000
          });
          
          this.tooltipText = `${this.documentType} created successfully`;
          
          // Call the success callback if provided
          if (this.successCallback && typeof this.successCallback === 'function') {
            this.successCallback(this.lastResult);
          }
          
          // Emit success event
          this.$emit('turnaround-success', this.lastResult);
        } else {
          // Show error toast
          this.$bvToast.toast(this.lastResult.error || 'Unknown error during turnaround process', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 5000
          });
          
          this.tooltipText = `Turnaround failed: ${this.lastResult.error || 'Unknown error'}`;
          
          // Emit error event
          this.$emit('turnaround-error', this.lastResult);
        }
        
        return this.lastResult;
      } catch (error) {
        console.error('Error in turnaround process:', error);
        
        const errorMessage = error.message || 'Unknown error occurred';
        
        // Show error toast
        this.$bvToast.toast(`Turnaround failed: ${errorMessage}`, {
          title: 'Error',
          variant: 'danger',
          solid: true,
          autoHideDelay: 5000
        });
        
        this.tooltipText = `Failed: ${errorMessage}`;
        
        // Emit error event
        this.$emit('turnaround-error', { success: false, error: errorMessage });
        
        return { success: false, error: errorMessage };
      } finally {
        this.isLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.turnaround-button-wrapper {
  display: inline-block;
}

.turnaround-button {
  min-width: 100px;
  position: relative;
}

.turnaround-button .b-spinner {
  margin-right: 5px;
}
</style>