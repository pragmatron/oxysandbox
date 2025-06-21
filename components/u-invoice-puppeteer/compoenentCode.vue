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
  name: 'InvoiceButton',
  props: {
    rowData: {
      type: Object,
      required: true
    },
    buttonText: {
      type: String,
      default: 'Invoice'
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
    }
  },
  data() {
    return {
      isLoading: false,
      buttonId: `turnaround-button-${Math.random().toString(36).substring(2, 9)}`,
      tooltipText: `Create Invoice`,
      lastResult: null,
      documentType: 'Invoice'
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
const userActionsString = `
async (page) => {
  const poNumber = ${JSON.stringify(this.rowData.pONumber)};
  const documentType = "Invoice";
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
  
  // Utility function to safely type into fields
  const safeType = async (selector, text, options = {}) => {
    const { timeout = 30000, delay = 100 } = options;
    
    const isReady = await waitForElementToBeReady(selector, timeout);
    if (!isReady) {
      console.log("Could not safely type into " + selector + " - element not ready");
      return false;
    }
    
    try {
      await page.click(selector);
      await page.type(selector, text, { delay });
      console.log("Successfully typed into: " + selector);
      return true;
    } catch (error) {
      console.log("Type operation failed for " + selector + ": " + error.message);
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
  
  // Find and check the Invoice checkbox
  console.log('Looking for Invoice option...');
  
  try {
    // Find and select the Invoice option
    const docTypeFound = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('.tree-layout.tree-item .text span'));
      console.log('Available document types:', spans.map(s => s.textContent.trim()).join(', '));
      
      // Special handling for Invoice to avoid "Grocery Products Invoice" etc.
      const exactInvoiceSpan = spans.find(span => {
        const text = span.textContent.trim();
        // Match "Invoice (ver. XXXX)" but not anything with text before "Invoice"
        return text === 'Invoice' || 
               text.startsWith('Invoice (') || 
               (text.includes('Invoice') && !text.includes('Grocery') && !text.includes('Import'));
      });
      
      if (exactInvoiceSpan) {
        console.log('Found Invoice match:', exactInvoiceSpan.textContent.trim());
        const listItem = exactInvoiceSpan.closest('li');
        if (listItem) {
          const checkbox = listItem.querySelector('.checkBox-wrapper');
          if (checkbox) {
            checkbox.click();
            return true;
          }
        }
      }
      
      return false;
    });
    
    if (!docTypeFound) {
      console.log('Invoice option not found');
      return { 
        success: false, 
        error: 'Invoice option not found in turnaround dialog' 
      };
    }
    
    console.log('Invoice option checked');
  } catch (error) {
    console.log("Error finding Invoice option: " + error.message);
    return { 
      success: false, 
      error: 'Failed to select Invoice option' 
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
  console.log('Looking for the newly created Invoice in the current view...');
  
  try {
    // Look for a row that has our PO number and "Invoice" text
    const foundDocRowIndex = await page.evaluate((searchPO) => {
      const rows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
      
      // Find rows that match both our document type and PO number
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const rowText = row.textContent || '';
        
        // Check if row contains our PO number and "Invoice"
        if (rowText.includes(searchPO) && rowText.includes('Invoice')) {
          return rowIndex;
        }
      }
      
      // Not found
      return -1;
    }, poNumber);
    
    if (foundDocRowIndex === -1) {
      console.log('Could not find the Invoice in the outbox');
      return { 
        success: true, 
        warning: 'Turnaround completed but could not find the resulting document in the outbox' 
      };
    }
    
    // Add 1 for CSS selector index
    const outboxRowIndex = foundDocRowIndex + 1;
    console.log("Found Invoice at row index " + outboxRowIndex);
    
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
    
    // ---- NEW SECTION: FILLING OUT REQUIRED FIELDS ----
    console.log('Starting to fill out required fields based on the recording...');
    
    // First, handle the dropdown for Type field (selecting "Debit Memo" as seen in the recording)
    try {
      // Find and click the Type dropdown
      const typeDropdownSelector = '#T2003 > span > span';
      if (await waitForElementToBeReady(typeDropdownSelector)) {
        await safeClick(typeDropdownSelector);
        
        // Wait for dropdown to open
        await page.waitForTimeout(1000);
        
        // Select "Debit Memo" option from dropdown
        // Instead of using the hover class which is timing dependent, use page.evaluate to find by text
        try {
          await page.waitForTimeout(1000);
          const debitMemoSelected = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
            const debitMemoItem = items.find(item => item.textContent.trim() === 'Debit Memo');
            if (debitMemoItem) {
              debitMemoItem.click();
              return true;
            }
            return false;
          });
          
          if (debitMemoSelected) {
            console.log('Successfully selected Debit Memo from Type dropdown');
          } else {
            console.log('Could not find Debit Memo option by text');
          }
        } catch (error) {
          console.log("Error selecting Debit Memo: " + error.message);
        }
      } else {
        console.log('Could not find Type dropdown');
      }
    } catch (error) {
      console.log("Error setting document type: " + error.message);
    }
    
    // Navigate to Items tab
    console.log('Navigating to Items tab...');
    const itemsTabSelector = '#pgcMain-tab-2 > span.k-link';
    if (await waitForElementToBeReady(itemsTabSelector)) {
      await safeClick(itemsTabSelector);
      console.log('Successfully clicked on Items tab');
      await page.waitForTimeout(2000);
    } else {
      console.log('Could not find Items tab');
    }
    
    // Fill in items grid fields with "N/A" values
    console.log('Starting to fill out items grid...');
    
    try {
      // Process each row in the items grid
      // For each row:
      // 1. Click the row
      // 2. Fill T3076 field with "N/A"
      // 3. Tab to next field and fill with "N/A"
      // 4. Continue as needed
      
      // Helper function to process a single row
      const processItemRow = async (rowNum) => {
        console.log("Processing item row " + rowNum + "...");
        
        // Click on the row to select it
        const rowSelector = "div:nth-of-type(2) > div:nth-of-type(2) tr:nth-of-type(" + rowNum + ") > td:nth-of-type(1)";
        if (!await safeClick(rowSelector)) {
          console.log("Could not select row " + rowNum);
          return false;
        }
        
        // Wait for row to be selected
        await page.waitForTimeout(1000);
        
        // Fill in T3076 field with "N/A"
        const t3076Selector = '#T3076';
        if (!await safeType(t3076Selector, 'N/A')) {
          console.log("Could not type into T3076 field for row " + rowNum);
          return false;
        }
        
        // Press Tab to move to next field
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        
        // Fill in first input field in the items grid with "N/A"
        const itemsInputSelector = '#tbsItems input';
        if (!await safeType(itemsInputSelector, 'N/A')) {
          console.log("Could not type into items input field for row " + rowNum);
          return false;
        }
        
        // Press Tab to move to next field
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        
        // Fill in second input field in the items grid with "N/A"
        if (!await safeType(itemsInputSelector, 'N/A')) {
          console.log("Could not type into second items input field for row " + rowNum);
          return false;
        }
        
        console.log("Successfully filled fields for row " + rowNum);
        return true;
      };
      
      // Process first four rows as seen in the recording
      for (let rowNum = 1; rowNum <= 4; rowNum++) {
        await processItemRow(rowNum);
        await page.waitForTimeout(1000);
      }
      
      console.log('Completed filling out items grid');
    } catch (error) {
      console.log("Error filling out items grid: " + error.message);
    }
    
    // Navigate to Addresses tab
    console.log('Navigating to Addresses tab...');
    const addressesTabSelector = '#pgcMain-tab-4 > span.k-link';
    if (await waitForElementToBeReady(addressesTabSelector)) {
      await safeClick(addressesTabSelector);
      console.log('Successfully clicked on Addresses tab');
      await page.waitForTimeout(2000);
      
      // Handle address dropdown as seen in recording
      const addressDropdownSelector = '#T2046 > span > span';
      if (await waitForElementToBeReady(addressDropdownSelector)) {
        await safeClick(addressDropdownSelector);
        await page.waitForTimeout(1000);
        
        // Select "Assigned by Buyer or Buyer's Agent" option from dropdown
        try {
          await page.waitForTimeout(1000);
          const addressOptionSelected = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
            const addressOption = items.find(item => 
              item.textContent.includes("Assigned by Buyer or Buyer's Agent"));
            if (addressOption) {
              addressOption.click();
              return true;
            }
            return false;
          });
          
          if (addressOptionSelected) {
            console.log("Successfully selected 'Assigned by Buyer or Buyer's Agent' option");
          } else {
            console.log("Could not find 'Assigned by Buyer or Buyer's Agent' option, trying first option");
            // Fallback to first option
            await page.evaluate(() => {
              const items = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
              if (items.length > 0) {
                items[0].click();
                return true;
              }
              return false;
            });
          }
        } catch (error) {
          console.log("Error selecting address option: " + error.message);
        }
      }
    } else {
      console.log('Could not find Addresses tab');
    }
    
    // Navigate to Misc tab
    console.log('Navigating to Misc tab...');
    const miscTabSelector = '#pgcMain-tab-5 > span.k-link';
    if (await waitForElementToBeReady(miscTabSelector)) {
      await safeClick(miscTabSelector);
      console.log('Successfully clicked on Misc tab');
      await page.waitForTimeout(2000);
      
      // Fill in required field in Misc tab
      const miscInputSelector = '#tbsMisc_ input';
      if (await waitForElementToBeReady(miscInputSelector)) {
        await safeClick(miscInputSelector);
        await page.waitForTimeout(500);
        await page.keyboard.type('N/A');
        console.log('Successfully filled Misc field with N/A');
      }
    } else {
      console.log('Could not find Misc tab');
    }
    
    // Finally, click Save and Close button
    console.log('Looking for Save and Close button in the top bar...');
    const saveCloseSelector = 'div.app-bar li:nth-of-type(7) span';
    if (await waitForElementToBeReady(saveCloseSelector)) {
      await safeClick(saveCloseSelector);
      console.log('Successfully clicked Save and Close button');
      await page.waitForTimeout(5000);
    } else {
      // Alternative approach - look for Save and Close link by text
      try {
        const saveClicked = await page.evaluate(() => {
          const saveLinks = Array.from(document.querySelectorAll('a span'))
            .filter(span => span.textContent.trim() === 'Save and Close')
            .map(span => span.closest('a'));
          
          if (saveLinks.length > 0) {
            saveLinks[0].click();
            return true;
          }
          return false;
        });
        
        if (saveClicked) {
          console.log('Successfully clicked Save and Close button (alternative method)');
          await page.waitForTimeout(5000);
        } else {
          console.log('Could not find Save and Close button');
        }
      } catch (error) {
        console.log("Error finding/clicking Save and Close button: " + error.message);
      }
    }
    
    console.log('Form filling process completed');
    
  } catch (error) {
    console.log("Error finding document in outbox: " + error.message);
  }
  
  // Successfully completed all steps
  return {
    success: true,
    message: "Successfully performed turnaround for PO number " + poNumber + " to create Invoice",
    documentType: "Invoice",
    fieldsCompleted: true
  };
}`;
        
        // Run the Puppeteer script
        console.log(`Running turnaround for PO: ${this.rowData.pONumber}, Document Type: ${this.documentType}`);
        const result = await $runPuppeteer(userActionsString);
         let newLink = await $dgAddRow('videoLinks', {
          name: 'Invoice',
          salesOrder: this.rowData.rowKey, 
          link: result.videoLink
        })
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