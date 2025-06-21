async function setQuoteStatus(rowKey) {
  await $setDataGridVal('quotes', `${rowKey}.status`, 'approved');
  await $setDataGridVal('quotes', `${rowKey}.approved`, true);
}


window.setQuoteStatus = setQuoteStatus