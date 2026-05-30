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
      <div v-if="submitErrors.length > 0" class="validation-summary">
        <strong>Fix these validation errors before saving:</strong>
        <ul>
          <li v-for="(err, idx) in submitErrors" :key="idx">{{ err }}</li>
        </ul>
      </div>
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
import type { VNetComponent } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import { normalizeComponentKeyVaultReferences } from '~/lib/keyVault'
import { getManagedDiskDefaults, normalizeManagedDiskData } from '~/lib/managedDisk'
import type { FieldError } from '~/types/validation'

const diagramStore = useDiagramStore()
const settingsStore = useSettingsStore()

const formData = ref<Partial<AnyNetworkComponent>>({})
const submitErrors = ref<string[]>([])

const isEditing = computed(() => !!diagramStore.editingComponent)
const currentType = computed(() => diagramStore.editingComponent?.type || diagramStore.addingComponentType)

const modalTitle = computed(() => {
  const type = currentType.value
  const label = type ? getComponentLabel(type) : 'Component'
  return isEditing.value ? `Edit ${label}` : `Add ${label}`
})

watch(() => diagramStore.showComponentModal, (visible) => {
  if (visible) {
    submitErrors.value = []
    if (diagramStore.editingComponent) {
      formData.value = normalizeComponentKeyVaultReferences(
        normalizeManagedDiskData({ ...diagramStore.editingComponent } as any),
        diagramStore.nodes,
      )
    } else {
      const type = diagramStore.addingComponentType!
      formData.value = buildInitialComponentData(type)
    }
  }
})

function buildInitialComponentData(type: NetworkComponentType): Partial<AnyNetworkComponent> {
  const base: Partial<AnyNetworkComponent> = {
    type,
    name: '',
    description: '',
    tags: {},
    createdAt: new Date().toISOString(),
    id: `${type}-${Date.now()}`,
  }

  if (type === NetworkComponentType.VNET) {
    const vnetDefaults: Partial<VNetComponent> = {
      region: settingsStore.defaultRegion,
      resourceGroup: settingsStore.defaultResourceGroup,
    }
    return { ...base, ...vnetDefaults }
  }

  if (type === NetworkComponentType.LOAD_BALANCER) {
    return {
      ...base,
      sku: 'Standard',
      loadBalancerType: 'Public',
      tier: 'Regional',
      capacity: 2,
      frontendIpConfigs: [],
      backendPools: [],
      loadBalancingRules: [],
      healthProbes: [],
    }
  }

  if (type === NetworkComponentType.APP_GATEWAY) {
    return {
      ...base,
      sku: 'WAF_v2',
      tier: 'WAF_v2',
      capacity: 2,
      frontendType: 'Public',
      backendPools: [],
      enableWaf: true,
      wafMode: 'Prevention',
      keyVaultManagedIdentityId: undefined,
    }
  }

  if (type === NetworkComponentType.VNET_PEERING) {
    return {
      ...base,
      allowVirtualNetworkAccess: true,
      allowForwardedTraffic: true,
      allowGatewayTransit: false,
      useRemoteGateways: false,
      peeringState: 'Initiated',
    }
  }

  if (type === NetworkComponentType.VM) {
    return {
      ...base,
      os: 'Linux',
      size: 'Standard_D2s_v3',
      imagePublisher: 'Canonical',
      imageOffer: 'UbuntuServer',
      imageSku: '22_04-lts-gen2',
      adminUsername: 'azureadmin',
      nicIds: [],
      diskType: 'StandardSSD_LRS',
      enableManagedIdentity: false,
      userAssignedIdentityIds: [],
    }
  }

  if (type === NetworkComponentType.VMSS) {
    return {
      ...base,
      sku: 'Standard_D2s_v3',
      capacity: 2,
      os: 'Linux',
      orchestrationMode: 'Flexible',
      imagePublisher: 'Canonical',
      imageOffer: 'UbuntuServer',
      imageSku: '22_04-lts-gen2',
      upgradePolicy: 'Automatic',
      autoscaleEnabled: false,
      availabilityZones: ['1', '2'],
      scaleInPolicy: 'FIFO',
      enableManagedIdentity: false,
      userAssignedIdentityIds: [],
    }
  }

  if (type === NetworkComponentType.MANAGED_IDENTITY) {
    return {
      ...base,
      identityType: 'UserAssigned',
      isolationScope: 'None',
    }
  }

  if (type === NetworkComponentType.KEY_VAULT) {
    return {
      ...base,
      sku: 'Standard',
      enableSoftDelete: true,
      softDeleteRetentionDays: 90,
      enablePurgeProtection: false,
      networkDefaultAction: 'Allow',
      allowTrustedMicrosoftServices: false,
      virtualNetworkRules: [],
      ipRules: [],
      accessPolicies: [],
    }
  }

  if (type === NetworkComponentType.FUNCTIONS) {
    return {
      ...base,
      hostingOption: 'FlexConsumption',
      planSku: 'FC1',
      hostingPlanSku: 'FC1',
      os: 'Linux',
      runtimeStack: 'node',
      runtimeVersion: '20',
      enableHttps: true,
      enableDiagnosticLogging: true,
      enableManagedIdentity: false,
      userAssignedIdentityIds: [],
    }
  }

  if (type === NetworkComponentType.SERVICE_ENDPOINT) {
    return {
      ...base,
      service: 'Microsoft.Storage',
      subnetId: undefined,
      locations: [],
    }
  }
  if (type === NetworkComponentType.NAT_GATEWAY) {
    return {
      ...base,
      sku: 'Standard',
      idleTimeoutInMinutes: 4,
      publicIpIds: [],
      publicIpPrefixIds: [],
      subnetIds: [],
      availabilityZones: [],
    }
  }

  if (type === NetworkComponentType.STORAGE_ACCOUNT || type === NetworkComponentType.BLOB_STORAGE || type === NetworkComponentType.MANAGED_DISK) {
    if (type === NetworkComponentType.MANAGED_DISK) {
      return {
        ...base,
        ...getManagedDiskDefaults(),
      }
    }
    // STORAGE_ACCOUNT or BLOB_STORAGE
    return {
      ...base,
      accountKind: type === NetworkComponentType.BLOB_STORAGE ? 'BlobStorage' : 'StorageV2',
      replication: 'LRS',
      accessTier: 'Hot',
      enableHttpsOnly: true,
      allowBlobPublicAccess: false,
      allowSharedKeyAccess: true,
      allowPublicEndpoint: true,
      networkDefaultAction: 'Allow',
      virtualNetworkRules: [],
      ipRules: [],
      minTlsVersion: 'TLS1_2',
      enableSoftDelete: false,
      softDeleteRetentionDays: undefined,
    }
  }

  return base
}

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
  [NetworkComponentType.NAT_GATEWAY]: resolveComponent('NatGatewayForm'),
}

const activeForm = computed(() => currentType.value ? formMap[currentType.value] : null)

function onSubmit() {
  const data = normalizeComponentKeyVaultReferences(
    normalizeManagedDiskData(formData.value as any),
    diagramStore.nodes,
  ) as AnyNetworkComponent
  formData.value = data
  submitErrors.value = []
  if (data.type === NetworkComponentType.INTERNET) {
    diagramStore.closeComponentModal()
    return
  }
  if (!data.name?.trim()) {
    submitErrors.value = ['Name is required.']
    return
  }

  const validator = getValidator(data.type)
  if (validator) {
    const result = validator(data, diagramStore.nodes)
    if (!result.isValid) {
      const uniqueErrors = new Set<string>()
      result.errors
        .filter((err: FieldError) => err.severity !== 'warning')
        .forEach((err: FieldError) => uniqueErrors.add(err.message))
      submitErrors.value = Array.from(uniqueErrors)
      if (submitErrors.value.length > 0) return
    }
  }

  if (isEditing.value) {
    diagramStore.updateNode(data.id, data)
  } else {
    diagramStore.addNode(data)
    diagramStore.autoLayout()
  }
  submitErrors.value = []
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
.validation-summary {
  margin-top: 0.85rem;
  padding: 0.7rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--red-300);
  background: var(--red-50);
  color: var(--red-900);
  font-size: 0.84rem;
}
.validation-summary ul {
  margin: 0.45rem 0 0;
  padding-left: 1.1rem;
}
</style>
