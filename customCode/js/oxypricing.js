 async function getOxyPrice(rowData) {


// get pricing level records
const pricingLevels = $getGrid('pricing');


// filter where rowData.$priceLevel.pricetype == rowData.$part.internalID
const filteredPricing = pricingLevels.filter(priceLevel => 
    priceLevel.item == rowData.$part.internalID  && priceLevel.pricetype == rowData.priceLevel
);

console.log('custom pricing',filteredPricing)
console.log('internal id is', rowData.$part.internalID )

if (filteredPricing.length > 0) {
    // Assume we want the first match (modifiable as per requirement)
    const priceLevel = filteredPricing[0];
    console.log('price level found is' , priceLevel)


    // update the salesLine record rowData.rowKey, unitPrice = priceLevel.price
    await $setDataGridVal('salesLines', `${rowData.rowKey}.unitPrice`, priceLevel.price);
}




console.log('rowData: ', rowData);

}


window.getOxyPrice = getOxyPrice