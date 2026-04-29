import { uploadDiagram, getDiagram, deleteDiagram, uploadThumbnail } from '~/lib/s3'
import type { SavedSetup } from '~/types/diagram'

export const useS3 = () => {
  const authStore = useAuthStore()
  const diagramStore = useDiagramStore()
  const { captureThumbnail } = useExport()

  const savedSetups = ref<SavedSetup[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function saveCurrentSetup(name: string, description?: string): Promise<boolean> {
    if (!authStore.isAuthenticated || !authStore.userId) return false
    isLoading.value = true
    error.value = null
    try {
      const setupId = `setup-${Date.now()}`
      const thumbnail = await captureThumbnail()
      const state = diagramStore.diagramState
      await uploadDiagram(authStore.userId, setupId, state)
      if (thumbnail) {
        await uploadThumbnail(authStore.userId, setupId, thumbnail)
      }
      const setups = getLocalSetups(authStore.userId)
      const now = new Date().toISOString()
      setups.push({
        id: setupId,
        name,
        description,
        thumbnailUrl: thumbnail || undefined,
        state,
        createdAt: now,
        updatedAt: now,
      })
      saveLocalSetups(authStore.userId, setups)
      await loadSetups()
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to save setup'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function loadSetups(): Promise<void> {
    if (!authStore.isAuthenticated || !authStore.userId) {
      savedSetups.value = []
      return
    }
    isLoading.value = true
    try {
      savedSetups.value = getLocalSetups(authStore.userId)
    } catch (err: any) {
      error.value = err.message || 'Failed to load setups'
    } finally {
      isLoading.value = false
    }
  }

  async function loadSetup(setupId: string): Promise<boolean> {
    if (!authStore.isAuthenticated || !authStore.userId) return false
    isLoading.value = true
    try {
      const setups = getLocalSetups(authStore.userId)
      const setup = setups.find(s => s.id === setupId)
      if (setup) {
        diagramStore.loadDiagram(setup.state)
        return true
      }
      const state = await getDiagram(authStore.userId, setupId)
      if (state) {
        diagramStore.loadDiagram(state)
        return true
      }
      return false
    } catch (err: any) {
      error.value = err.message || 'Failed to load setup'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSetup(setupId: string): Promise<boolean> {
    if (!authStore.isAuthenticated || !authStore.userId) return false
    isLoading.value = true
    try {
      const setups = getLocalSetups(authStore.userId)
      const filtered = setups.filter(s => s.id !== setupId)
      saveLocalSetups(authStore.userId, filtered)
      try {
        await deleteDiagram(authStore.userId, setupId)
      } catch {
        // S3 deletion is best-effort
      }
      savedSetups.value = filtered
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to delete setup'
      return false
    } finally {
      isLoading.value = false
    }
  }

  function getLocalSetups(userId: string): SavedSetup[] {
    if (typeof localStorage === 'undefined') return []
    try {
      const data = localStorage.getItem(`vnet-setups-${userId}`)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  function saveLocalSetups(userId: string, setups: SavedSetup[]) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(`vnet-setups-${userId}`, JSON.stringify(setups))
  }

  return {
    savedSetups,
    isLoading,
    error,
    saveCurrentSetup,
    loadSetups,
    loadSetup,
    deleteSetup,
  }
}
