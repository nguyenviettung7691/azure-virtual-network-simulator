<template>
  <header class="app-header">
    <div class="header-left">
      <div class="app-logo">
        <img src="/virtual-networks.svg" class="logo-img" alt="" />
        <span class="logo-text">Azure VNet Simulator</span>
      </div>
    </div>

    <div class="header-center">
      <ComponentCommandPalette />
    </div>

    <div class="header-right">
      <Button
        v-tooltip.bottom="'Saved Setups'"
        icon="pi pi-folder"
        text
        size="small"
        severity="secondary"
        class="header-btn"
        @click="openSetups"
      />
      <Button
        v-if="!authStore.isAuthenticated"
        label="Sign In"
        icon="pi pi-user"
        size="small"
        class="header-btn sign-in-btn"
        @click="authStore.openAuthModal('login')"
      />
      <Button
        v-else
        v-tooltip.bottom="'Account Settings'"
        icon="pi pi-user"
        text
        size="small"
        severity="secondary"
        class="header-btn"
        @click="settingsStore.openSettingsModal()"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const savedSetupsStore = useSavedSetupsStore()

function openSetups() {
  if (!authStore.isAuthenticated) {
    authStore.openAuthModal('login')
    return
  }
  savedSetupsStore.openModal()
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  height: var(--header-height);
  min-height: var(--header-height);
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  z-index: 100;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 180px;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-img {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}

.logo-text {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--primary-color);
  white-space: nowrap;
}

.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.header-center > * {
  width: auto;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 140px;
  justify-content: flex-end;
}

.sign-in-btn {
  background: var(--primary-color) !important;
  color: var(--primary-color-text) !important;
}

@media (max-width: 1024px) {
  .app-header {
    gap: 0.35rem;
    padding: 0 0.5rem;
    height: 74px;
    min-height: 74px;
  }

  .header-left {
    min-width: 44px;
  }

  .logo-img {
    width: 30px;
    height: 30px;
  }

  .logo-text {
    display: none;
  }

  .header-center {
    padding: 0 0.2rem;
  }

  .header-right {
    min-width: auto;
    gap: 0.15rem;
  }

  .header-right .header-btn {
    width: 33px;
    height: 33px;
    padding: 0;
  }

  .sign-in-btn :deep(.p-button-label) {
    display: none;
  }
}
</style>
