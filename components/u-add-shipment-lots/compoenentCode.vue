<template>
  <div style="width: 900px;">
    <!-- Displaying batches used -->
    <div v-if="batchesUsed.length > 0" class="mt-3">
      <div
        v-for="batch in batchesUsed"
        :key="batch.rowKey"
        class="flex flex-direction-row align-items-center"
      >
        <b-form-input
          style="flex: 0 0 20%"
          type="number"
          class="mx-3 mt-3"
          placeholder="Enter quantity"
          v-model="batch.quantityShipped"
          @input="batch.changed = true"
        ></b-form-input>
        <v-select
          style="flex: 0 0 40%"
          class="mt-3"
          :options="
            $getGrid('locationInventory')
              .filter((inv) => inv.part === rowData.part)
              .map((inv) => ({ 
                 title: `${inv.name||''} - ${new Date(inv.createdDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) || ''} - ${inv.quantity}`,
                 code: inv.rowKey }))
          "
          label="title"
          v-model="batch.batchUsed"
          @input="batch.changed = true"
          :reduce="(option) => option.code"
          :custom-label="(option) => getBatchDisplay(option)"
        ></v-select>
        <!-- <i v-if="batch.changed" class="fas fa-check mt-3 ml-1"></i> -->
        <b-button class="mt-3 ml-2" v-if="batch.changed" @click="confirmChange(batch)" variant="success">Confirm</b-button>
        <b-button class="mt-3 mx-2" @click="removeBatch(batch)" variant="danger">Delete</b-button>
      </div>
    </div>
    <div
      style="padding-bottom: 50px !important;"
      class="flex flex-direction-row align-items-center mb-3"
    >
      <b-form-input
        style="flex: 0 0 20%"
        type="number"
        class="mx-3 mt-3"
        placeholder="Enter quantity"
        v-model="batchOneQuantity"
      ></b-form-input>
      <v-select
        style="flex: 0 0 40%"
        class="mt-3"
        :options="
          $getGrid('locationInventory')
            .filter((inv) => inv.part === rowData.part )
            .map((inv) => ({ 
                 title: `${inv.name||''} - ${new Date(inv.createdDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) || ''} - ${inv.quantity}`,
            code: inv.rowKey }))
        "
        label="title"
        v-model="batchOneLocation"
      ></v-select>
      <b-button
        v-if="batchOneQuantity > 0 && batchOneLocation"
        class="mx-3 mt-3"
        variant="success"
        @click="addShipmentLots(batchOneQuantity, batchOneLocation)"
      >
        Add
      </b-button>
    </div>
  </div>
</template>

<script>
module.exports = {
  props: {
    rowData:{}
  },
  data() {
    return {
      batchOneQuantity: null,
      batchOneLocation: null,
      batchesUsed: [],
    };
  },
  mounted() {
    // Fetch batches used for the current rowData when component is mounted
    this.updateBatchesUsed();
  },
  computed: {
    locationInventoryOptions() {
      return $getGrid('locationInventory')
        .filter((inv) => inv.part === this.rowData.part)
        .map((inv) => ({
          title: inv.name,
          code: inv.rowKey,
        }));
    }
  },
  methods: {
    async updateBatchesUsed() {
      // Fetch batches used for the current rowData
      this.batchesUsed = $getGrid("batchesUsed").filter(
        (batch) => batch.shipmentLine === this.rowData.rowKey
      );
    },
    async confirmChange(batch) {
      console.log('batch change: ', batch)
      await $dgSetRowVals('batchesUsed', batch.rowKey, {
        quantityShipped: parseFloat(batch.quantityShipped),
        batchUsed: batch.batchUsed
      });
      batch.changed = false;
    },
    async addShipmentLots(batchOneQuantity, batchOneLocation) {
      try {
        console.log(
          "adding batches",
          this.rowData,
          this.batchOneQuantity,
          this.batchOneLocation,
        );
        // Assuming you have a function to add records to batchesUsed, let's call it addToBatchesUsed
        let newBatchUsed = await $dgAddRow("batchesUsed", {
          shipmentLine: this.rowData.rowKey,
          quantityShipped: batchOneQuantity,
          batchUsed: batchOneLocation.code,
          changed: false,
        });
        this.batchOneQuantity = null;
        this.batchOneLocation = null;
        console.log("Batch added successfully.");
      } catch (error) {
        console.error("Error adding batch:", error);
        // Handle error if needed
      }
    },
    async removeBatch(batch) {
      try {
        // Assuming you have a function to remove a batch, let's call it removeFromBatchesUsed
        await $dgRemoveRow("batchesUsed", batch.rowKey);
        // Update the batchesUsed list
        await this.updateBatchesUsed();
        console.log("Batch removed successfully.");
      } catch (error) {
        console.error("Error removing batch:", error);
        // Handle error if needed
      }
    },
    getBatchDisplay(option) {
      const selectedBatch = this.batchesUsed.find(
        (batch) => batch.batchUsed === option
      );
      const matchingOption = this.locationInventoryOptions.find(
        (opt) => opt.code === option
      );
      return selectedBatch
        ? selectedBatch.$batchUsed$display
        : matchingOption
        ? matchingOption.name
        : option;
    },
  },
}
</script>
