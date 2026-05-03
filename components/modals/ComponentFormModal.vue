<template>
  <Dialog
    v-model:visible="diagramStore.showComponentModal"
    modal
    :header="modalTitle"
    :style="{ width: '720px', maxWidth: '92vw' }"
    @hide="diagramStore.closeComponentModal()"
  >
    <div v-if="activeForm" class="form-wrapper">
      <component :is="activeForm" v-model="formData" :nodes="diagramStore.nodes" />
    </div>
    <div v-else class="no-form">
      <p>Unknown component type: {{ currentType }}</p>
    </div>

    <template #footer>
      <Button v-if="isEditing" label="Delete" icon="pi pi-trash" severity="danger" text @click="onDelete" />
      <div style="flex:1" />
      <Button label="Cancel" text @click="diagramStore.closeComponentModal()" />
      <Button :label="isEditing ? 'Save Changes' : 'Add Component'" icon="pi pi-check" @click="onSubmit" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { NetworkComponentType, getComponentLabel } from '~/types/network'
import type { AnyNetworkComponent } from '~/types/network'

const diagramStore = useDiagramStore()

const formData = ref<Partial<AnyNetworkComponent>>({})

const isEditing = computed(() => !!diagramStore.editingComponent)
const currentType = computed(() => diagramStore.editingComponent?.type || diagramStore.addingComponentType)

const modalTitle = computed(() => {
  const type = currentType.value
  const label = type ? getComponentLabel(type) : 'Component'
  return isEditing.value ? `Edit ${label}` : `Add ${label}`
})

watch(() => diagramStore.showComponentModal, (visible) => {
  if (visible) {
    if (diagramStore.editingComponent) {
      formData.value = { ...diagramStore.editingComponent }
    } else {
      const type = diagramStore.addingComponentType!
      formData.value = { type, name: '', description: '', tags: {}, createdAt: new Date().toISOString(), id: `${type}-${Date.now()}` }
    }
  }
})

const formMap: Partial<Record<NetworkComponentType, any>> = {
  [NetworkComponentType.VNET]: resolveComponent('VNetForm'),
  [NetworkComponentType.SUBNET]: resolveComponent('SubnetForm'),
  [NetworkComponentType.NSG]: resolveComponent('NsgForm'),
  [NetworkComponentType.ASG]: resolveComponent('AsgForm'),
  [NetworkComponentType.IP_ADDRESS]: resolveComponent('IpAddressForm'),
  [NetworkComponentType.DNS_ZONE]: resolveComponent('DnsZoneForm'),
  [NetworkComponentType.VPN_GATEWAY]: resolveComponent('VpnGatewayForm'),
  [NetworkComponentType.APP_GATEWAY]: resolveComponent('AppGatewayForm'),
  [NetworkComponentType.NVA]: resolveComponent('NvaForm'),
  [NetworkComponentType.LOAD_BALANCER]: resolveComponent('LoadBalancerForm'),
  [NetworkComponentType.UDR]: resolveComponent('UdrForm'),
  [NetworkComponentType.VNET_PEERING]: resolveComponent('VnetPeeringForm'),
  [NetworkComponentType.NETWORK_IC]: resolveComponent('NetworkICForm'),
  [NetworkComponentType.VM]: resolveComponent('ComputeForm'),
  [NetworkComponentType.VMSS]: resolveComponent('ComputeForm'),
  [NetworkComponentType.AKS]: resolveComponent('ComputeForm'),
  [NetworkComponentType.APP_SERVICE]: resolveComponent('ComputeForm'),
  [NetworkComponentType.FUNCTIONS]: resolveComponent('ComputeForm'),
  [NetworkComponentType.STORAGE_ACCOUNT]: resolveComponent('StorageForm'),
  [NetworkComponentType.BLOB_STORAGE]: resolveComponent('StorageForm'),
  [NetworkComponentType.MANAGED_DISK]: resolveComponent('StorageForm'),
  [NetworkComponentType.KEY_VAULT]: resolveComponent('IdentityForm'),
  [NetworkComponentType.MANAGED_IDENTITY]: resolveComponent('IdentityForm'),
  [NetworkComponentType.SERVICE_ENDPOINT]: resolveComponent('NetworkICForm'),
  [NetworkComponentType.PRIVATE_ENDPOINT]: resolveComponent('NetworkICForm'),
  [NetworkComponentType.FIREWALL]: resolveComponent('FirewallForm'),
  [NetworkComponentType.BASTION]: resolveComponent('BastionForm'),
}

const activeForm = computed(() => currentType.value ? formMap[currentType.value] : null)

function onSubmit() {
  const data = formData.value as AnyNetworkComponent
  if (data.type === NetworkComponentType.INTERNET) {
    diagramStore.closeComponentModal()
    return
  }
  if (!data.name?.trim()) return
  if (isEditing.value) {
    diagramStore.updateNode(data.id, data)
  } else {
    diagramStore.addNode(data)
  }
  diagramStore.closeComponentModal()
}

function onDelete() {
  if (!diagramStore.editingComponent) return
  if (diagramStore.editingComponent.type === NetworkComponentType.INTERNET) {
    diagramStore.closeComponentModal()
    return
  }
  diagramStore.confirmAction(
    `Remove "${diagramStore.editingComponent.name}" from the diagram?`,
    () => {
      diagramStore.removeNode(diagramStore.editingComponent!.id)
      diagramStore.closeComponentModal()
    }
  )
}
</script>

<style scoped>
.form-wrapper {
  padding: 1rem 1.5rem 1.25rem;
}
.form-wrapper :deep(.component-form) {
  gap: 1.1rem;
}
.form-wrapper :deep(.field) {
  gap: 0.45rem;
}
.form-wrapper :deep(.field label) {
  font-size: 0.92rem;
}
.no-form { padding: 1.25rem 1.5rem; color: var(--text-color-secondary); }
</style>
