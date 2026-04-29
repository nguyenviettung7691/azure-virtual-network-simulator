import { defineStore } from 'pinia'
import type { SavedSetup } from '~/types/diagram'

interface SavedSetupsState {
  setups: SavedSetup[]
  isLoading: boolean
  showModal: boolean
  error: string | null
}

export const useSavedSetupsStore = defineStore('savedSetups', {
  state: (): SavedSetupsState => ({
    setups: [],
    isLoading: false,
    showModal: false,
    error: null,
  }),

  actions: {
    openModal() {
      this.showModal = true
      this.loadSetups()
    },

    closeModal() {
      this.showModal = false
    },

    async loadSetups() {
      this.isLoading = true
      this.error = null
      try {
        const { listDiagrams } = await import('~/lib/s3')
        const authStore = useAuthStore()
        if (!authStore.userId) return
        this.setups = await listDiagrams(authStore.userId)
      } catch (err: any) {
        this.error = err.message || 'Failed to load setups'
        this.setups = []
      } finally {
        this.isLoading = false
      }
    },

    async saveCurrentSetup(name: string) {
      const diagramStore = useDiagramStore()
      const authStore = useAuthStore()
      if (!authStore.userId) throw new Error('Not authenticated')

      const { uploadDiagram, uploadThumbnail } = await import('~/lib/s3')
      const { captureThumbnail } = useExport()

      const setupId = `setup-${Date.now()}`
      const thumbnail = await captureThumbnail()

      const setup: SavedSetup = {
        id: setupId,
        name,
        thumbnail: thumbnail || '',
        diagram: diagramStore.diagramState,
        createdAt: new Date().toISOString(),
      }

      await uploadDiagram(authStore.userId, setupId, setup)
      if (thumbnail) {
        await uploadThumbnail(authStore.userId, setupId, thumbnail)
      }

      this.setups = [setup, ...this.setups]
      diagramStore.isDirty = false
    },

    async deleteSetup(setupId: string) {
      const authStore = useAuthStore()
      if (!authStore.userId) return
      const { deleteDiagram } = await import('~/lib/s3')
      await deleteDiagram(authStore.userId, setupId)
      this.setups = this.setups.filter(s => s.id !== setupId)
    },

    async loadSetupIntoDiagram(setup: SavedSetup) {
      const diagramStore = useDiagramStore()
      diagramStore.loadDiagram(setup.diagram)
      this.closeModal()
    },
  },
})
