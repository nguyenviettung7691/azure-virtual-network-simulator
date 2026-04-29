<template>
  <NuxtPage />
</template>

<script setup lang="ts">
import { configureAWS } from '~/lib/aws'

const settingsStore = useSettingsStore()

onMounted(() => {
  configureAWS()
  settingsStore.loadFromLocalStorage()
  const authStore = useAuthStore()
  authStore.fetchUser()
})
</script>
