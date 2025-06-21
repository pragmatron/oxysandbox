<template>
  <b-modal v-model="showModal" title="Add Parts" size="lg" hide-footer
  v-if="true"
  
  
  >
    <div class="d-flex">
      <div class="flex-fill">
        <b-form-input v-model="search" placeholder="Search parts"></b-form-input>
        <div style="max-height:300px;overflow-y:auto" class="mt-2">
          <div
            v-for="part in filteredParts"
            :key="part.rowKey"
            class="d-flex justify-content-between align-items-center mb-1"
          >
            <div>
              <div><strong>{{ part.name }}</strong></div>
              <div class="text-muted">{{ part.description }}</div>
            </div>
            <b-button size="sm" @click="addPart(part)">Select</b-button>
          </div>
        </div>
      </div>
      <div class="ml-3" style="width:250px;">
        <div
          v-for="(item, index) in selected"
          :key="index"
          class="d-flex align-items-center mb-2"
        >
          <span class="flex-grow-1">{{ getPartName(item.part) }}</span>
          <b-form-input
            type="number"
            min="1"
            v-model.number="item.quantity"
            class="ml-2"
            style="width:70px;"
          ></b-form-input>
        </div>
      </div>
    </div>
    <template #modal-footer>
      <b-button variant="primary" @click="done">Done</b-button>
      <b-button class="ml-2" @click="cancel">Cancel</b-button>
    </template>
  </b-modal>
</template>

<script>
module.exports = {
  data() {
    return {
      search: '',
      selected: []
    }
  },
  computed: {
    showModal: {
      get() {
        return $getGlobalModel('showPartsModal')
      },
      set(val) {
        $setGlobalModel('showPartsModal', val)
      }
    },
    filteredParts() {
      const term = this.search.toLowerCase()
      return $getGrid('parts').filter(
        p =>
          !term ||
          (p.name && p.name.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term))
      )
    }
  },
  methods: {
    addPart(part) {
      this.selected.push({ part: part.rowKey, quantity: 1 })
    },
    getPartName(key) {
      const p = $getRow('parts', key)
      return p ? p.name : key
    },
    done() {
      window.addSelectedPartsToOrder(this.selected)
      this.selected = []
    },
    cancel() {
      $setGlobalModel('showPartsModal', false)
      this.selected = []
    }
  }
}
</script>
