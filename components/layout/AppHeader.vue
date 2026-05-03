<template>
  <header class="app-header">
    <div class="header-left">
      <div class="app-logo">
        <img src="/virtual-networks.svg" class="logo-img" alt="" />
        <span class="logo-text">Azure VNet Simulator</span>
      </div>
    </div>

    <div class="header-center toolbar-components">
      <div v-for="group in componentGroups" :key="group.label" class="component-group">
        <span class="group-label">{{ group.label }}</span>
        <div class="group-items">
          <Button
            v-for="item in group.items"
            :key="item.type"
            v-tooltip.bottom="item.label"
            text
            size="small"
            class="component-btn"
            @click="addComponent(item.type)"
          >
            <Icon :icon="item.icon" :style="{ color: item.color }" class="btn-icon" />
          </Button>
        </div>
      </div>
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
        v-tooltip.bottom="authStore.user?.email"
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
import { Icon } from '@iconify/vue'
import {
  NetworkComponentType,
  COMPONENT_CATEGORY_ORDER,
  COMPONENTS_BY_CATEGORY,
  getComponentIcon,
  getComponentLabel,
  getComponentColor,
} from '~/types/network'

const authStore = useAuthStore()
const diagramStore = useDiagramStore()
const settingsStore = useSettingsStore()
const savedSetupsStore = useSavedSetupsStore()

const componentGroups = COMPONENT_CATEGORY_ORDER.map((label) => ({
  label,
  items: COMPONENTS_BY_CATEGORY[label].map((type) => ({
    type,
    label: getComponentLabel(type),
    icon: getComponentIcon(type),
    color: getComponentColor(type),
  })),
}))

function addComponent(type: NetworkComponentType) {
  diagramStore.openAddComponentModal(type)
}

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
  gap: 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.header-center::-webkit-scrollbar { display: none; }

/* Each category group is a labelled card: label on top, icon row below */
.component-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0;
  border-radius: 7px;
  background: var(--group-card-bg, rgba(0, 0, 0, 0.07));
  border: 1.5px solid var(--group-card-border, rgba(0, 0, 0, 0.2));
  box-shadow: var(--group-card-shadow, 0 1px 4px rgba(0, 0, 0, 0.12));
}

.group-label {
  font-size: 0.65rem;
  color: var(--text-color-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.group-items {
  display: flex;
  gap: 2px;
}

.component-btn {
  width: 38px !important;
  height: 38px !important;
  padding: 0 !important;
}

.btn-icon {
  font-size: 1.5rem;
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
</style>
