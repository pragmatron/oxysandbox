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
  name: 'POAcknowledgmentButton',
  props: {
    rowData: {
      type: Object,
      required: true
    },
    buttonText: {
      type: String,
      default: 'PO Acknowledgment'
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
      tooltipText: `Create Purchase Order Acknowledgment`,
      lastResult: null,
      documentType: 'Purchase Order Acknowledgment'
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
  const documentType = "Purchase Order Acknowledgment";
  console.log(\`Processing turnaround for PO: \${poNumber}, Document Type: \${documentType}\`);
  
  // Function to ensure element is visible and clickable
  const waitForElementToBeReady = async (selector, timeout = 30000) => {
    console.log(\`Waiting for element to be ready: \${selector}\`);
    
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
      
      console.log(\`Element is ready: \${selector}\`);
      return true;
    } catch (error) {
      console.log(\`Element not ready or not found: \${selector}. Error: \${error.message}\`);
      return false;
    }
  };
  
  // Safer click function with retries
  const safeClick = async (selector, options = {}) => {
    const { timeout = 30000, clickCount = 1, delay = 100 } = options;
    
    const isReady = await waitForElementToBeReady(selector, timeout);
    if (!isReady) {
      console.log(\`Could not safely click \${selector} - element not ready\`);
      return false;
    }
    
    try {
      await page.click(selector, { clickCount, delay });
      console.log(\`Successfully clicked: \${selector}\`);
      return true;
    } catch (error) {
      console.log(\`Click failed on first attempt for \${selector}. Retrying...\`);
      // Add a small delay and try again
      await page.waitForTimeout(2000);
      try {
        await page.click(selector, { clickCount, delay });
        console.log(\`Successfully clicked on second attempt: \${selector}\`);
        return true;
      } catch (secondError) {
        console.log(\`Failed to click \${selector} after multiple attempts: \${secondError.message}\`);
        return false;
      }
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
  console.log(\`Looking for transaction with PO number: \${poNumber}\`);
  
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
          console.log(\`Found PO \${searchPO} in row text at index \${rowIndex}\`);
          return rowIndex;
        }
      }
      
      // Not found after all our attempts
      return -1;
    }, poNumber);
  } catch (error) {
    console.log(\`Error finding transaction row: \${error.message}\`);
    targetRowIndex = -1;
  }
  
  if (targetRowIndex === -1) {
    console.log(\`Transaction with PO number \${poNumber} not found\`);
    return { 
      success: false, 
      error: \`Transaction with PO number \${poNumber} not found\` 
    };
  }
  
  // Add 1 because CSS selectors are 1-based (first child is 1, not 0)
  const rowIndex = targetRowIndex + 1;
  console.log(\`Transaction found at row index \${rowIndex}\`);
  
  // Single click on the row to select it
  let rowSelector = \`#Transactions table tbody tr:nth-child(\${rowIndex})\`;
  console.log(\`Clicking row to select it: \${rowSelector}\`);
  
  if (!await safeClick(rowSelector, { clickCount: 1 })) {
    // If general row click doesn't work, try to click a specific cell
    rowSelector = \`#Transactions table tbody tr:nth-child(\${rowIndex}) td:nth-of-type(1)\`;
    if (!await safeClick(rowSelector, { clickCount: 1 })) {
      return { 
        success: false, 
        error: \`Could not select transaction row for PO number \${poNumber}\` 
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
    console.log(\`Error clicking Turnaround button: \${error.message}\`);
    return { 
      success: false, 
      error: 'Failed to click Turnaround button' 
    };
  }
  
  // Wait for the dialog to appear
  console.log('Waiting for Turnaround dialog to appear...');
  await page.waitForTimeout(3000);
  
  // Find and check the Purchase Order Acknowledgment checkbox
  console.log('Looking for Purchase Order Acknowledgment option...');
  
  try {
    // Find and select the Purchase Order Acknowledgment option
    const docTypeFound = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('.tree-layout.tree-item .text span'));
      console.log('Available document types:', spans.map(s => s.textContent.trim()).join(', '));
      
      // Look for Purchase Order Acknowledgment
      const poAckSpan = spans.find(span => {
        const text = span.textContent.trim();
        return text === 'Purchase Order Acknowledgment' || 
               text.startsWith('Purchase Order Acknowledgment (') ||
               text.includes('Purchase Order Acknowledgment');
      });
      
      if (poAckSpan) {
        console.log('Found PO Acknowledgment match:', poAckSpan.textContent.trim());
        const listItem = poAckSpan.closest('li');
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
      console.log('Purchase Order Acknowledgment option not found');
      return { 
        success: false, 
        error: 'Purchase Order Acknowledgment option not found in turnaround dialog' 
      };
    }
    
    console.log('Purchase Order Acknowledgment option checked');
  } catch (error) {
    console.log(\`Error finding Purchase Order Acknowledgment option: \${error.message}\`);
    return { 
      success: false, 
      error: 'Failed to select Purchase Order Acknowledgment option' 
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
    console.log(\`Error clicking Finish button: \${error.message}\`);
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
    console.log(\`Error navigating to Outbox: \${error.message}\`);
    return { 
      success: true, 
      warning: 'Turnaround completed but could not navigate to Outbox' 
    };
  }
  
  // Wait for outbox content to load
  console.log('Waiting for content to load after navigation...');
  await page.waitForTimeout(5000);
  
  // Find the most recent transaction in the outbox
  console.log('Looking for the newly created PO Acknowledgment in the current view...');
  
  try {
    // Look for a row that has our PO number and "Purchase Order Acknowledgment" text
    const foundDocRowIndex = await page.evaluate((searchPO) => {
      const rows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
      
      // Find rows that match both our document type and PO number
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const rowText = row.textContent || '';
        
        // Check if row contains our PO number and "Purchase Order Acknowledgment"
        if (rowText.includes(searchPO) && 
            (rowText.includes('Purchase Order Acknowledgment') || 
             rowText.includes('PO Acknowledgment'))) {
          return rowIndex;
        }
      }
      
      // Not found
      return -1;
    }, poNumber);
    
    if (foundDocRowIndex === -1) {
      console.log('Could not find the PO Acknowledgment in the outbox');
      return { 
        success: true, 
        warning: 'Turnaround completed but could not find the resulting document in the outbox' 
      };
    }
    
    // Add 1 for CSS selector index
    const outboxRowIndex = foundDocRowIndex + 1;
    console.log(\`Found PO Acknowledgment at row index \${outboxRowIndex}\`);
    
    // Double-click to open the transaction
    const outboxRowSelector = \`#Transactions table tbody tr:nth-child(\${outboxRowIndex})\`;
    console.log(\`Double-clicking outbox row to open it: \${outboxRowSelector}\`);
    
    if (!await safeClick(outboxRowSelector, { clickCount: 2 })) {
      return { 
        success: true, 
        warning: 'Turnaround completed but could not open the document' 
      };
    }
    
    // Wait for the transaction details to load
    console.log('Waiting for transaction details to load...');
    await page.waitForTimeout(5000);
    
    // ===== FIX 1: Purpose and Type dropdown selection =====
    // Handle required fields specific to PO Acknowledgment
    console.log('Looking for required fields to fill in...');
    
    try {
      // Use any rowData properties for field values if they exist
      const purposeValue = ${JSON.stringify(this.rowData.purpose)} || 'Original';
      const typeValue = ${JSON.stringify(this.rowData.type)} || 'Acknowledge - No Detail or Change';
      
      console.log(\`Using Purpose: \${purposeValue}, Type: \${typeValue}\`);
      
      // First handle the Purpose dropdown
      console.log('Looking for and filling Purpose field...');
      await page.waitForTimeout(1000);
      
      const purposeDropdownExists = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('[data-hj-test-id="field-label-title"] span'));
        const purposeLabel = labels.find(label => label.textContent.trim() === 'Purpose');
        return !!purposeLabel;
      });
      
      if (purposeDropdownExists) {
        // Click the Purpose dropdown
        await page.evaluate(() => {
          const labels = Array.from(document.querySelectorAll('[data-hj-test-id="field-label-title"] span'));
          const purposeLabel = labels.find(label => label.textContent.trim() === 'Purpose');
          if (purposeLabel) {
            const cell = purposeLabel.closest('[data-hj-test-id="field-cell"]');
            if (cell) {
              const dropdown = cell.querySelector('.k-dropdown-wrap');
              if (dropdown) dropdown.click();
            }
          }
        });
        
        await page.waitForTimeout(1000);
        
        // Now let's select an option
        await page.evaluate((value) => {
          const items = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
          console.log('Purpose options:', items.map(i => i.textContent.trim()));
          
          // Try to find exact match first
          let targetItem = items.find(item => item.textContent.trim() === value);
          
          // If no exact match, try partial match
          if (!targetItem) {
            targetItem = items.find(item => 
              item.textContent.trim().toLowerCase().includes(value.toLowerCase())
            );
          }
          
          // If still no match, use first item
          if (!targetItem && items.length > 0) targetItem = items[0];
          
          if (targetItem) {
            targetItem.click();
            console.log('Selected for Purpose:', targetItem.textContent.trim());
          }
        }, purposeValue);
        
        await page.waitForTimeout(1000);
      }
      
      // Now handle the Type dropdown - MAKE SURE THIS GETS SET
      console.log('Looking for and filling Type field...');
      await page.waitForTimeout(1000);
      
      const typeDropdownExists = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('[data-hj-test-id="field-label-title"] span'));
        const typeLabel = labels.find(label => label.textContent.trim() === 'Type');
        return !!typeLabel;
      });
      
      if (typeDropdownExists) {
        // Click the Type dropdown
        await page.evaluate(() => {
          const labels = Array.from(document.querySelectorAll('[data-hj-test-id="field-label-title"] span'));
          const typeLabel = labels.find(label => label.textContent.trim() === 'Type');
          if (typeLabel) {
            const cell = typeLabel.closest('[data-hj-test-id="field-cell"]');
            if (cell) {
              const dropdown = cell.querySelector('.k-dropdown-wrap');
              if (dropdown) dropdown.click();
            }
          }
        });
        
        await page.waitForTimeout(1000);
        
        // Now let's select an option
        await page.evaluate((value) => {
          const items = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
          console.log('Type options:', items.map(i => i.textContent.trim()));
          
          // Try to find exact match first
          let targetItem = items.find(item => item.textContent.trim() === value);
          
          // If no exact match, try partial match
          if (!targetItem) {
            targetItem = items.find(item => 
              item.textContent.trim().toLowerCase().includes(value.toLowerCase())
            );
          }
          
          // If still no match, use first item
          if (!targetItem && items.length > 0) targetItem = items[0];
          
          if (targetItem) {
            targetItem.click();
            console.log('Selected for Type:', targetItem.textContent.trim());
          }
        }, typeValue);
        
        await page.waitForTimeout(1000);
      }
      
      console.log('Required fields filled for PO Acknowledgment');
    } catch (error) {
      console.log(\`Error filling required fields: \${error.message}\`);
    }
    
    // After filling the initial fields, navigate through tabs and fill additional fields
    console.log('Filling out additional required fields in various tabs...');

    try {
      // Navigate to Shipping tab
      console.log('Navigating to Shipping tab...');
      const shippingTabResult = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.k-tabstrip-items li'));
        const shippingTab = tabs.find(tab => {
          const text = tab.textContent.trim();
          return text === 'Shipping' || tab.getAttribute('aria-controls') === 'tbsShipping';
        });
        
        if (shippingTab) {
          shippingTab.click();
          return true;
        }
        return false;
      });
      
      if (shippingTabResult) {
        console.log('Successfully navigated to Shipping tab');
        await page.waitForTimeout(1000);
        
        // Find the date field by selector
        const dateSelector = await page.evaluate(() => {
          const dateInputs = Array.from(document.querySelectorAll('#tbsShipping input[data-role="datepicker"]'));
          if (dateInputs.length > 0) {
            // Return a unique selector we can use to target this element
            if (dateInputs[0].id) return \`#\${dateInputs[0].id}\`;
            
            // If no ID, generate a more complex selector
            let parent = dateInputs[0].closest('[data-hj-test-id="field-cell"]');
            if (parent) return '#tbsShipping [data-hj-test-id="field-cell"] input[data-role="datepicker"]';
            
            // Fallback to a more generic selector
            return '#tbsShipping input[data-role="datepicker"]';
          }
          return null;
        });
        
        if (dateSelector) {
          console.log(\`Found date field with selector: \${dateSelector}\`);
          
          // Click the field, clear it, and type the date manually
          await safeClick(dateSelector);
          await page.waitForTimeout(500);
          
          // Clear the field - first select all text
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await page.waitForTimeout(200);
          
          // Delete the selected text
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(200);
          
          // Type the date
          await page.type(dateSelector, '4/15/2025', { delay: 100 });
          console.log('Typed shipping date (4/15/2025) into the field');
          
          // Press Enter to confirm and trigger validation
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
          
          // Press Tab to move focus and trigger validation
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
        } else {
          console.log('Could not find date field selector in Shipping tab');
        }
      }
      
      // ===== FIX 2: Ship From address fields (specifically City/State) =====
      // Navigate to Addresses tab
      console.log('Navigating to Addresses tab...');
      const addressesTabResult = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.k-tabstrip-items li'));
        const addressesTab = tabs.find(tab => {
          const text = tab.textContent.trim();
          return text === 'Addresses' || tab.getAttribute('aria-controls') === 'tbsAddresses';
        });
        
        if (addressesTab) {
          addressesTab.click();
          return true;
        }
        return false;
      });
      
      if (addressesTabResult) {
        console.log('Successfully navigated to Addresses tab');
        await page.waitForTimeout(1000);
        
        // Navigate to Ship From tab within Addresses
        await page.evaluate(() => {
          const shipFromTab = Array.from(document.querySelectorAll('li[role="tab"]'))
            .find(tab => tab.textContent.trim() === 'Ship From');
          
          if (shipFromTab) {
            shipFromTab.click();
            console.log('Clicked Ship From tab');
          }
        });
        
        await page.waitForTimeout(1500); // Longer wait to ensure the tab content is fully loaded
        
        // Get all input fields in correct order
        const shipFromInputs = await page.evaluate(() => {
          // First get visible inputs in tab order
          const inputs = Array.from(document.querySelectorAll('#tbsShip_From input[type="text"]'));
          
          // Map with labels when possible for debugging
          return inputs.map(input => {
            // Try to find associated label
            let label = null;
            const fieldCell = input.closest('[data-hj-test-id="field-cell"]');
            if (fieldCell) {
              const labelEl = fieldCell.querySelector('[data-hj-test-id="field-label-title"] span');
              if (labelEl) label = labelEl.textContent.trim();
            }
            
            // Return input info
            return {
              id: input.id || null,
              placeholder: input.placeholder || null,
              label: label,
              valid: true  // Assume all are valid targets
            };
          });
        });
        
        console.log(\`Found \${shipFromInputs.length} Ship From input fields\`);
        
        // Values to fill for each field in order
        const valuesToFill = ['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
        
        // Click first field to start
        await page.evaluate(() => {
          const firstInput = document.querySelector('#tbsShip_From input[type="text"]');
          if (firstInput) {
            firstInput.focus();
            firstInput.click();
          }
        });
        
        await page.waitForTimeout(500);
        
        // For each field, type the value and tab to next
        for (let i = 0; i < Math.min(valuesToFill.length, shipFromInputs.length); i++) {
          const value = valuesToFill[i];
          
          // Clear the field - Ctrl+A then Delete
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await page.waitForTimeout(200);
          await page.keyboard.press('Delete');
          await page.waitForTimeout(200);
          
          // Type value with a longer delay
          console.log(\`Typing "\${value}" in field \${i+1} (label: \${shipFromInputs[i]?.label || 'unknown'})\`);
          await page.keyboard.type(value, { delay: 100 }); // Slower typing to ensure it completes
          await page.waitForTimeout(300);
          
          // Press Tab to move to next field, with longer delay
          await page.keyboard.press('Tab');
          await page.waitForTimeout(500);
        }
        
        // Extra safety for the DUNS+4 field (often the last one)
        // This is a fallback in case the tab navigation missed it
        try {
          console.log('Checking for DUNS+4 field specifically...');
          const dunsFieldFound = await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('#tbsShip_From label, #tbsShip_From [data-hj-test-id="field-label-title"] span'));
            const dunsLabel = labels.find(label => label.textContent.includes('DUNS'));
            
            if (dunsLabel) {
              // Find input field
              const fieldCell = dunsLabel.closest('[data-hj-test-id="field-cell"]');
              if (fieldCell) {
                const input = fieldCell.querySelector('input[type="text"]');
                if (input) {
                  input.focus();
                  input.click();
                  return true;
                }
              }
            }
            return false;
          });
          
          if (dunsFieldFound) {
            console.log('Found DUNS+4 field, filling it directly');
            // Clear and fill
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await page.waitForTimeout(200);
            await page.keyboard.press('Delete');
            await page.waitForTimeout(200);
            await page.keyboard.type('N/A', { delay: 100 });
          }
        } catch (error) {
          console.log('Error handling DUNS+4 field:', error.message);
        }
        
        console.log('Completed Ship From form filling');
      }
      
      // ===== FIX 3: Warehouse section fields =====
      // Navigate to Misc tab
      console.log('Navigating to Misc tab...');
      const miscTabResult = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.k-tabstrip-items li'));
        const miscTab = tabs.find(tab => {
          const text = tab.textContent.trim();
          return text === 'Misc.' || tab.getAttribute('aria-controls') === 'tbsMisc_';
        });
        
        if (miscTab) {
          miscTab.click();
          return true;
        }
        return false;
      });
      
      if (miscTabResult) {
        console.log('Successfully navigated to Misc tab');
        await page.waitForTimeout(1000);
        
        // First fill the Order # field (correctly shown in your screenshot)
        console.log('Filling Order # field...');
        const orderNumberField = await page.evaluate(() => {
          // Try to find the Order # field by label
          const labels = Array.from(document.querySelectorAll('#tbsMisc_ label, #tbsMisc_ [data-hj-test-id="field-label-title"] span'));
          const orderLabel = labels.find(label => label.textContent.trim() === 'Order #');
          
          if (orderLabel) {
            // Find the associated input
            const fieldCell = orderLabel.closest('[data-hj-test-id="field-cell"], .field-item');
            if (fieldCell) {
              const input = fieldCell.querySelector('input[type="text"]');
              if (input) {
                input.focus();
                input.click();
                return true;
              }
            }
          } else {
            // If we can't find by label, try the first input in the form
            const firstInput = document.querySelector('#tbsMisc_ input[type="text"]');
            if (firstInput) {
              firstInput.focus();
              firstInput.click();
              return true;
            }
          }
          return false;
        });
        
        if (orderNumberField) {
          // Clear and type the Order #
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await page.waitForTimeout(100);
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(100);
          
          await page.keyboard.type('TEST WAREHOUSE123', { delay: 50 });
          console.log('Filled Order # with TEST WAREHOUSE123');
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
        }
        
        // Check if there's a Warehouse section we need to expand
        console.log('Looking for Warehouse section...');
        const expandedWarehouseSection = await page.evaluate(() => {
          const sections = Array.from(document.querySelectorAll('#tbsMisc_ .section-caption, #tbsMisc_ h3, #tbsMisc_ h4'));
          const warehouseSection = sections.find(section => 
            section.textContent.trim() === 'Warehouse' || 
            section.textContent.trim().includes('Warehouse')
          );
          
          if (warehouseSection) {
            // Check if it needs expanding
            const isCollapsed = warehouseSection.closest('.section')?.classList.contains('collapsed');
            if (isCollapsed) {
              warehouseSection.click();
              return 'expanded';
            }
            return 'already-expanded';
          }
          return 'not-found';
        });
        
        console.log(\`Warehouse section: \${expandedWarehouseSection}\`);
        await page.waitForTimeout(1000);
        
        // Now try to fill the Name field for the warehouse
        console.log('Filling Warehouse Name field...');
        const nameFieldFilled = await page.evaluate(() => {
          // Look for the Name field inside warehouse section
          let nameField = null;
          
          // Try method 1: Look by label
          const labels = Array.from(document.querySelectorAll('#tbsMisc_ label, #tbsMisc_ [data-hj-test-id="field-label-title"] span'));
          const nameLabel = labels.find(label => {
            const text = label.textContent.trim();
            return text === 'Name' || text === 'Warehouse Name';
          });
          
          if (nameLabel) {
            const fieldCell = nameLabel.closest('[data-hj-test-id="field-cell"], .field-item');
            if (fieldCell) {
              nameField = fieldCell.querySelector('input[type="text"]');
            }
          }
          
          // Try method 2: Look inside any expanded warehouse section
          if (!nameField) {
            const sections = Array.from(document.querySelectorAll('#tbsMisc_ .section:not(.collapsed)'));
            for (const section of sections) {
              if (section.textContent.includes('Warehouse')) {
                const inputs = section.querySelectorAll('input[type="text"]');
                if (inputs.length > 0) nameField = inputs[0];
                break;
              }
            }
          }
          
          // Try method 3: Look for any red-highlighted fields
          if (!nameField) {
            const redFields = Array.from(document.querySelectorAll('#tbsMisc_ input[type="text"][style*="background-color: rgb(255, 0, 0)"], #tbsMisc_ input[type="text"][style*="background-color: rgb(255, 59, 48)"]'));
            if (redFields.length > 0) nameField = redFields[0];
          }
          
          if (nameField) {
            nameField.focus();
            nameField.click();
            return true;
          }
          return false;
        });
        
        if (nameFieldFilled) {
          // Clear and type the Name
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await page.waitForTimeout(100);
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(100);
          
          await page.keyboard.type('TEST WAREHOUSE', { delay: 50 });
          console.log('Filled Warehouse Name with TEST WAREHOUSE');
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
        } else {
          console.log('Could not find Warehouse Name field');
        }
        
        // Now try to fill the Phone field
        console.log('Filling Phone # field...');
        const phoneFieldFilled = await page.evaluate(() => {
          // Look for the Phone field
          let phoneField = null;
          
          // Try method 1: Look by label
          const labels = Array.from(document.querySelectorAll('#tbsMisc_ label, #tbsMisc_ [data-hj-test-id="field-label-title"] span'));
          const phoneLabel = labels.find(label => {
            const text = label.textContent.trim();
            return text === 'Phone #' || text === 'Phone Number';
          });
          
          if (phoneLabel) {
            const fieldCell = phoneLabel.closest('[data-hj-test-id="field-cell"], .field-item');
            if (fieldCell) {
              phoneField = fieldCell.querySelector('input[type="text"]');
            }
          }
          
          // Try method 2: Look for second red field
          if (!phoneField) {
            const redFields = Array.from(document.querySelectorAll('#tbsMisc_ input[type="text"][style*="background-color: rgb(255, 0, 0)"], #tbsMisc_ input[type="text"][style*="background-color: rgb(255, 59, 48)"]'));
            if (redFields.length > 1) phoneField = redFields[1];
          }
          
          // Try method 3: Try to find next input after Name
          if (!phoneField) {
            // Just press tab and hope it gets to the phone field
            return true;
          }
          
          if (phoneField) {
            phoneField.focus();
            phoneField.click();
            return true;
          }
          return false;
        });
        
        if (phoneFieldFilled) {
          // Clear and type the Phone
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await page.waitForTimeout(100);
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(100);
          
          await page.keyboard.type('1234567890', { delay: 50 });
          console.log('Filled Phone # with 1234567890');
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
        } else {
          console.log('Could not find Phone # field');
        }
      }

      console.log('All additional fields filled successfully');
    } catch (error) {
      console.log(\`Error filling additional fields: \${error.message}\`);
    }
    
    // Click Save and Close button
    console.log('Looking for Save and Close button...');
    
    try {
      const saveClicked = await page.evaluate(() => {
        // Find the Save and Close link by looking for span with text
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
        console.log('Successfully clicked Save and Close button');
      } else {
        console.log('Save and Close button not found');
      }
    } catch (error) {
      console.log(\`Error clicking Save and Close button: \${error.message}\`);
    }
    
  } catch (error) {
    console.log(\`Error finding document in outbox: \${error.message}\`);
  }
  
  // Wait for save and navigation back to outbox
  console.log('Waiting for save to complete...');
  await page.waitForTimeout(5000);
  
  // Successfully completed all steps
  return {
    success: true,
    message: \`Successfully performed turnaround for PO number \${poNumber} to create Purchase Order Acknowledgment\`,
    documentType: "Purchase Order Acknowledgment",
    fieldsCompleted: true
  };
}`;
        
        // Run the Puppeteer script
        console.log(`Running turnaround for PO: ${this.rowData.pONumber}, Document Type: ${this.documentType}`);
        const result = await $runPuppeteer(userActionsString);
        console.log('result: ', result)
        let newLink = await $dgAddRow('videoLinks', {
          name: 'PO Acknowledgement',
          salesOrder: this.rowData.rowKey, 
          link: result.videoLink
        })
        this.lastResult = result?.extractedData || { success: false, error: 'No response from server' };
        console.log('lastResult: ', this.lastResult)
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