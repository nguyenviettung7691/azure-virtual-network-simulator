<template>
  <Dialog
    v-model:visible="diagramStore.showConfirmDialog"
    modal
    header="Confirm Action"
    :style="{ width: '380px' }"
    @hide="diagramStore.cancelConfirmDialog()"
  >
    <div class="confirm-content">
      <Icon icon="mdi:alert-circle-outline" class="confirm-icon" />
      <p class="confirm-message">{{ diagramStore.confirmDialogMessage }}</p>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="diagramStore.cancelConfirmDialog()" />
      <Button label="Confirm" icon="pi pi-check" severity="danger" @click="diagramStore.executeConfirmedAction()" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
const diagramStore = useDiagramStore()
</script>

<style scoped>
.confirm-content { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem 0; }
.confirm-icon { font-size: 2rem; color: var(--yellow-500); flex-shrink: 0; margin-top: 0.1rem; }
.confirm-message { font-size: 0.9rem; line-height: 1.5; margin: 0; }
</style>
