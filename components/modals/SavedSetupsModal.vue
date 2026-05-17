<template>
  <Dialog
    v-model:visible="savedSetupsStore.showModal"
    modal
    header="My Saved Setups"
    :style="{ width: 'min(1100px, 94vw)' }"
    :breakpoints="{ '1200px': '94vw', '900px': '96vw', '640px': '98vw' }"
    @hide="savedSetupsStore.closeModal()"
  >
    <div v-if="isLoading" class="loading-state">
      <ProgressSpinner />
      <p>Loading setups...</p>
    </div>

    <div v-else-if="isUsingAnySetup" class="loading-state applying-state">
      <ProgressSpinner style="width: 22px; height: 22px" strokeWidth="6" />
      <p>Loading selected setup...</p>
    </div>

    <div v-else-if="setups.length === 0" class="empty-state">
      <IconifyIcon icon="mdi:folder-open-outline" class="empty-icon" />
      <p>No saved setups yet</p>
      <small>Use the "Save Setup" button in the bottom toolbar to save your current diagram</small>
    </div>

    <div v-else class="setups-grid">
      <div v-for="setup in setups" :key="setup.id" class="setup-card">
        <div
          class="setup-thumbnail"
        >
          <img v-if="setup.thumbnail" :src="setup.thumbnail" alt="Setup preview" />
          <div v-else class="no-thumbnail">
            <IconifyIcon icon="mdi:image-off" />
          </div>
          <Button
            v-if="setup.thumbnail"
            class="thumbnail-fullsize-btn"
            severity="secondary"
            text
            rounded
            size="small"
            v-tooltip.left="'Open full size preview'"
            :aria-label="`Open full size preview for ${setup.name}`"
            @click="openThumbnailPreview(setup)"
          >
            <template #icon>
              <IconifyIcon icon="mdi:fullscreen" />
            </template>
          </Button>
        </div>
        <div class="setup-info">
          <span class="setup-name">{{ setup.name }}</span>
          <div class="setup-meta-grid">
            <span class="setup-meta-row">
              <IconifyIcon icon="mdi:calendar-month-outline" class="setup-meta-icon" />
              <span class="setup-meta-label">Saved</span>
              <span class="setup-meta-value">{{ formatDate(setup.createdAt) }}</span>
            </span>
            <span class="setup-meta-row">
              <IconifyIcon icon="mdi:vector-arrange-above" class="setup-meta-icon" />
              <span class="setup-meta-label">Components</span>
              <span class="setup-meta-value">{{ setup.diagram?.nodes?.length || 0 }}</span>
            </span>
            <span class="setup-meta-row">
              <IconifyIcon icon="mdi:clipboard-check-outline" class="setup-meta-icon" />
              <span class="setup-meta-label">Tests</span>
              <span class="setup-meta-value">{{ setup.tests?.length || 0 }}</span>
            </span>
          </div>
        </div>
        <div class="setup-actions">
          <Button
            label="Use"
            icon="pi pi-check"
            size="small"
            :loading="usingSetupId === setup.id"
            :disabled="isUsingAnySetup"
            @click="useSetup(setup)"
          />
          <Button label="Delete" icon="pi pi-trash" size="small" severity="danger" text :loading="deleteSavedSetupMutation.isPending.value" :disabled="deleteSavedSetupMutation.isPending.value" @click="deleteSetup(setup)" />
        </div>
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
  </Dialog>

  <Dialog
    v-model:visible="showThumbnailPreview"
    modal
    header="Setup Preview"
    :style="{ width: 'min(1400px, 96vw)' }"
    :breakpoints="{ '1200px': '98vw', '900px': '98vw', '640px': '99vw' }"
  >
    <div class="thumbnail-preview-wrap">
      <img
        v-if="selectedThumbnailSrc"
        class="thumbnail-preview-image"
        :src="selectedThumbnailSrc"
        :alt="selectedThumbnailAlt"
      />
      <div v-else class="thumbnail-preview-empty">
        <IconifyIcon icon="mdi:image-off" />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon as IconifyIcon } from '@iconify/vue'
import type { SavedSetup } from '~/types/diagram'

const authStore = useAuthStore()
const savedSetupsStore = useSavedSetupsStore()
const diagramStore = useDiagramStore()
const testsStore = useTestsStore()
const usingSetupId = ref<string | null>(null)
const showThumbnailPreview = ref(false)
const selectedThumbnailSrc = ref<string | null>(null)
const selectedThumbnailAlt = ref('Setup preview')
const savedSetupsQuery = useSavedSetupsQuery(
  computed(() => authStore.userId),
  computed(() => savedSetupsStore.showModal && authStore.isAuthenticated),
)
const deleteSavedSetupMutation = useDeleteSavedSetupMutation()

const setups = computed(() => savedSetupsQuery.data.value ?? [])
const isLoading = computed(() => savedSetupsQuery.isPending.value)
const isUsingAnySetup = computed(() => usingSetupId.value !== null)
const errorMessage = computed(() => {
  if (deleteSavedSetupMutation.error.value) {
    return resolveSavedSetupErrorMessage(deleteSavedSetupMutation.error.value, 'Failed to delete setup')
  }

  if (savedSetupsQuery.error.value) {
    return resolveSavedSetupErrorMessage(savedSetupsQuery.error.value, 'Failed to load setups')
  }

  return null
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function openThumbnailPreview(setup: SavedSetup) {
  if (!setup.thumbnail) {
    return
  }

  selectedThumbnailSrc.value = setup.thumbnail
  selectedThumbnailAlt.value = `${setup.name} preview`
  showThumbnailPreview.value = true
}

function useSetup(setup: SavedSetup) {
  diagramStore.confirmAction(
    `Load "${setup.name}"? This will replace your current diagram.`,
    async () => {
      usingSetupId.value = setup.id

      const renderReady = diagramStore.waitForNextLoadRender()
      diagramStore.loadDiagram(setup.diagram)
      testsStore.replaceTests(setup.tests ?? [])

      try {
        await renderReady
        savedSetupsStore.closeModal()
      } finally {
        usingSetupId.value = null
      }
    },
  )
}

function deleteSetup(setup: SavedSetup) {
  diagramStore.confirmAction(
    `Delete "${setup.name}"? This cannot be undone.`,
    () => {
      void deleteSavedSetupMutation.mutateAsync(setup.id)
    },
  )
}
</script>

<style scoped>
.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2.4rem; color: var(--text-color-secondary); text-align: center; }
.empty-icon { font-size: 3rem; opacity: 0.3; }
.setups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1.1rem; max-height: 64vh; overflow-y: auto; padding: 0.25rem; }
.setup-card { border: 1px solid var(--surface-border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; background: var(--surface-ground); transition: box-shadow 0.2s, transform 0.2s; }
.setup-card:hover { box-shadow: 0 8px 22px rgba(0,0,0,0.16); transform: translateY(-1px); }
.setup-thumbnail { height: 180px; background: var(--surface-section); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
.setup-thumbnail img { width: 100%; height: 100%; object-fit: contain; object-position: center; }
.thumbnail-fullsize-btn {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  width: 2rem;
  height: 2rem;
  color: var(--text-color);
  background: color-mix(in srgb, var(--surface-0) 88%, transparent) !important;
  border: 1px solid color-mix(in srgb, var(--surface-border) 65%, transparent);
  backdrop-filter: blur(1.2px);
}
.thumbnail-fullsize-btn :deep(.iconify) {
  font-size: 1rem;
}
.thumbnail-preview-wrap {
  min-height: min(80vh, 740px);
  max-height: min(80vh, 740px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--surface-section) 75%, var(--surface-ground));
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 0.7rem;
}
.thumbnail-preview-image {
  max-width: 100%;
  max-height: calc(min(80vh, 740px) - 1.4rem);
  width: auto;
  height: auto;
  object-fit: contain;
}
.thumbnail-preview-empty {
  font-size: 2.2rem;
  color: var(--text-color-secondary);
  opacity: 0.35;
}
.no-thumbnail { font-size: 2.2rem; color: var(--text-color-secondary); opacity: 0.3; }
.setup-info { padding: 0.74rem 0.72rem; display: flex; flex-direction: column; gap: 0.42rem; flex: 1; }
.setup-name { font-weight: 700; font-size: 0.96rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setup-meta-grid { display: flex; flex-direction: column; gap: 0.24rem; }
.setup-meta-row { display: grid; grid-template-columns: 0.9rem auto 1fr; align-items: center; gap: 0.36rem; font-size: 0.78rem; color: var(--text-color-secondary); }
.setup-meta-icon { font-size: 0.84rem; opacity: 0.86; }
.setup-meta-label { font-weight: 600; color: color-mix(in srgb, var(--text-color-secondary) 82%, var(--text-color)); }
.setup-meta-value { text-align: right; color: var(--text-color); }
.setup-actions { display: flex; gap: 0.35rem; padding: 0.55rem 0.6rem; border-top: 1px solid var(--surface-border); }

@media (max-width: 900px) {
  .setups-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 0.85rem;
  }

  .setup-thumbnail {
    height: 158px;
  }
}
</style>
