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
      <Icon icon="mdi:folder-open-outline" class="empty-icon" />
      <p>No saved setups yet</p>
      <small>Use the "Save Setup" button in the bottom toolbar to save your current diagram</small>
    </div>

    <div v-else class="setups-grid">
      <div v-for="setup in setups" :key="setup.id" class="setup-card">
        <div
          class="setup-thumbnail"
          @mouseenter="onThumbnailEnter(setup.id, $event, setup.thumbnail)"
          @mousemove="onThumbnailMove(setup.id, $event)"
          @mouseleave="onThumbnailLeave"
        >
          <img v-if="setup.thumbnail" :src="setup.thumbnail" alt="Setup preview" />
          <div v-else class="no-thumbnail">
            <Icon icon="mdi:image-off" />
          </div>
          <div
            v-if="activeZoom?.setupId === setup.id"
            class="thumbnail-magnifier"
            :style="magnifierStyle"
            aria-hidden="true"
          />
        </div>
        <div class="setup-info">
          <span class="setup-name">{{ setup.name }}</span>
          <span class="setup-date">{{ formatDate(setup.createdAt) }}</span>
          <span class="setup-nodes">{{ setup.diagram?.nodes?.length || 0 }} components</span>
          <span class="setup-tests">{{ setup.tests?.length || 0 }} tests</span>
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
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { SavedSetup } from '~/types/diagram'

const authStore = useAuthStore()
const savedSetupsStore = useSavedSetupsStore()
const diagramStore = useDiagramStore()
const testsStore = useTestsStore()
const usingSetupId = ref<string | null>(null)
const hoverMagnifierEnabled = ref(false)

interface ActiveZoomState {
  setupId: string
  src: string
  xPercent: number
  yPercent: number
}

const activeZoom = ref<ActiveZoomState | null>(null)
const MAGNIFIER_ZOOM_FACTOR = 2.4
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

const magnifierStyle = computed<Record<string, string>>(() => {
  if (!activeZoom.value) {
    return {}
  }

  return {
    '--zoom-x': `${activeZoom.value.xPercent}`,
    '--zoom-y': `${activeZoom.value.yPercent}`,
    '--zoom-factor': String(MAGNIFIER_ZOOM_FACTOR),
    backgroundImage: `url(${activeZoom.value.src})`,
  }
})

function updateZoomPosition(setupId: string, event: MouseEvent) {
  if (!hoverMagnifierEnabled.value || !activeZoom.value || activeZoom.value.setupId !== setupId) {
    return
  }

  const target = event.currentTarget as HTMLElement | null
  if (!target) return

  const rect = target.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const xPercent = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
  const yPercent = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))

  activeZoom.value = {
    ...activeZoom.value,
    xPercent,
    yPercent,
  }
}

function onThumbnailEnter(setupId: string, event: MouseEvent, src?: string) {
  if (!hoverMagnifierEnabled.value || !src) return

  activeZoom.value = {
    setupId,
    src,
    xPercent: 50,
    yPercent: 50,
  }

  updateZoomPosition(setupId, event)
}

function onThumbnailMove(setupId: string, event: MouseEvent) {
  updateZoomPosition(setupId, event)
}

function onThumbnailLeave() {
  activeZoom.value = null
}

onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    hoverMagnifierEnabled.value = false
    return
  }

  hoverMagnifierEnabled.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
})

onBeforeUnmount(() => {
  activeZoom.value = null
})

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
.thumbnail-magnifier {
  width: 130px;
  height: 130px;
  position: absolute;
  left: calc(var(--zoom-x) * 1%);
  top: calc(var(--zoom-y) * 1%);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--surface-0) 70%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.26);
  background-repeat: no-repeat;
  background-size: calc(var(--zoom-factor) * 100%) calc(var(--zoom-factor) * 100%);
  background-position: calc(var(--zoom-x) * (var(--zoom-factor) - 1) * -1%) calc(var(--zoom-y) * (var(--zoom-factor) - 1) * -1%);
  backdrop-filter: saturate(1.15);
  pointer-events: none;
}
.no-thumbnail { font-size: 2.2rem; color: var(--text-color-secondary); opacity: 0.3; }
.setup-info { padding: 0.7rem 0.72rem; display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
.setup-name { font-weight: 700; font-size: 0.96rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setup-date, .setup-nodes, .setup-tests { font-size: 0.8rem; color: var(--text-color-secondary); }
.setup-actions { display: flex; gap: 0.35rem; padding: 0.55rem 0.6rem; border-top: 1px solid var(--surface-border); }

@media (max-width: 900px) {
  .setups-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 0.85rem;
  }

  .setup-thumbnail {
    height: 158px;
  }

  .thumbnail-magnifier {
    display: none;
  }
}
</style>
