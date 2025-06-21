return async function (rowData) {
  console.log('rowData: ', rowData);

  const workMats = $getGrid('workOrderMaterials').filter((d) => d.workOrder === rowData.rowKey && !d.name.includes('='));
  console.log('workMats: ', workMats);

  let insufficientMaterialsCount = 0; // Counter for insufficient inventory materials

  const inventoryByMaterial = await Promise.all(workMats.map(async (mat) => {
    console.log('Processing material:', mat);

    let requiredQuantity = mat.quantityPer;
    if (requiredQuantity <= 0) {
      console.warn(`Invalid quantityPer for part ${mat.part}`);
      return { material: mat, inventories: [] };
    }



      const matchingInventories = $getGrid('locationInventory')
  .filter((locInv) => locInv.part === mat.part  )
  .sort((a, b) => a.internalID - b.internalID);


    console.log(`Matching inventories for ${mat.part}:`, matchingInventories);

    const selectedInventories = [];
    for (const inventory of matchingInventories) {
      if (requiredQuantity <= 0) break;
       if (inventory.$workOrder) break;

      const availableQuantity = inventory.quantityRemaining || 0;
      console.log(
        `Checking inventory ${inventory.id} with quantityRemaining: ${availableQuantity}`
      );

      if (availableQuantity > 0) {
        const takenQuantity = Math.min(availableQuantity, requiredQuantity);
        selectedInventories.push({
          ...inventory,
          takenQuantity,
        });

        // Create an inventory transaction
        try {
          const newBatchUsed = await $dgAddRow('inventoryTransaction', {
            workOrderMaterial: mat.rowKey,
            quantity: takenQuantity * -1 * rowData.qtytoMfg,
            locationInventory: inventory.rowKey,
            part: mat.part,
            changed: false,
          });
          console.log(`Created inventory transaction: ${newBatchUsed}`);
        } catch (err) {
          console.error('Failed to create inventory transaction:', err);
        }

        requiredQuantity -= takenQuantity;
      }
    }

    if (requiredQuantity > 0) {
      insufficientMaterialsCount++; // Increment counter for insufficient materials
      console.warn(`Not enough inventory to fulfill ${mat.part}. Still need: ${requiredQuantity}`);
    }

    return { material: mat, inventories: selectedInventories };
  }));

  // Alert the user about insufficient materials
  if (insufficientMaterialsCount > 0) {
    alert(`${insufficientMaterialsCount} work order materials do not have enough location inventory.`);
  }

  console.log('Inventory By Material: ', inventoryByMaterial);

alert('Stock Allocated')
  // return inventoryByMaterial;
};
