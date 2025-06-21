return async function (rowData) {


// get pricing level records
const pricingLevels = $getGrid('priceLevels');


// filter where rowData.$priceLevel.pricetype == rowData.$part.internalID
const filteredPricing = pricingLevels.filter(priceLevel => 
    priceLevel.item === rowData.$part.internalID && pricelevel.pricetype == rowData.$priceLevel.levelid
);

console.log(filteredPricing)

if (filteredPricing.length > 0) {
    // Assume we want the first match (modifiable as per requirement)
    const priceLevel = filteredPricing[0];

    // update the salesLine record rowData.rowKey, unitPrice = priceLevel.price
    await $setDataGridVal('salesLine', `${rowData.rowKey}.unitPrice`, priceLevel.price);
}




console.log('rowData: ', rowData);

}
