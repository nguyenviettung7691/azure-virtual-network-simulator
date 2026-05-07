<template>
  <NuxtPage />
</template>

<script setup lang="ts">
import { configureAWS } from '~/lib/aws'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const awsReady = ref(false)
const currentUserQuery = useCurrentUserQuery(awsReady)

useSettingsSync(awsReady)

watch(
  [() => currentUserQuery.data.value, () => currentUserQuery.isFetched.value],
  ([user, isFetched]) => {
    if (!isFetched) {
      return
    }

    if (user) {
      authStore.hydrateUser(user)
      settingsStore.setCurrentUser(user.userId)

      return
    }

    authStore.clearUser()
  },
  { immediate: true },
)

watch(
  () => currentUserQuery.isPending.value,
  (isPending) => {
    authStore.setLoading(awsReady.value && isPending)
  },
  { immediate: true },
)

onMounted(() => {
  configureAWS()
  settingsStore.loadFromLocalStorage()
  awsReady.value = true
})
</script>
