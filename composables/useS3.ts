import { getSavedSetup } from '~/lib/s3'
import {
  resolveSavedSetupErrorMessage,
  useDeleteSavedSetupMutation,
  useSaveCurrentSetupMutation,
  useSavedSetupsQuery,
} from '~/composables/useSavedSetupQueries'
import type { SavedSetup } from '~/types/diagram'

export const useS3 = () => {
  const authStore = useAuthStore()
  const diagramStore = useDiagramStore()
  const userId = computed(() => authStore.userId)
  const savedSetupsQuery = useSavedSetupsQuery(userId, computed(() => authStore.isAuthenticated))
  const saveCurrentSetupMutation = useSaveCurrentSetupMutation()
  const deleteSavedSetupMutation = useDeleteSavedSetupMutation()
  const loadError = ref<string | null>(null)

  const savedSetups = computed<SavedSetup[]>(() => savedSetupsQuery.data.value ?? [])
  const isLoading = computed(() => {
    return savedSetupsQuery.isPending.value
      || saveCurrentSetupMutation.isPending.value
      || deleteSavedSetupMutation.isPending.value
  })
  const error = computed(() => {
    if (loadError.value) {
      return loadError.value
    }

    const sourceError = savedSetupsQuery.error.value
      || saveCurrentSetupMutation.error.value
      || deleteSavedSetupMutation.error.value

    return sourceError
      ? resolveSavedSetupErrorMessage(sourceError, 'Saved setup request failed')
      : null
  })

  async function saveCurrentSetup(name: string, description?: string): Promise<boolean> {
    try {
      await saveCurrentSetupMutation.mutateAsync({ name, description })
      return true
    } catch {
      return false
    }
  }

  async function loadSetups(): Promise<void> {
    if (!authStore.isAuthenticated || !authStore.userId) {
      return
    }

    try {
      loadError.value = null
      await savedSetupsQuery.refetch()
    } catch (error) {
      loadError.value = resolveSavedSetupErrorMessage(error, 'Failed to load setups')
    }
  }

  async function loadSetup(setupId: string): Promise<boolean> {
    if (!authStore.isAuthenticated || !authStore.userId) return false

    try {
      loadError.value = null
      const setup = savedSetups.value.find(savedSetup => savedSetup.id === setupId)
        || await getSavedSetup(authStore.userId, setupId)

      if (setup) {
        diagramStore.loadDiagram(setup.diagram)
        return true
      }

      return false
    } catch (error) {
      loadError.value = resolveSavedSetupErrorMessage(error, 'Failed to load setup')
      return false
    }
  }

  async function deleteSetup(setupId: string): Promise<boolean> {
    try {
      await deleteSavedSetupMutation.mutateAsync(setupId)
      return true
    } catch {
      return false
    }
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
