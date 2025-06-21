return async function () {
  let selectedInvoiceLines = Object.keys(this.$store.state.dgRowInEditMode)
    .filter((item) => item.startsWith('aRInvoices.'))
    .map((item) => item.split('.')[1]);

  console.log('selectedInvLines: ', selectedInvoiceLines);

  if (selectedInvoiceLines.length < 1) {
    alert('Select at least one invoice line');
    return;
  }

  let filteredSelectedLines = $getGrid('aRInvoices').filter((line) =>
    selectedInvoiceLines.includes(line.rowKey)
  );

  console.log('filteredLines: ', filteredSelectedLines);

  for (let i = 0; i < filteredSelectedLines.length; i++) {
    const invoice = filteredSelectedLines[i];

    await this.sendInvoiceToQB(invoice, true); // Wait for async call to finish

    // Delay before next iteration
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  alert('All invoices processed.');
  this.$store.commit('clearDGRowEditMode', 'aRInvoices')
};