<template>
  <div class="shopify-processor-container">
    <div class="processor-header">
      <h3>
        <i class="fab fa-shopify"></i>
        Shopify Order Processor
      </h3>
    </div>

    <!-- Status Section -->
    <div v-if="!hasShopifyData" class="no-data-message">
      <i class="fas fa-info-circle"></i>
      No Shopify data found on this order
    </div>

    <!-- Order Summary -->
    <div v-else-if="!processing && !results" class="order-summary">
      <div class="summary-header">
        <h4>Ready to Process</h4>
        <span class="order-number">Order #{{ parsedOrder.order_number }}</span>
      </div>
      
      <div class="summary-grid">
        <div class="summary-item">
          <span class="label">Customer:</span>
          <span class="value">{{ parsedOrder.customer.first_name }} {{ parsedOrder.customer.last_name }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Items:</span>
          <span class="value">{{ parsedOrder.line_items.length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Total:</span>
          <span class="value">${{ parsedOrder.total_price }}</span>
        </div>
      </div>

      <button @click="processOrder" class="btn-process">
        <i class="fas fa-play-circle"></i>
        Process Order
      </button>
    </div>

    <!-- Processing Section -->
    <div v-if="processing" class="processing-section">
      <div class="spinner"></div>
      <p>{{ processingMessage }}</p>
    </div>

    <!-- Results Section -->
    <div v-if="results" class="results-section" :class="results.success ? 'success' : 'error'">
      <div class="result-header">
        <i :class="results.success ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'"></i>
        <h4>{{ results.success ? 'Processing Complete' : 'Processing Failed' }}</h4>
      </div>

      <div v-if="results.message" class="result-message">
        {{ results.message }}
      </div>

      <!-- Created Items -->
      <div v-if="results.created && results.created.length > 0" class="created-items">
        <h5>Created:</h5>
        <ul>
          <li v-for="item in results.created" :key="item.id">
            {{ item.type }}: {{ item.name }}
          </li>
        </ul>
      </div>

      <!-- Errors -->
      <div v-if="results.errors && results.errors.length > 0" class="error-items">
        <h5>Errors:</h5>
        <ul>
          <li v-for="error in results.errors" :key="error.id">
            {{ error.message }}
            <span v-if="error.detail" class="error-detail">({{ error.detail }})</span>
          </li>
        </ul>
      </div>

      <button @click="reset" class="btn-reset">
        <i class="fas fa-redo"></i>
        Reset
      </button>
    </div>
  </div>
</template>

<script>
module.exports = {
  name: 'ShopifyOrderProcessor',
  props: {
    rowData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      hasShopifyData: false,
      parsedOrder: null,
      processing: false,
      processingMessage: 'Processing...',
      results: null
    }
  },
  mounted() {
    this.checkForShopifyData()
  },
  watch: {
    'rowData.shopifyJSON': {
      handler() {
        this.checkForShopifyData()
      },
      immediate: true
    }
  },
  methods: {
    checkForShopifyData() {
      if (this.rowData && this.rowData.shopifyJSON) {
        try {
          this.parsedOrder = JSON.parse(this.rowData.shopifyJSON)
          this.hasShopifyData = true
        } catch (error) {
          console.error('Failed to parse Shopify JSON:', error)
          this.hasShopifyData = false
          this.parsedOrder = null
        }
      } else {
        this.hasShopifyData = false
        this.parsedOrder = null
      }
    },

    async processOrder() {
      this.processing = true
      this.results = {
        created: [],
        errors: [],
        success: true
      }

      try {
        const shopifyOrder = this.parsedOrder
        const salesOrderId = this.rowData.rowKey // Current sales order ID
        
        // Step 1: Process Customer
        this.processingMessage = 'Processing customer...'
        let customerRowKey = this.rowData.soldToCustomer // Use existing customer if set
        
        if (!customerRowKey && shopifyOrder.customer) {
          // Check if customer exists by email
          const customers = this.$parent.$getGrid('customers')
          const existingCustomer = customers.find(c => c.email === shopifyOrder.customer.email)
          
          if (existingCustomer) {
            customerRowKey = existingCustomer.rowKey
            
            // Update the sales order with the customer
            await this.$parent.$setDataGridVal('opportunities', `${salesOrderId}.soldToCustomer`, customerRowKey)
          } else {
            // Create new customer
            const customerData = {
              name: `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`,
              firstName: shopifyOrder.customer.first_name,
              lastName: shopifyOrder.customer.last_name,
              email: shopifyOrder.customer.email,
              companyName: shopifyOrder.customer.default_address?.company || '',
              phone: shopifyOrder.customer.default_address?.phone || '',
              isIndividual: 'true'
            }
            
            customerRowKey = await this.$parent.$dgAddRow('customers', customerData)
            
            // Update the sales order with the customer
            await this.$parent.$setDataGridVal('opportunities', `${salesOrderId}.soldToCustomer`, customerRowKey)
            
            this.results.created.push({
              type: 'Customer',
              name: customerData.name,
              id: customerRowKey
            })
          }
        }
        
        // Step 2: Process Addresses if we have a customer
        if (customerRowKey) {
          this.processingMessage = 'Processing addresses...'
          const addresses = this.$parent.$getGrid('addresses')
          
          // Check/create billing address
          const billingMatch = addresses.find(a => 
            a.customer === customerRowKey &&
            a.address1 === shopifyOrder.billing_address.address1 &&
            a.city === shopifyOrder.billing_address.city &&
            a.state === shopifyOrder.billing_address.province &&
            a.postalCode === shopifyOrder.billing_address.zip
          )
          
          if (!billingMatch) {
            const billingData = {
              name: `${shopifyOrder.billing_address.name} - ${shopifyOrder.billing_address.address1}`,
              address1: shopifyOrder.billing_address.address1,
              address2: shopifyOrder.billing_address.address2 || '',
              city: shopifyOrder.billing_address.city,
              state: shopifyOrder.billing_address.province,
              postalCode: shopifyOrder.billing_address.zip,
              country: shopifyOrder.billing_address.country,
              customer: customerRowKey
            }
            
            const newBillingId = await this.$parent.$dgAddRow('addresses', billingData)
            this.results.created.push({
              type: 'Billing Address',
              name: billingData.address1,
              id: newBillingId
            })
          }
          
          // Check/create shipping address
          const shippingMatch = addresses.find(a => 
            a.customer === customerRowKey &&
            a.address1 === shopifyOrder.shipping_address.address1 &&
            a.city === shopifyOrder.shipping_address.city &&
            a.state === shopifyOrder.shipping_address.province &&
            a.postalCode === shopifyOrder.shipping_address.zip
          )
          
          if (!shippingMatch) {
            const shippingData = {
              name: `${shopifyOrder.shipping_address.name} - ${shopifyOrder.shipping_address.address1}`,
              address1: shopifyOrder.shipping_address.address1,
              address2: shopifyOrder.shipping_address.address2 || '',
              city: shopifyOrder.shipping_address.city,
              state: shopifyOrder.shipping_address.province,
              postalCode: shopifyOrder.shipping_address.zip,
              country: shopifyOrder.shipping_address.country,
              customer: customerRowKey
            }
            
            const newShippingId = await this.$parent.$dgAddRow('addresses', shippingData)
            this.results.created.push({
              type: 'Shipping Address',
              name: shippingData.address1,
              id: newShippingId
            })
          }
        }
        
        // Step 3: Create Sales Lines
        this.processingMessage = 'Creating line items...'
        const orderDate = new Date(shopifyOrder.created_at)
        const { shipping_address } = shopifyOrder
        const parts = this.$parent.$getGrid('parts')
        
        for (let i = 0; i < shopifyOrder.line_items.length; i++) {
          const item = shopifyOrder.line_items[i]
          
          // Find matching part by SKU
          const partMatch = parts.find(p => p.name === item.sku)
          
          if (!partMatch) {
            this.results.errors.push({
              message: `Product not found: ${item.sku}`,
              detail: item.name
            })
            this.results.success = false
            continue
          }
          
          try {
            const lineData = {
              // Basic identifiers
              name: `${shopifyOrder.name}-${item.sku}`,
              description: item.name,
              
              // Relationships
              salesOrder: salesOrderId, // Link to current sales order
              part: partMatch.rowKey,
              customer: customerRowKey || shopifyOrder.customer.id.toString(),
              
              // Quantities and pricing
              quantity: item.quantity,
              unitPrice: parseFloat(item.price),
              totalLinePrice: parseFloat(item.price) * item.quantity,
              subtotal: parseFloat(item.price) * item.quantity,
              
              // Address fields from shipping address
              address1: shipping_address.address1,
              address2: shipping_address.address2 || '',
              city: shipping_address.city,
              stateProvince: shipping_address.province,
              postalCode: shipping_address.zip,
              country: shipping_address.country,
              
              // Dates based on order date
              shipDate: orderDate.toISOString(),
              dueDate: orderDate.toISOString(),
              createdDate: orderDate.toISOString(),
              
              // Additional fields from Shopify data
              lineItemNumber: i + 1,
              lineUniqueKey: item.id.toString(),
              linecreateddate: orderDate.toISOString(),
              
              // SKU and vendor info
              buyersItem: item.sku,
              vendorRef: item.vendor || '',
              
              // Shipping info
              carrier: shopifyOrder.shipping_lines[0]?.title || '',
              
              // Tax info
              custcolfalinetax: item.tax_lines[0]?.price || 0,
              
              // Discount info - check both total_discount and discount_allocations
              totalDiscount: (() => {
                if (item.total_discount && parseFloat(item.total_discount) > 0) {
                  return parseFloat(item.total_discount);
                } else if (item.discount_allocations && item.discount_allocations.length > 0) {
                  // Sum up all discount allocations
                  return item.discount_allocations.reduce((sum, allocation) => {
                    return sum + parseFloat(allocation.amount || 0);
                  }, 0);
                }
                return 0;
              })(),
              
              // Weight if available
              custcolatlasitemweight: item.grams ? (item.grams / 1000).toString() + ' kg' : '',
              
              // Flags
              open: true,
              fulfillable: 'true',
              isfullyshipped: 'false',
              
              // Quantities for tracking
              quantityshiprecv: 0,
              quantityFulfilledReceived: 0,
              quantitybackordered: 0,
              quantitybilled: 0,
              quantitypacked: 0,
              quantitypicked: 0,
              remainingQuantity: item.quantity
            }
            
            await this.$parent.$dgAddRow('salesLines', lineData)
            
            this.results.created.push({
              type: 'Sales Line',
              name: `${item.sku} x${item.quantity}`,
              id: 'Created'
            })
          } catch (error) {
            this.results.errors.push({
              message: `Failed to create sales line: ${item.sku}`,
              detail: error.message
            })
            this.results.success = false
          }
        }
        
        this.results.message = `Processed order #${shopifyOrder.order_number}`
        
      } catch (error) {
        console.error('Failed to process order:', error)
        this.results.success = false
        this.results.message = 'Failed to process order'
        this.results.errors.push({
          message: 'Processing error',
          detail: error.message
        })
      } finally {
        this.processing = false
      }
    },

    reset() {
      this.results = null
      this.processing = false
      this.processingMessage = 'Processing...'
    }
  }
}
</script>

<style scoped>
.shopify-processor-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin: 16px 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.processor-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f0f0;
}

.processor-header h3 {
  margin: 0;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.processor-header i {
  color: #95BF47;
  font-size: 24px;
}

.no-data-message {
  text-align: center;
  padding: 40px;
  color: #666;
}

.no-data-message i {
  font-size: 48px;
  color: #ddd;
  display: block;
  margin-bottom: 16px;
}

.order-summary {
  text-align: center;
}

.summary-header {
  margin-bottom: 20px;
}

.summary-header h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.order-number {
  color: #666;
  font-size: 16px;
  font-weight: 500;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-item {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
}

.summary-item .label {
  display: block;
  color: #666;
  font-size: 12px;
  margin-bottom: 4px;
}

.summary-item .value {
  display: block;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.btn-process, .btn-reset {
  padding: 12px 32px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.btn-process {
  background: #4CAF50;
  color: white;
}

.btn-process:hover {
  background: #45a049;
}

.btn-reset {
  background: #e0e0e0;
  color: #333;
}

.btn-reset:hover {
  background: #d0d0d0;
}

.processing-section {
  text-align: center;
  padding: 40px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.results-section {
  padding: 20px;
  border-radius: 6px;
  margin-top: 20px;
}

.results-section.success {
  background: #e8f5e9;
  border: 1px solid #4CAF50;
}

.results-section.error {
  background: #ffebee;
  border: 1px solid #f44336;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.result-header i {
  font-size: 24px;
}

.results-section.success .result-header i {
  color: #4CAF50;
}

.results-section.error .result-header i {
  color: #f44336;
}

.result-header h4 {
  margin: 0;
  color: #333;
}

.result-message {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255,255,255,0.5);
  border-radius: 4px;
}

.created-items, .error-items {
  margin-top: 16px;
}

.created-items h5, .error-items h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.created-items ul, .error-items ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.created-items li, .error-items li {
  padding: 4px 0;
  font-size: 14px;
}

.error-detail {
  font-size: 12px;
  color: #666;
  font-style: italic;
}
</style>