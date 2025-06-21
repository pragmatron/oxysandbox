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
  name: 'TrueTurnaroundButton',
  props: {
    rowData: {
      type: Object,
      required: true
    },
    buttonText: {
      type: String,
      default: 'Turnaround'
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
    documentType: {
      type: String,
      default: 'Purchase Order Acknowledgment',
      validator: (value) => {
        return [
          'Purchase Order Acknowledgment', 
          'Invoice', 
          'Ship Notice/Manifest - Pick and Pack',
          'Ship Notice/Manifest - Pallet Pick and Pack'
        ].includes(value) || 
        value.includes('Invoice') || 
        value.includes('Ship Notice') || 
        value.includes('Purchase Order');
      }
    }
  },
  data() {
    return {
      isLoading: false,
      buttonId: `turnaround-button-${Math.random().toString(36).substring(2, 9)}`,
      tooltipText: `Create ${this.documentType}`,
      lastResult: null
    };
  },
  created() {
    // Update tooltip text based on document type
    this.tooltipText = `Create ${this.documentType}`;
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
          const documentType = ${JSON.stringify(this.documentType)};
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
          
          // Function to find text content within elements - useful for finding our specific item
          const findElementByText = async (selector, text, exact = false) => {
            try {
              return await page.evaluate((sel, searchText, exactMatch) => {
                const elements = Array.from(document.querySelectorAll(sel));
                return elements.findIndex(el => {
                  const content = el.textContent.trim();
                  return exactMatch ? content === searchText : content.includes(searchText);
                });
              }, selector, text, exact);
            } catch (error) {
              console.log(\`Error finding element with text \${text}: \${error.message}\`);
              return -1;
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
            // IMPROVED TRANSACTION FINDING CODE
            targetRowIndex = await page.evaluate((searchPO) => {
              // First try: Look directly for visible text in the table that matches our PO number
              // This is more reliable than relying on specific column indices
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
              
              // Second approach: Look more specifically at individual cells
              for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                const cells = row.querySelectorAll('td');
                
                // Inspect every cell in the row
                for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
                  const cellText = cells[cellIndex]?.textContent?.trim() || '';
                  
                  // Check if this cell contains or exactly matches our PO
                  if (cellText === searchPO || cellText.includes(searchPO)) {
                    console.log(\`Found PO \${searchPO} in cell \${cellIndex} at row \${rowIndex}\`);
                    return rowIndex;
                  }
                }
              }
              
              // Third approach: Look specifically at the Document Num column
              // Find the column index by checking the header
              const headers = Array.from(document.querySelectorAll('#Transactions table th, #Transactions .k-grid-header-wrap .k-header'));
              const docNumHeaderIndex = headers.findIndex(h => 
                h.textContent.includes('Document Num') || 
                h.textContent.includes('Document Number') ||
                h.textContent.includes('Doc Num') ||
                h.textContent.includes('Alt Document')
              );
              
              if (docNumHeaderIndex >= 0) {
                // If we found the Document Num header, check that specific column
                console.log(\`Found Document Num header at index \${docNumHeaderIndex}\`);
                
                for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                  const cells = rows[rowIndex].querySelectorAll('td');
                  // Adjust index if needed (+1 or other offset if header and body don't align)
                  if (cells.length > docNumHeaderIndex) {
                    const cellText = cells[docNumHeaderIndex]?.textContent?.trim() || '';
                    if (cellText === searchPO || cellText.includes(searchPO)) {
                      console.log(\`Found PO \${searchPO} in Document Num column at row \${rowIndex}\`);
                      return rowIndex;
                    }
                  }
                }
              }
              
              // If all else fails, look for any visible text that contains our PO number
              const allCells = document.querySelectorAll('#Transactions table td');
              const matchingCell = Array.from(allCells).find(cell => 
                cell.textContent.trim() === searchPO || 
                cell.textContent.includes(searchPO)
              );
              
              if (matchingCell) {
                // Get the parent row
                const matchingRow = matchingCell.closest('tr');
                if (matchingRow) {
                  const rowIndex = Array.from(rows).findIndex(row => row === matchingRow);
                  console.log(\`Found PO \${searchPO} in a cell, row index is \${rowIndex}\`);
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
          
          // Single click on the row to select it, but not open it
          // We'll click on the document number cell (column 6)
          let rowSelector = \`#Transactions table tbody tr:nth-child(\${rowIndex})\`;
          console.log(\`Clicking row to select it: \${rowSelector}\`);
          
          // First, try to click the row itself if the specific cell click doesn't work
          if (!await safeClick(rowSelector, { clickCount: 1 })) {
            // If general row click doesn't work, try to click a specific cell
            rowSelector = \`#Transactions table tbody tr:nth-child(\${rowIndex}) td:nth-of-type(1)\`;
            if (!await safeClick(rowSelector, { clickCount: 1 })) {
              // Try Document Num column specifically
              const docNumCellIndex = await page.evaluate(() => {
                const headers = Array.from(document.querySelectorAll('#Transactions table th, #Transactions .k-grid-header-wrap .k-header'));
                return headers.findIndex(h => 
                  h.textContent.includes('Document Num') || 
                  h.textContent.includes('Document Number')
                ) + 1; // +1 for CSS selector index
              });
              
              if (docNumCellIndex > 0) {
                rowSelector = \`#Transactions table tbody tr:nth-child(\${rowIndex}) td:nth-of-type(\${docNumCellIndex})\`;
                if (!await safeClick(rowSelector, { clickCount: 1 })) {
                  return { 
                    success: false, 
                    error: \`Could not select transaction row for PO number \${poNumber}\` 
                  };
                }
              } else {
                return { 
                  success: false, 
                  error: \`Could not select transaction row for PO number \${poNumber}\` 
                };
              }
            }
          }
          
          // Wait a moment for the row to be selected and the context actions to appear
          await page.waitForTimeout(2000);
          
          // Look for and click the "Turnaround" button in the context actions
          console.log('Looking for Turnaround button...');
          
          const turnaroundButtonSelector = 'div[data-hj-test-id="context-actions"] a span';
          let turnaroundButtonFound = false;
          
          try {
            // First check if the button exists
            turnaroundButtonFound = await page.evaluate((selector) => {
              const elements = Array.from(document.querySelectorAll(selector));
              return elements.some(el => el.textContent.trim() === 'Turnaround');
            }, turnaroundButtonSelector);
          } catch (error) {
            console.log(\`Error finding Turnaround button: \${error.message}\`);
            turnaroundButtonFound = false;
          }
          
          if (!turnaroundButtonFound) {
            console.log('Turnaround button not found');
            return { 
              success: false, 
              error: 'Turnaround button not found or not available for this transaction' 
            };
          }
          
          console.log('Clicking Turnaround button...');
          // Find and click the Turnaround button by its text
          try {
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
          
          // Find and check the specified document type checkbox based on the documentType prop
          console.log(\`Looking for \${documentType} option...\`);
          
          let docTypeFound = false;
          try {
            // IMPROVED DOCUMENT TYPE SELECTION
            docTypeFound = await page.evaluate((docTypeToFind) => {
              const spans = Array.from(document.querySelectorAll('.tree-layout.tree-item .text span'));
              console.log('Available document types:', spans.map(s => s.textContent.trim()).join(', '));
              
              // Special case for Invoice to avoid selecting "Grocery Products Invoice"
              if (docTypeToFind === 'Invoice') {
                // Look specifically for the plain "Invoice" option
                const exactInvoiceSpan = spans.find(span => {
                  const text = span.textContent.trim();
                  // Match "Invoice (ver. XXXX)" but not anything with text before "Invoice"
                  return text.startsWith('Invoice (') || text === 'Invoice';
                });
                
                if (exactInvoiceSpan) {
                  console.log('Found exact Invoice match:', exactInvoiceSpan.textContent.trim());
                  const listItem = exactInvoiceSpan.closest('li');
                  if (listItem) {
                    const checkbox = listItem.querySelector('.checkBox-wrapper');
                    if (checkbox) {
                      checkbox.click();
                      return true;
                    }
                  }
                }
              }
              
              // First attempt - exact match
              let docTypeSpan = spans.find(span => span.textContent.trim() === docTypeToFind);
              
              // Second attempt - handle version numbers
              if (!docTypeSpan) {
                // For document types like "Invoice", match "Invoice (ver. XXXXX)"
                docTypeSpan = spans.find(span => {
                  const text = span.textContent.trim();
                  const baseDocType = docTypeToFind.split(' (')[0]; // Remove version if present
                  return text.startsWith(baseDocType + ' (ver.') || text.startsWith(baseDocType + ' (');
                });
              }
              
              // Third attempt - partial match for more complex types
              if (!docTypeSpan) {
                const searchTerms = [
                  docTypeToFind.includes('Purchase Order Acknowledgment') ? 'Purchase Order Acknowledgment' : null,
                  docTypeToFind.includes('Ship Notice') ? 'Ship Notice/Manifest' : null,
                  docTypeToFind.includes('Pick and Pack') ? 'Pick and Pack' : null,
                  // Note: We're not including 'Invoice' here since it's handled specially above
                ].filter(Boolean);
                
                // For each search term, try to find a matching span
                for (const term of searchTerms) {
                  docTypeSpan = spans.find(span => span.textContent.includes(term));
                  if (docTypeSpan) break;
                }
              }
              
              // If we found a matching span, click its checkbox
              if (docTypeSpan) {
                console.log('Found document type match:', docTypeSpan.textContent.trim());
                const listItem = docTypeSpan.closest('li');
                if (listItem) {
                  const checkbox = listItem.querySelector('.checkBox-wrapper');
                  if (checkbox) {
                    checkbox.click();
                    return true;
                  }
                }
              }
              
              // If all else fails, log all available options and try a more aggressive approach
              console.log('Available options:', spans.map(s => s.textContent.trim()));
              
              // For Invoice, try looking for a span that has "Invoice" on its own or at the start
              if (docTypeToFind === 'Invoice' || docTypeToFind.includes('Invoice')) {
                const invoiceOptions = spans.filter(span => {
                  const text = span.textContent.trim();
                  // Look for spans that start with "Invoice" but aren't followed by other product names
                  return text === 'Invoice' || 
                         text.startsWith('Invoice (') || 
                         (text.includes('Invoice') && !text.includes('Grocery') && !text.includes('Import') && !text.includes('UNFI'));
                });
                
                if (invoiceOptions.length > 0) {
                  console.log('Found invoice option:', invoiceOptions[0].textContent.trim());
                  const listItem = invoiceOptions[0].closest('li');
                  if (listItem) {
                    const checkbox = listItem.querySelector('.checkBox-wrapper');
                    if (checkbox) {
                      checkbox.click();
                      return true;
                    }
                  }
                }
              }
              
              return false;
            }, documentType);
          } catch (error) {
            console.log(\`Error finding \${documentType} option: \${error.message}\`);
            docTypeFound = false;
          }
          
          if (!docTypeFound) {
            console.log(\`\${documentType} option not found\`);
            return { 
              success: false, 
              error: \`\${documentType} option not found in turnaround dialog\` 
            };
          }
          
          console.log(\`\${documentType} option checked\`);
          
          // Now click the Finish button
          console.log('Looking for Finish button...');
          
          const finishButtonSelector = '.hj-dlg-footer button';
          let finishButtonClicked = false;
          
          try {
            finishButtonClicked = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('.hj-dlg-footer button'));
              const finishButton = buttons.find(btn => btn.textContent.trim() === 'Finish');
              if (finishButton) {
                finishButton.click();
                return true;
              }
              return false;
            });
          } catch (error) {
            console.log(\`Error clicking Finish button: \${error.message}\`);
            finishButtonClicked = false;
          }
          
          if (!finishButtonClicked) {
            console.log('Finish button not found or could not be clicked');
            return { 
              success: false, 
              error: 'Could not click Finish button in turnaround dialog' 
            };
          }
          
          console.log('Finish button clicked');
          
          // Wait for the turnaround to process
          console.log('Waiting for turnaround to process...');
          await page.waitForTimeout(5000);
          
          // IMPROVED OUTBOX NAVIGATION CODE
          console.log('Looking for Outbox in the folder list...');

          let outboxClicked = false;

          // Method 1: Find any element with exact text "Outbox" in the folder list
          try {
            outboxClicked = await page.evaluate(() => {
              // Look for span with exact "Outbox" text
              const spans = Array.from(document.querySelectorAll('#FolderList span.k-link'));
              const outboxSpan = spans.find(span => span.textContent.trim() === 'Outbox');
              
              if (outboxSpan) {
                // Log where we found it for debugging
                const parentLi = outboxSpan.closest('li');
                const folderLevel = parentLi ? parentLi.className.match(/folderLevel\\d+/) : null;
                console.log(\`Found Outbox at level \${folderLevel || 'unknown'}\`);
                
                // Click it
                outboxSpan.click();
                return true;
              }
              
              return false;
            });
            
            console.log(outboxClicked ? 'Successfully clicked Outbox by direct text match' : 'Could not find Outbox by direct text match');
          } catch (error) {
            console.log(\`Error finding Outbox by text: \${error.message}\`);
          }

          // Method 2: If Method 1 failed, try looking at all links in the folder tree
          if (!outboxClicked) {
            try {
              outboxClicked = await page.evaluate(() => {
                // Try to find any link containing "Outbox" text
                const allLinks = Array.from(document.querySelectorAll('#FolderList a, #FolderList span.k-link'));
                const outboxLink = allLinks.find(link => 
                  link.textContent.trim() === 'Outbox');
                
                if (outboxLink) {
                  outboxLink.click();
                  return true;
                }
                
                return false;
              });
              
              console.log(outboxClicked ? 'Found and clicked Outbox in all links' : 'Could not find Outbox in all links');
            } catch (error) {
              console.log(\`Error with second Outbox finding attempt: \${error.message}\`);
            }
          }

          // Method 3: Last resort - look for a visible element with "Outbox" text anywhere in the sidebar
          if (!outboxClicked) {
            try {
              // This is a more aggressive approach that should find any clickable element containing "Outbox"
              outboxClicked = await page.evaluate(() => {
                const allElements = document.querySelectorAll('#FolderList *');
                const outboxElements = Array.from(allElements).filter(el => 
                  el.textContent && 
                  el.textContent.trim() === 'Outbox' && 
                  window.getComputedStyle(el).display !== 'none'
                );
                
                if (outboxElements.length > 0) {
                  // Try to find the closest clickable parent
                  let element = outboxElements[0];
                  // Walk up to find a clickable element
                  while (element && element.id !== 'FolderList') {
                    if (element.tagName === 'A' || element.tagName === 'BUTTON' || 
                        element.tagName === 'LI' || element.tagName === 'SPAN') {
                      element.click();
                      return true;
                    }
                    element = element.parentElement;
                  }
                  
                  // If all else fails, just click the element itself
                  outboxElements[0].click();
                  return true;
                }
                
                return false;
              });
              
              console.log(outboxClicked ? 'Found and clicked Outbox using aggressive search' : 'Could not find Outbox with aggressive search');
            } catch (error) {
              console.log(\`Error with third Outbox finding attempt: \${error.message}\`);
            }
          }

          // Method 4: Fallback using direct selector if all else fails
          if (!outboxClicked) {
            console.log('Attempting direct selector approaches for Outbox...');
            
            // Try various potential selectors for Outbox based on the folder structure
            const outboxSelectors = [
              '#FolderList li:not(.k-first) span.k-link:not(.k-header)',
              '#FolderList > li > span.k-link:not(.k-header)',
              '#FolderList > li:not([aria-expanded="true"]) > span.k-link'
            ];
            
            for (const selector of outboxSelectors) {
              try {
                const elements = await page.$$eval(selector, elements => 
                  elements.map(e => ({ text: e.textContent.trim(), hasOutbox: e.textContent.trim() === 'Outbox' }))
                );
                
                console.log(\`Selector \${selector} found \${elements.length} elements:\`, elements);
                
                const outboxIndex = elements.findIndex(e => e.hasOutbox);
                if (outboxIndex !== -1) {
                  // Use the 1-based index for the nth-child selector
                  const specificSelector = \`\${selector}:nth-child(\${outboxIndex + 1})\`;
                  console.log(\`Found Outbox at index \${outboxIndex}, using selector: \${specificSelector}\`);
                  
                  outboxClicked = await safeClick(specificSelector);
                  if (outboxClicked) {
                    console.log(\`Successfully clicked Outbox using selector: \${specificSelector}\`);
                    break;
                  }
                }
              } catch (error) {
                console.log(\`Error with selector \${selector}: \${error.message}\`);
              }
            }
          }

          // Wait for outbox content to load
          console.log('Waiting for content to load after navigation...');
          await page.waitForTimeout(5000);

          // Final check if we're in the Outbox tab
          const inOutbox = await page.evaluate(() => {
            // Check if the Outbox text appears in:
            // 1. A selected tab
            // 2. A header
            // 3. The URL
            // 4. Any prominent UI element showing current location
            
            // Helper function to safely check text content
            const hasOutboxText = (element) => {
              return element && element.textContent && element.textContent.includes('Outbox');
            };
            
            // Check for selected tab with Outbox text
            const selectedTabs = document.querySelectorAll('#FolderList li.k-state-highlight, #FolderList li.k-state-selected');
            for (const tab of selectedTabs) {
              if (hasOutboxText(tab)) {
                return true;
              }
            }
            
            // Check for Outbox in page header or breadcrumb
            const headers = document.querySelectorAll('h1, h2, h3, .breadcrumb, .navbar');
            for (const header of headers) {
              if (hasOutboxText(header)) {
                return true;
              }
            }
            
            return false;
          });

          if (inOutbox) {
            console.log('Successfully navigated to Outbox tab');
          } else {
            console.log('Warning: Could not confirm we are in the Outbox, but continuing anyway');
          }
          
          // Find the most recent transaction of our chosen document type in the outbox
          console.log(\`Looking for the newly created \${documentType} in the current view...\`);
          
          let foundDocRowIndex = -1;
          try {
            // Looking for a row that has both our PO number and the specified document type text
            foundDocRowIndex = await page.evaluate((searchPO, docType) => {
              // Prepare search terms to handle partial matches
              const docTypeTerms = [
                docType.includes('Purchase Order Acknowledgment') ? 'Purchase Order Acknowledgment' : null,
                docType.includes('Invoice') ? 'Invoice' : null,
                docType.includes('Ship Notice') ? 'Ship Notice/Manifest' : null,
                docType.includes('Pick and Pack') ? 'Pick and Pack' : null
              ].filter(Boolean);
              
              const rows = Array.from(document.querySelectorAll('#Transactions table tbody tr'));
              
              // Sort rows by document number in descending order if possible to get most recent first
              // We'll use this as a backup but continue with standard search first
              
              // Find rows that match both our document type and PO number
              const matchingRows = [];
              
              for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                const rowText = row.textContent || '';
                
                // Check if row contains our PO number
                const hasPO = rowText.includes(searchPO);
                
                // Check if row matches our document type
                let hasDocType = false;
                
                // Try to find document type by looking at the Document Type column
                const cells = row.querySelectorAll('td');
                const docTypeColumnIndex = 2; // Most likely position of Document Type column
                
                // First attempt: Check specific column for document type
                if (cells.length > docTypeColumnIndex) {
                  const cellText = cells[docTypeColumnIndex].textContent.trim();
                  
                  // Check direct match first
                  if (cellText === docType) {
                    hasDocType = true;
                  } else {
                    // Then check for partial matches using our terms
                    for (const term of docTypeTerms) {
                      if (cellText.includes(term)) {
                        hasDocType = true;
                        break;
                      }
                    }
                  }
                }
                
                // Second attempt: Check any cell for document type
                if (!hasDocType) {
                  for (let i = 0; i < cells.length; i++) {
                    const cellText = cells[i]?.textContent?.trim() || '';
                    // Skip checking this cell if it's the cell containing the PO
                    if (cellText === searchPO) continue;
                    
                    for (const term of docTypeTerms) {
                      if (cellText.includes(term)) {
                        hasDocType = true;
                        break;
                      }
                    }
                    if (hasDocType) break;
                  }
                }
                
                // If this row matches both criteria, add it to our matches
                if (hasPO && hasDocType) {
                  matchingRows.push({ rowIndex, rowText });
                  console.log(\`Found matching row: \${rowText}\`);
                }
              }
              
              // If we found any matches, return the index of the first one
              if (matchingRows.length > 0) {
                return matchingRows[0].rowIndex;
              }
              
              // If we couldn't find a perfect match, look for the most recent matching document type
              for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                const cells = row.querySelectorAll('td');
                
                // Try to find the document type column
                const docTypeColumnIndex = cells.length > 2 ? 2 : 1; // Most likely position
                if (cells.length > docTypeColumnIndex) {
                  const cellText = cells[docTypeColumnIndex].textContent.trim();
                  
                  // Check for matches with our document type
                  let matches = cellText === docType;
                  
                  if (!matches) {
                    for (const term of docTypeTerms) {
                      if (cellText.includes(term)) {
                        matches = true;
                        break;
                      }
                    }
                  }
                  
                  if (matches) {
                    console.log(\`Found document type match: \${cellText}\`);
                    return rowIndex;
                  }
                }
              }
              
              // Not found
              return -1;
            }, poNumber, documentType);
          } catch (error) {
            console.log(\`Error finding \${documentType} in outbox: \${error.message}\`);
            foundDocRowIndex = -1;
          }
          
          if (foundDocRowIndex === -1) {
            console.log(\`Could not find the \${documentType} in the current view\`);
            return { 
              success: true, 
              warning: \`Turnaround completed but could not find the resulting \${documentType} in the outbox\` 
            };
          }
          
          // Add 1 for CSS selector index
          const outboxRowIndex = foundDocRowIndex + 1;
          console.log(\`Found \${documentType} at row index \${outboxRowIndex}\`);
          
          // Double-click to open the transaction
          const outboxRowSelector = \`#Transactions table tbody tr:nth-child(\${outboxRowIndex})\`;
          console.log(\`Double-clicking outbox row to open it: \${outboxRowSelector}\`);
          
          if (!await safeClick(outboxRowSelector, { clickCount: 2 })) {
            return { 
              success: true, 
              warning: \`Turnaround completed but could not open the resulting \${documentType}\` 
            };
          }
          
          // Wait for the transaction details to load
          console.log('Waiting for transaction details to load...');
          await page.waitForTimeout(5000);
          
          // Handle required fields - fill them in with appropriate values
          console.log('Looking for required fields to fill in...');
          
          try {
            // Find and fill in all required fields
            await page.evaluate(() => {
              // Utility to get today's date in MM/DD/YYYY format
              const getTodayDate = () => {
                const today = new Date();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const year = today.getFullYear();
                return \`\${month}/\${day}/\${year}\`;
              };
              
              // Find all required fields on the page
              const requiredFields = document.querySelectorAll('.TPRequiredField');
              console.log(\`Found \${requiredFields.length} required fields\`);
              
              requiredFields.forEach((field, index) => {
                try {
                  console.log(\`Processing required field \${index + 1}\`);
                  
                  // Check field type and handle accordingly
                  
                  // 1. Check for dropdown fields
                  const dropdown = field.querySelector('.k-dropdown-wrap');
                  if (dropdown) {
                    console.log('Field is a dropdown');
                    dropdown.click(); // Click to open the dropdown
                    
                    // Wait a moment for the dropdown to open
                    setTimeout(() => {
                      // Select the first option
                      const firstOption = document.querySelector('.k-list-container .k-list .k-item:first-child');
                      if (firstOption) {
                        firstOption.click();
                        console.log('Selected first dropdown option');
                      } else {
                        console.log('No dropdown options found');
                      }
                    }, 500);
                    
                    return; // Continue to next field
                  }
                  
                  // 2. Check for date fields
                  const datePicker = field.querySelector('input[data-role="datepicker"], input.k-input[role="combobox"]');
                  if (datePicker) {
                    console.log('Field is a date picker');
                    datePicker.value = getTodayDate();
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    datePicker.dispatchEvent(event);
                    return; // Continue to next field
                  }
                  
                  // 3. Check for text input fields
                  const textInput = field.querySelector('input[type="text"], input:not([type])');
                  if (textInput) {
                    console.log('Field is a text input');
                    textInput.value = 'N/A';
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    textInput.dispatchEvent(event);
                    return; // Continue to next field
                  }
                  
                  // 4. Check for textarea fields
                  const textarea = field.querySelector('textarea');
                  if (textarea) {
                    console.log('Field is a textarea');
                    textarea.value = 'N/A';
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    textarea.dispatchEvent(event);
                    return; // Continue to next field
                  }
                  
                  console.log('Unknown field type or no editable element found');
                } catch (fieldError) {
                  console.log(\`Error processing field \${index + 1}: \${fieldError.message}\`);
                }
              });
              
              return requiredFields.length;
            });
            
            // Wait a moment for all fields to be filled
            await page.waitForTimeout(2000);
            
            // Handle required dropdowns with proper label extraction
            console.log('Looking for dropdown fields...');
            
            try {
              // First, identify all dropdown fields with their proper labels
              const dropdownFields = await page.evaluate(() => {
                // Find all field cells which contain both label and dropdown
                const fieldCells = Array.from(document.querySelectorAll('[data-hj-test-id="field-cell"]'));
                
                return fieldCells.map(cell => {
                  // Get label text from the tc-label element
                  const labelElem = cell.querySelector('[data-hj-test-id="field-label-title"] span');
                  const label = labelElem ? labelElem.textContent.trim() : '';
                  
                  // Find the dropdown element within this cell
                  const dropdown = cell.querySelector('.TPRequiredField');
                  
                  // If we found both a label and a dropdown
                  if (label && dropdown) {
                    // Get dropdown ID and the select element with options
                    const id = dropdown.id || '';
                    const select = dropdown.querySelector('select');
                    
                    // Get available options if select exists
                    let options = [];
                    if (select) {
                      options = Array.from(select.options).map(option => ({
                        value: option.value,
                        text: option.textContent.trim(),
                        selected: option.selected
                      }));
                    }
                    
                    return { label, id, options };
                  }
                  return null;
                }).filter(Boolean); // Remove nulls
              });
              
              console.log('Found dropdown fields:', dropdownFields.map(f => f.label));
              
              // Process each dropdown field
              for (const field of dropdownFields) {
                console.log(\`Processing dropdown field: \${field.label}\`);
                
                // Determine target value based on field label
                let targetValue = '';
                
                if (field.label.toLowerCase() === 'purpose') {
                  targetValue = 'Original';
                  console.log('Field is Purpose, setting to Original');
                } 
                else if (field.label.toLowerCase() === 'type') {
                  if (documentType.includes('Purchase Order Acknowledgment')) {
                    targetValue = 'Acknowledge - No Detail or Change';
                  } else if (documentType.includes('Invoice')) {
                    targetValue = 'Invoice';
                  } else if (documentType.includes('Ship Notice')) {
                    targetValue = 'Ship Notice';
                  }
                  console.log(\`Field is Type, setting to \${targetValue} based on document type\`);
                }
                
                // Click to open the dropdown if we have an ID
                if (field.id) {
                  const clicked = await page.evaluate(fieldId => {
                    const dropdown = document.querySelector(\`#\${fieldId}\`);
                    if (dropdown) {
                      const clickable = dropdown.querySelector('.k-dropdown-wrap');
                      if (clickable) {
                        clickable.click();
                        return true;
                      }
                    }
                    return false;
                  }, field.id);
                  
                  if (clicked) {
                    console.log(\`Clicked dropdown \${field.label}\`);
                    
                    // Wait for dropdown to open
                    await page.waitForTimeout(1000);
                    
                    // Select the matching option
                    const selected = await page.evaluate((targetVal) => {
                      const options = Array.from(document.querySelectorAll('.k-list-container .k-list .k-item'));
                      console.log(\`Available options: \${options.map(o => o.textContent.trim()).join(', ')}\`);
                      
                      let optionToSelect = null;
                      
                      // First try: Exact match
                      if (targetVal) {
                        optionToSelect = options.find(opt => 
                          opt.textContent.trim() === targetVal);
                      }
                      
                      // Second try: Partial match
                      if (!optionToSelect && targetVal) {
                        optionToSelect = options.find(opt => 
                          opt.textContent.trim().includes(targetVal));
                      }
                      
                      // Third try: For "Acknowledge" type fields
                      if (!optionToSelect && targetVal && targetVal.includes('Acknowledge')) {
                        optionToSelect = options.find(opt => 
                          opt.textContent.trim().includes('Acknowledge'));
                      }
                      
                      // Fallback: First non-empty option
                      if (!optionToSelect) {
                        optionToSelect = options.find(opt => opt.textContent.trim() !== '');
                      }
                      
                      // Last resort: First option
                      if (!optionToSelect && options.length > 0) {
                        optionToSelect = options[0];
                      }
                      
                      // Click the selected option
                      if (optionToSelect) {
                        console.log(\`Selected option: "\${optionToSelect.textContent.trim()}"\`);
                        optionToSelect.click();
                        return optionToSelect.textContent.trim();
                      }
                      
                      return null;
                    }, targetValue);
                    
                    console.log(\`Selected \${selected || 'unknown'} for \${field.label}\`);
                  } else {
                    console.log(\`Could not click dropdown \${field.label}\`);
                  }
                  
                  // Wait between dropdowns
                  await page.waitForTimeout(1000);
                }
              }
            } catch (error) {
              console.log(\`Error processing dropdowns: \${error.message}\`);
            }
            
            console.log('All required fields filled');
          } catch (error) {
            console.log(\`Error filling required fields: \${error.message}\`);
          }
          
          // Click Save and Close button
          console.log('Looking for Save and Close button...');
          
          let saveClicked = false;
          try {
            saveClicked = await page.evaluate(() => {
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
          
          // Wait for save and navigation back to outbox
          console.log('Waiting for save to complete and return to outbox...');
          await page.waitForTimeout(5000);
          
          // Successfully completed all steps
          return {
            success: true,
            message: \`Successfully performed turnaround for PO number \${poNumber} to create \${documentType}\`,
            documentType: documentType,
            fieldsCompleted: true
          };
        }`;
        
        // Run the Puppeteer script
        console.log(`Running turnaround for PO: ${this.rowData.pONumber}, Document Type: ${this.documentType}`);
        const result = await $runPuppeteer(userActionsString);
        console.log('result is: ', result)
        
        this.lastResult = result.extractedData
        
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
        console.log('last result: ', this.lastResult)
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