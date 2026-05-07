import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { getUserSettings, saveUserSettings } from '~/lib/mongodb'
import type { UserSettings } from '~/types/settings'

const SETTINGS_SYNC_DELAY_MS = 1500

export function userSettingsQueryKey(userId: string) {
  return ['settings', 'remote', userId] as const
}

function resolveSyncErrorMessage(error: unknown, fallback: string) {
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

function serializeSettings(settings: UserSettings) {
  return JSON.stringify(settings)
}

function useMongoConfig() {
  const config = useRuntimeConfig().public

  return {
    mongodbEndpoint: config.mongodbEndpoint,
    mongodbApiKey: config.mongodbApiKey,
    mongodbDatabase: config.mongodbDatabase,
    mongodbCollection: config.mongodbCollection,
  }
}

export function useUserSettingsQuery(
  userId: MaybeRefOrGetter<string | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const mongoConfig = useMongoConfig()

  return useQuery({
    queryKey: computed(() => {
      const resolvedUserId = toValue(userId)
      return resolvedUserId ? userSettingsQueryKey(resolvedUserId) : ['settings', 'remote', 'anonymous'] as const
    }),
    queryFn: async () => {
      const resolvedUserId = toValue(userId)
      if (!resolvedUserId) {
        return null
      }

      return getUserSettings(resolvedUserId, mongoConfig)
    },
    enabled: computed(() => Boolean(toValue(enabled) && toValue(userId))),
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useSaveUserSettingsMutation() {
  const settingsStore = useSettingsStore()
  const mongoConfig = useMongoConfig()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, settings }: { userId: string, settings: UserSettings }) => {
      await saveUserSettings(userId, settings, mongoConfig)

      return { userId, settings }
    },
    onMutate: () => {
      settingsStore.setSyncError(null)
    },
    onSuccess: ({ userId, settings }) => {
      queryClient.setQueryData(userSettingsQueryKey(userId), settings)
    },
    onError: (error) => {
      settingsStore.setSyncError(resolveSyncErrorMessage(error, 'Failed to save settings to MongoDB'))
    },
  })
}

export function useSettingsSync(enabled: MaybeRefOrGetter<boolean>) {
  const settingsStore = useSettingsStore()
  const currentUserId = computed(() => settingsStore.currentUserId)
  const syncEnabled = computed(() => Boolean(toValue(enabled) && currentUserId.value))
  const settingsQuery = useUserSettingsQuery(currentUserId, syncEnabled)
  const saveMutation = useSaveUserSettingsMutation()
  const settingsSnapshot = computed(() => serializeSettings(settingsStore.settings))

  const applyingRemoteSettings = ref(false)
  const lastRemoteSnapshot = ref<string | null>(null)
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function clearSaveTimer() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  watch(
    () => currentUserId.value,
    (userId) => {
      clearSaveTimer()
      lastRemoteSnapshot.value = null

      if (!userId) {
        settingsStore.setSyncing(false)
        settingsStore.setSyncError(null)
      }
    },
    { immediate: true },
  )

  watch(
    [() => settingsQuery.data.value, () => settingsQuery.isFetched.value, () => currentUserId.value],
    ([remoteSettings, isFetched, userId]) => {
      if (!userId || !isFetched) {
        return
      }

      if (remoteSettings) {
        applyingRemoteSettings.value = true
        settingsStore.applyRemoteSettings(remoteSettings)
        applyingRemoteSettings.value = false
        lastRemoteSnapshot.value = serializeSettings(remoteSettings)
        return
      }

      lastRemoteSnapshot.value = settingsSnapshot.value
    },
    { immediate: true },
  )

  watch(
    [() => settingsQuery.isPending.value, () => saveMutation.isPending.value, () => currentUserId.value],
    ([queryPending, mutationPending, userId]) => {
      settingsStore.setSyncing(Boolean(userId) && (queryPending || mutationPending))
    },
    { immediate: true },
  )

  watch(
    () => settingsSnapshot.value,
    (serializedSettings) => {
      const userId = currentUserId.value

      if (!syncEnabled.value || !userId || applyingRemoteSettings.value || lastRemoteSnapshot.value === null) {
        return
      }

      if (serializedSettings === lastRemoteSnapshot.value) {
        return
      }

      clearSaveTimer()
      saveTimer = setTimeout(async () => {
        try {
          await saveMutation.mutateAsync({
            userId,
            settings: JSON.parse(serializedSettings) as UserSettings,
          })
          lastRemoteSnapshot.value = serializedSettings
        } finally {
          saveTimer = null
        }
      }, SETTINGS_SYNC_DELAY_MS)
    },
  )

  onScopeDispose(() => {
    clearSaveTimer()
  })

  return {
    settingsQuery,
    saveMutation,
  }
}