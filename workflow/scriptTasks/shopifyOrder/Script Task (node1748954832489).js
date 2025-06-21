// Log the incoming data for debugging
$log('Incoming Shopify Order: ' + JSON.stringify(context.webhookdata))

try {
  // Extract the Shopify order data
  const shopifyOrder = context.webhookdata
  
  // Validate required fields
  if (!shopifyOrder.customer || !shopifyOrder.line_items || !shopifyOrder.billing_address || !shopifyOrder.shipping_address) {
    throw new Error('Missing required order fields')
  }
  
  // Initialize results tracking
  const results = {
    created: [],
    errors: [],
    salesOrderId: null
  }
  
  // Step 1: Process Customer
  $log('Processing customer: ' + shopifyOrder.customer.email)
  let customerRowKey
  
  // Check if customer exists
  const existingCustomers = await $findRecords('customers', 'email', shopifyOrder.customer.email)
  
  if (existingCustomers && existingCustomers.length > 0) {
    customerRowKey = existingCustomers[0].rowKey
    $log('Found existing customer: ' + customerRowKey)
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
    
    customerRowKey = await $addRow('customers', customerData)
    $log('Created new customer: ' + customerRowKey + ' - ' + customerData.name)
    results.created.push({
      type: 'Customer',
      name: customerData.name,
      id: customerRowKey
    })
  }
  
  // Step 2: Process Addresses
  $log('Processing addresses for customer: ' + customerRowKey)
  const addressIds = {}
  
  // Process billing address
  const billingAddressSearch = await $findRecords('addresses', 'customer', customerRowKey)
  const billingMatch = billingAddressSearch?.find(a => 
    a.address1 === shopifyOrder.billing_address.address1 &&
    a.city === shopifyOrder.billing_address.city &&
    a.state === shopifyOrder.billing_address.province &&
    a.postalCode === shopifyOrder.billing_address.zip
  )
  
  if (billingMatch) {
    addressIds.billing = billingMatch.rowKey
    $log('Found existing billing address: ' + billingMatch.rowKey)
  } else {
    // Create new billing address
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
    
    addressIds.billing = await $addRow('addresses', billingData)
    $log('Created new billing address: ' + addressIds.billing + ' - ' + billingData.address1)
    results.created.push({
      type: 'Billing Address',
      name: billingData.address1,
      id: addressIds.billing
    })
  }
  
  // Process shipping address
  const shippingAddressSearch = await $findRecords('addresses', 'customer', customerRowKey)
  const shippingMatch = shippingAddressSearch?.find(a => 
    a.address1 === shopifyOrder.shipping_address.address1 &&
    a.city === shopifyOrder.shipping_address.city &&
    a.state === shopifyOrder.shipping_address.province &&
    a.postalCode === shopifyOrder.shipping_address.zip
  )
  
  if (shippingMatch) {
    addressIds.shipping = shippingMatch.rowKey
    $log('Found existing shipping address: ' + shippingMatch.rowKey)
  } else {
    // Create new shipping address
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
    
    addressIds.shipping = await $addRow('addresses', shippingData)
    $log('Created new shipping address: ' + addressIds.shipping + ' - ' + shippingData.address1)
    results.created.push({
      type: 'Shipping Address',
      name: shippingData.address1,
      id: addressIds.shipping
    })
  }
  
  // Step 3: Create Sales Order
  $log('Creating sales order: Shopify Order #' + shopifyOrder.order_number)
  const { billing_address, shipping_address } = shopifyOrder
  
  const orderData = {
    name: `Shopify Order #${shopifyOrder.order_number}`,
    soldToCustomer: customerRowKey,
    
    // Store the raw Shopify JSON
    shopifyJSON: JSON.stringify(shopifyOrder),
    
    // Lookup references to address records
    addressName: addressIds.shipping,
    billAddressName: addressIds.billing,
    
    // General/Shipping address fields
    address1: shipping_address.address1,
    address2: shipping_address.address2 || '',
    city: shipping_address.city,
    stateProvince: shipping_address.province,
    postalCode: shipping_address.zip,
    country: shipping_address.country,
    
    // Billing address fields
    billAddress1: billing_address.address1,
    billAddress2: billing_address.address2 || '',
    billingCity: billing_address.city,
    billingStateProvince: billing_address.province,
    billingPostalCode: billing_address.zip,
    billingCountry: billing_address.country,
    
    // Additional shipping info
    shippingAddressee: shipping_address.name,
    billingAddressee: billing_address.name,
    
    // Other order details
    status: '-NeJBdiMEZAMNarNxgEO', // "New" status - you may need to adjust this ID
    quoteDate: new Date(shopifyOrder.created_at).toISOString(),
    dueDate: new Date(shopifyOrder.created_at).toISOString(),
    totalQuoteLinePrice: parseFloat(shopifyOrder.total_price),
    shippingCost: parseFloat(shopifyOrder.total_shipping_price_set.shop_money.amount),
    pONumber: shopifyOrder.name,
    email: shopifyOrder.email,
    phone: shopifyOrder.phone || shipping_address.phone || billing_address.phone || '',
    memo: `Shopify Order ${shopifyOrder.name}\nPayment: ${shopifyOrder.payment_gateway_names.join(', ')}`,
    
    // Shipping method info
    shipmethod: shopifyOrder.shipping_lines[0]?.title || '',
    
    // Set Created Date
    createdDate: new Date(shopifyOrder.created_at).toISOString()
  }
  
  const salesOrderId = await $addRow('opportunities', orderData)
  $log('Created sales order: ' + salesOrderId + ' - ' + orderData.name)
  results.salesOrderId = salesOrderId
  results.created.push({
    type: 'Sales Order',
    name: orderData.name,
    id: salesOrderId
  })
  
  // Step 4: Create Sales Lines
  $log('Creating sales lines for order: ' + salesOrderId)
  const orderDate = new Date(shopifyOrder.created_at)
  
  // Get all parts to match SKUs
  const allParts = await tablesRef.child('parts').once('value')
  const partsData = allParts.val() || {}
  const partsArray = Object.entries(partsData).map(([key, value]) => ({ ...value, rowKey: key }))
  
  for (let i = 0; i < shopifyOrder.line_items.length; i++) {
    const item = shopifyOrder.line_items[i]
    
    // Find matching part by SKU
    const partMatch = partsArray.find(p => p.name === item.sku)
    
    if (!partMatch) {
      $log('ERROR: Product not found - SKU: ' + item.sku + ' - Name: ' + item.name)
      results.errors.push({
        message: `Product not found: ${item.sku}`,
        detail: item.name
      })
      continue
    }
    
    try {
      let lineDiscount = 0;
      if (item.total_discount && parseFloat(item.total_discount) > 0) {
        lineDiscount = parseFloat(item.total_discount);
      } else if (item.discount_allocations && item.discount_allocations.length > 0) {
        // Sum up all discount allocations
        lineDiscount = item.discount_allocations.reduce((sum, allocation) => {
          return sum + parseFloat(allocation.amount || 0);
        }, 0);
      }

      const lineData = {
        // Basic identifiers
        name: `${shopifyOrder.name}-${item.sku}`,
        description: item.name,
        
        // Relationships
        salesOrder: salesOrderId,
        part: partMatch.rowKey,
        customer: shopifyOrder.customer.id.toString(),
        
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
        
        // Discount info
        totalDiscount: lineDiscount,
        
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
      
      const lineId = await $addRow('salesLines', lineData)
      $log('Created sales line: ' + lineId + ' - SKU: ' + item.sku + ' x' + item.quantity)
      results.created.push({
        type: 'Sales Line',
        name: `${item.sku} x${item.quantity}`,
        id: lineId
      })
    } catch (error) {
      $log('ERROR: Failed to create sales line for SKU: ' + item.sku + ' - Error: ' + error.message)
      results.errors.push({
        message: `Failed to create sales line: ${item.sku}`,
        detail: error.message
      })
    }
  }
  
  // Set the workflow response
  context.data = {
    success: results.errors.length === 0,
    message: `Order #${shopifyOrder.order_number} processed successfully`,
    salesOrderId: results.salesOrderId,
    created: results.created,
    errors: results.errors
  }
  
  $log('Order processing complete - Success: ' + (results.errors.length === 0) + ' - Created items: ' + results.created.length + ' - Errors: ' + results.errors.length)
  
} catch (error) {
  $log('ERROR: Failed to process Shopify order - ' + error.message)
  context.data = {
    success: false,
    message: 'Failed to process order',
    error: error.message
  }
  context.status = 500
}