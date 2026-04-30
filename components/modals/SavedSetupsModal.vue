<template>
  <Dialog
    v-model:visible="savedSetupsStore.showModal"
    modal
    header="My Saved Setups"
    :style="{ width: '700px' }"
    @hide="savedSetupsStore.closeModal()"
  >
    <div v-if="savedSetupsStore.isLoading" class="loading-state">
      <ProgressSpinner />
      <p>Loading setups...</p>
    </div>

    <div v-else-if="savedSetupsStore.setups.length === 0" class="empty-state">
      <Icon icon="mdi:folder-open-outline" class="empty-icon" />
      <p>No saved setups yet</p>
      <small>Use the "Save Setup" button in the bottom toolbar to save your current diagram</small>
    </div>

    <div v-else class="setups-grid">
      <div v-for="setup in savedSetupsStore.setups" :key="setup.id" class="setup-card">
        <div class="setup-thumbnail">
          <img v-if="setup.thumbnail" :src="setup.thumbnail" alt="Setup preview" />
          <div v-else class="no-thumbnail">
            <Icon icon="mdi:image-off" />
          </div>
        </div>
        <div class="setup-info">
          <span class="setup-name">{{ setup.name }}</span>
          <span class="setup-date">{{ formatDate(setup.createdAt) }}</span>
          <span class="setup-nodes">{{ setup.diagram?.nodes?.length || 0 }} components</span>
        </div>
        <div class="setup-actions">
          <Button label="Use" icon="pi pi-check" size="small" @click="useSetup(setup)" />
          <Button label="Delete" icon="pi pi-trash" size="small" severity="danger" text @click="deleteSetup(setup)" />
        </div>
      </div>
    </div>

    <Message v-if="savedSetupsStore.error" severity="error" :closable="false">{{ savedSetupsStore.error }}</Message>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { SavedSetup } from '~/types/diagram'

const savedSetupsStore = useSavedSetupsStore()
const diagramStore = useDiagramStore()

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function useSetup(setup: SavedSetup) {
  diagramStore.confirmAction(
    `Load "${setup.name}"? This will replace your current diagram.`,
    () => savedSetupsStore.loadSetupIntoDiagram(setup)
  )
}

function deleteSetup(setup: SavedSetup) {
  diagramStore.confirmAction(
    `Delete "${setup.name}"? This cannot be undone.`,
    () => savedSetupsStore.deleteSetup(setup.id)
  )
}
</script>

<style scoped>
.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2rem; color: var(--text-color-secondary); text-align: center; }
.empty-icon { font-size: 3rem; opacity: 0.3; }
.setups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; max-height: 60vh; overflow-y: auto; padding: 0.25rem; }
.setup-card { border: 1px solid var(--surface-border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; background: var(--surface-ground); transition: box-shadow 0.2s; }
.setup-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.setup-thumbnail { height: 120px; background: var(--surface-section); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.setup-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.no-thumbnail { font-size: 2rem; color: var(--text-color-secondary); opacity: 0.3; }
.setup-info { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.15rem; flex: 1; }
.setup-name { font-weight: 700; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setup-date, .setup-nodes { font-size: 0.72rem; color: var(--text-color-secondary); }
.setup-actions { display: flex; gap: 0.3rem; padding: 0.4rem; border-top: 1px solid var(--surface-border); }
</style>
