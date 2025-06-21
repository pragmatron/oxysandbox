<template>
  <div style="display: flex; gap: 20px;">
    <!-- Parts Search + Table -->
    <div style="flex: 2;">
      <b-button v-if="!showPanel" variant="primary" @click="togglePanel(true)">Show</b-button>
      <b-button v-if="showPanel" variant="secondary" @click="togglePanel(false)">Hide</b-button>
      <input  v-if="showPanel"  v-model="searchQueryName" placeholder="Search name..." style="width: 100%; padding: 6px; margin-bottom: 5px;" />
      <input  v-if="showPanel"  v-model="searchQueryDesc" placeholder="Search description..." style="width: 100%; padding: 6px; margin-bottom: 10px;" />
      
      <!-- Table -->
      <table v-if="showPanel" border="1" cellpadding="6" cellspacing="0" style="width: 100%;">
        <thead>
          <tr>
            <th>Select</th>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="part in pagedParts" :key="part.rowKey">
            <td><b-button sm variant="primary" @click="addPart(part)">Select</b-button></td>
            <td>{{ part.name }}</td>
            <td>{{ part.description }}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Pagination Controls -->
      <div v-if="showPanel" style="margin-top: 10px; display: flex; justify-content: space-between;">
        <button :disabled="currentPage === 1" @click="currentPage--">Prev</button>
        <span>Page {{ currentPage }} / {{ totalPages }}</span>
        <button :disabled="currentPage === totalPages" @click="currentPage++">Next</button>
      </div>
    </div>

    <!-- Selected Panel -->
    <div v-if="showPanel" style="flex: 1;">
      <h3>Selected Parts</h3>
      <div v-for="(entry, index) in selectedParts" :key="index" style="margin-bottom: 10px; border: 1px solid #ccc; padding: 6px;">
        <div>{{ entry.part.name }}</div>
        <div>{{ entry.part.description }}</div>
        <input v-model.number="entry.quantity" type="number" min="1" placeholder="Quantity" style="width: 100%; margin-top: 4px;" />
      </div>
      <b-button variant="success" @click="complete" style="margin-top: 10px;">Done</b-button>
    </div>
  </div>
</template>

<script>
module.exports = {
  props: ['rowData'],
  data() {
    return {
      searchQueryName: '',
      searchQueryDesc: '',
      selectedParts: [],
      currentPage: 1,
      itemsPerPage: 20,
      showPanel: false,
    }
  },
  computed: {
    filteredParts() {
      const parts = $getGrid('parts')
      return parts.filter(p => {
        return (
          (p.$productionStage$display === 'Finished Goods') &&
          (p.subsidiary || '').toLowerCase().includes('oxy') &&
          (p.name || '').toLowerCase().includes(this.searchQueryName.toLowerCase()) &&
          (p.description || '').toLowerCase().includes(this.searchQueryDesc.toLowerCase())
        )
      })
    },
    pagedParts() {
      const start = (this.currentPage - 1) * this.itemsPerPage
      return this.filteredParts.slice(start, start + this.itemsPerPage)
    },
    totalPages() {
      return Math.ceil(this.filteredParts.length / this.itemsPerPage) || 1
    }
  },
  methods: {
    addPart(part) {
      this.selectedParts.push({ part, quantity: 1 })
    },
    submit() {
      for (const entry of this.selectedParts) {
        $dgAddRow('salesLines', {
          salesOrder: this.rowData.rowKey,
          part: entry.part.rowKey,
          quantity: entry.quantity
        })
      }
      this.selectedParts = []
    },
    complete() {
      this.submit()
      this.showPanel = false
    },
    togglePanel(state) {
      this.showPanel = state
    }
  }
}
</script>
