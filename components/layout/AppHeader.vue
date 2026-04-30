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
import { NetworkComponentType, getComponentIcon, getComponentLabel, getComponentColor } from '~/types/network'

const authStore = useAuthStore()
const diagramStore = useDiagramStore()
const settingsStore = useSettingsStore()
const savedSetupsStore = useSavedSetupsStore()

const componentGroups = [
  {
    label: 'Network',
    items: [
      { type: NetworkComponentType.VNET, label: 'Virtual Network', icon: getComponentIcon(NetworkComponentType.VNET), color: getComponentColor(NetworkComponentType.VNET) },
      { type: NetworkComponentType.SUBNET, label: 'Subnet', icon: getComponentIcon(NetworkComponentType.SUBNET), color: getComponentColor(NetworkComponentType.SUBNET) },
      { type: NetworkComponentType.NETWORK_IC, label: 'Network Interface', icon: getComponentIcon(NetworkComponentType.NETWORK_IC), color: getComponentColor(NetworkComponentType.NETWORK_IC) },
      { type: NetworkComponentType.IP_ADDRESS, label: 'Public IP', icon: getComponentIcon(NetworkComponentType.IP_ADDRESS), color: getComponentColor(NetworkComponentType.IP_ADDRESS) },
      { type: NetworkComponentType.DNS_ZONE, label: 'DNS Zone', icon: getComponentIcon(NetworkComponentType.DNS_ZONE), color: getComponentColor(NetworkComponentType.DNS_ZONE) },
      { type: NetworkComponentType.VNET_PEERING, label: 'VNet Peering', icon: getComponentIcon(NetworkComponentType.VNET_PEERING), color: getComponentColor(NetworkComponentType.VNET_PEERING) },
      { type: NetworkComponentType.UDR, label: 'Route Table', icon: getComponentIcon(NetworkComponentType.UDR), color: getComponentColor(NetworkComponentType.UDR) },
    ],
  },
  {
    label: 'Security',
    items: [
      { type: NetworkComponentType.NSG, label: 'NSG', icon: getComponentIcon(NetworkComponentType.NSG), color: getComponentColor(NetworkComponentType.NSG) },
      { type: NetworkComponentType.ASG, label: 'ASG', icon: getComponentIcon(NetworkComponentType.ASG), color: getComponentColor(NetworkComponentType.ASG) },
      { type: NetworkComponentType.FIREWALL, label: 'Azure Firewall', icon: getComponentIcon(NetworkComponentType.FIREWALL), color: getComponentColor(NetworkComponentType.FIREWALL) },
      { type: NetworkComponentType.BASTION, label: 'Bastion', icon: getComponentIcon(NetworkComponentType.BASTION), color: getComponentColor(NetworkComponentType.BASTION) },
      { type: NetworkComponentType.SERVICE_ENDPOINT, label: 'Service Endpoint', icon: getComponentIcon(NetworkComponentType.SERVICE_ENDPOINT), color: getComponentColor(NetworkComponentType.SERVICE_ENDPOINT) },
      { type: NetworkComponentType.PRIVATE_ENDPOINT, label: 'Private Endpoint', icon: getComponentIcon(NetworkComponentType.PRIVATE_ENDPOINT), color: getComponentColor(NetworkComponentType.PRIVATE_ENDPOINT) },
    ],
  },
  {
    label: 'Gateway',
    items: [
      { type: NetworkComponentType.VPN_GATEWAY, label: 'VPN Gateway', icon: getComponentIcon(NetworkComponentType.VPN_GATEWAY), color: getComponentColor(NetworkComponentType.VPN_GATEWAY) },
      { type: NetworkComponentType.APP_GATEWAY, label: 'App Gateway', icon: getComponentIcon(NetworkComponentType.APP_GATEWAY), color: getComponentColor(NetworkComponentType.APP_GATEWAY) },
      { type: NetworkComponentType.NVA, label: 'NVA', icon: getComponentIcon(NetworkComponentType.NVA), color: getComponentColor(NetworkComponentType.NVA) },
      { type: NetworkComponentType.LOAD_BALANCER, label: 'Load Balancer', icon: getComponentIcon(NetworkComponentType.LOAD_BALANCER), color: getComponentColor(NetworkComponentType.LOAD_BALANCER) },
    ],
  },
  {
    label: 'Compute',
    items: [
      { type: NetworkComponentType.VM, label: 'Virtual Machine', icon: getComponentIcon(NetworkComponentType.VM), color: getComponentColor(NetworkComponentType.VM) },
      { type: NetworkComponentType.VMSS, label: 'VM Scale Set', icon: getComponentIcon(NetworkComponentType.VMSS), color: getComponentColor(NetworkComponentType.VMSS) },
      { type: NetworkComponentType.AKS, label: 'AKS', icon: getComponentIcon(NetworkComponentType.AKS), color: getComponentColor(NetworkComponentType.AKS) },
      { type: NetworkComponentType.APP_SERVICE, label: 'App Service', icon: getComponentIcon(NetworkComponentType.APP_SERVICE), color: getComponentColor(NetworkComponentType.APP_SERVICE) },
      { type: NetworkComponentType.FUNCTIONS, label: 'Functions', icon: getComponentIcon(NetworkComponentType.FUNCTIONS), color: getComponentColor(NetworkComponentType.FUNCTIONS) },
    ],
  },
  {
    label: 'Storage',
    items: [
      { type: NetworkComponentType.STORAGE_ACCOUNT, label: 'Storage Account', icon: getComponentIcon(NetworkComponentType.STORAGE_ACCOUNT), color: getComponentColor(NetworkComponentType.STORAGE_ACCOUNT) },
      { type: NetworkComponentType.BLOB_STORAGE, label: 'Blob Storage', icon: getComponentIcon(NetworkComponentType.BLOB_STORAGE), color: getComponentColor(NetworkComponentType.BLOB_STORAGE) },
      { type: NetworkComponentType.MANAGED_DISK, label: 'Managed Disk', icon: getComponentIcon(NetworkComponentType.MANAGED_DISK), color: getComponentColor(NetworkComponentType.MANAGED_DISK) },
    ],
  },
  {
    label: 'Identity',
    items: [
      { type: NetworkComponentType.KEY_VAULT, label: 'Key Vault', icon: getComponentIcon(NetworkComponentType.KEY_VAULT), color: getComponentColor(NetworkComponentType.KEY_VAULT) },
      { type: NetworkComponentType.MANAGED_IDENTITY, label: 'Managed Identity', icon: getComponentIcon(NetworkComponentType.MANAGED_IDENTITY), color: getComponentColor(NetworkComponentType.MANAGED_IDENTITY) },
    ],
  },
]

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
  height: var(--header-height, 84px);
  min-height: var(--header-height, 84px);
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
