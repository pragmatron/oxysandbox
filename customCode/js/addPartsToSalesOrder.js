function openPartsModal(rowData) {
  $setGlobalModel('partsModalSalesOrder', rowData.rowKey);
  $setGlobalModel('selectedParts', []);
  $setGlobalModel('showPartsModal', true);
}

async function addSelectedPartsToOrder(selectedParts) {
  const salesOrder = $getGlobalModel('partsModalSalesOrder');
  if (!salesOrder) return;
  for (const item of selectedParts) {
    const newLine = await $dgAddRow('salesLines', {
      salesOrder: salesOrder,
      part: item.part,
      name: '',
    });
    await $dgSetRowVals('salesLines', newLine, { quantity: item.quantity });
  }
  $setGlobalModel('showPartsModal', false);
  $setGlobalModel('selectedParts', []);
}

window.openPartsModal = openPartsModal;
window.addSelectedPartsToOrder = addSelectedPartsToOrder;
