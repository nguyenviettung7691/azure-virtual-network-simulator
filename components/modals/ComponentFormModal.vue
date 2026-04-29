<template>
  <Dialog
    v-model:visible="diagramStore.showComponentModal"
    modal
    :header="modalTitle"
    :style="{ width: '560px' }"
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

const formMap: Record<NetworkComponentType, any> = {
  [NetworkComponentType.VNET]: resolveComponent('FormsVNetForm'),
  [NetworkComponentType.SUBNET]: resolveComponent('FormsSubnetForm'),
  [NetworkComponentType.NSG]: resolveComponent('FormsNsgForm'),
  [NetworkComponentType.ASG]: resolveComponent('FormsAsgForm'),
  [NetworkComponentType.IP_ADDRESS]: resolveComponent('FormsIpAddressForm'),
  [NetworkComponentType.DNS_ZONE]: resolveComponent('FormsDnsZoneForm'),
  [NetworkComponentType.VPN_GATEWAY]: resolveComponent('FormsVpnGatewayForm'),
  [NetworkComponentType.APP_GATEWAY]: resolveComponent('FormsAppGatewayForm'),
  [NetworkComponentType.NVA]: resolveComponent('FormsNvaForm'),
  [NetworkComponentType.LOAD_BALANCER]: resolveComponent('FormsLoadBalancerForm'),
  [NetworkComponentType.UDR]: resolveComponent('FormsUdrForm'),
  [NetworkComponentType.VNET_PEERING]: resolveComponent('FormsVnetPeeringForm'),
  [NetworkComponentType.NETWORK_IC]: resolveComponent('FormsNetworkICForm'),
  [NetworkComponentType.VM]: resolveComponent('FormsComputeForm'),
  [NetworkComponentType.VMSS]: resolveComponent('FormsComputeForm'),
  [NetworkComponentType.AKS]: resolveComponent('FormsComputeForm'),
  [NetworkComponentType.APP_SERVICE]: resolveComponent('FormsComputeForm'),
  [NetworkComponentType.FUNCTIONS]: resolveComponent('FormsComputeForm'),
  [NetworkComponentType.STORAGE_ACCOUNT]: resolveComponent('FormsStorageForm'),
  [NetworkComponentType.BLOB_STORAGE]: resolveComponent('FormsStorageForm'),
  [NetworkComponentType.MANAGED_DISK]: resolveComponent('FormsStorageForm'),
  [NetworkComponentType.KEY_VAULT]: resolveComponent('FormsIdentityForm'),
  [NetworkComponentType.MANAGED_IDENTITY]: resolveComponent('FormsIdentityForm'),
  [NetworkComponentType.SERVICE_ENDPOINT]: resolveComponent('FormsNetworkICForm'),
  [NetworkComponentType.PRIVATE_ENDPOINT]: resolveComponent('FormsNetworkICForm'),
  [NetworkComponentType.FIREWALL]: resolveComponent('FormsNsgForm'),
  [NetworkComponentType.BASTION]: resolveComponent('FormsVpnGatewayForm'),
}

const activeForm = computed(() => currentType.value ? formMap[currentType.value] : null)

function onSubmit() {
  const data = formData.value as AnyNetworkComponent
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
.form-wrapper { padding: 0.25rem 0; }
.no-form { padding: 1rem; color: var(--text-color-secondary); }
</style>
