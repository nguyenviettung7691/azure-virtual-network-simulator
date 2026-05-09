import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { deleteSavedSetup, listSavedSetups, saveSavedSetup } from '~/lib/s3'
import type { SavedSetup } from '~/types/diagram'

export function savedSetupsQueryKey(userId: string) {
  return ['saved-setups', userId] as const
}

export function resolveSavedSetupErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) {
      return message
    }
  }

  return fallback
}

export function useSavedSetupsQuery(
  userId: MaybeRefOrGetter<string | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery({
    queryKey: computed(() => {
      const resolvedUserId = toValue(userId)
      return resolvedUserId ? savedSetupsQueryKey(resolvedUserId) : ['saved-setups', 'anonymous'] as const
    }),
    queryFn: async () => {
      const resolvedUserId = toValue(userId)
      if (!resolvedUserId) {
        return [] as SavedSetup[]
      }

      return listSavedSetups(resolvedUserId)
    },
    enabled: computed(() => Boolean(toValue(enabled) && toValue(userId))),
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useSaveCurrentSetupMutation() {
  const authStore = useAuthStore()
  const diagramStore = useDiagramStore()
  const testsStore = useTestsStore()
  const { captureThumbnail } = useExport()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, description }: { name: string, description?: string }) => {
      if (!authStore.userId) {
        throw new Error('Not authenticated')
      }

      const timestamp = new Date().toISOString()
      const setup: SavedSetup = {
        id: `setup-${Date.now()}`,
        name,
        description,
        createdAt: timestamp,
        updatedAt: timestamp,
        thumbnail: (await captureThumbnail()) || undefined,
        diagram: diagramStore.diagramState,
        tests: testsStore.tests.map(test => ({ ...test })),
      }

      await saveSavedSetup(authStore.userId, setup)

      return { userId: authStore.userId, setup }
    },
    onSuccess: ({ userId, setup }) => {
      queryClient.setQueryData(savedSetupsQueryKey(userId), (current: SavedSetup[] | undefined) => {
        return [setup, ...(current ?? []).filter(existing => existing.id !== setup.id)]
      })
      diagramStore.isDirty = false
    },
  })
}

export function useDeleteSavedSetupMutation() {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (setupId: string) => {
      if (!authStore.userId) {
        throw new Error('Not authenticated')
      }

      await deleteSavedSetup(authStore.userId, setupId)

      return { userId: authStore.userId, setupId }
    },
    onSuccess: ({ userId, setupId }) => {
      queryClient.setQueryData(savedSetupsQueryKey(userId), (current: SavedSetup[] | undefined) => {
        return (current ?? []).filter(setup => setup.id !== setupId)
      })
    },
  })
}