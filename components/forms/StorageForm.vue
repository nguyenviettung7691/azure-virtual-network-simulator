<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="mystorage" /></div>
    <div class="field"><label>Storage Type</label>
      <Select v-model="model.type" :options="storageTypes" option-label="label" option-value="value" class="w-full" />
    </div>
    <template v-if="isStorageAccount">
      <div class="field">
        <label>Account Kind</label>
        <Select v-model="model.accountKind" :options="accountKindOptions" class="w-full" />
        <small class="helper-text">Recommended: StorageV2 for new deployments. Legacy kinds are kept for compatibility.</small>
        <small v-if="getWarning('accountKind')" class="warning-text">{{ getWarning('accountKind') }}</small>
      </div>
      <div class="field"><label>Replication</label>
        <Select v-model="model.replication" :options="replicationOptions" class="w-full" />
        <small v-if="getError('replication')" class="error-text">{{ getError('replication') }}</small>
      </div>
      <div class="field" v-if="showAccessTier"><label>Access Tier</label><SelectButton v-model="model.accessTier" :options="['Hot','Cool','Archive']" /></div>
      <div class="field">
        <label>Min TLS Version</label>
        <Select v-model="model.minTlsVersion" :options="['TLS1_2','TLS1_1','TLS1_0']" class="w-full" />
        <small class="helper-text">Azure defaults to TLS 1.2; TLS 1.0 and 1.1 are deprecated.</small>
        <small v-if="getWarning('minTlsVersion')" class="warning-text">{{ getWarning('minTlsVersion') }}</small>
        <small v-if="getError('minTlsVersion')" class="error-text">{{ getError('minTlsVersion') }}</small>
      </div>
      <div class="field checkbox-field"><label>HTTPS Only</label><ToggleSwitch v-model="model.enableHttpsOnly" />
        <small v-if="getWarning('enableHttpsOnly')" class="warning-text">{{ getWarning('enableHttpsOnly') }}</small>
      </div>
      <div class="field checkbox-field" v-if="showBlobPublicAccess"><label>Allow Blob Public Access</label><ToggleSwitch v-model="model.allowBlobPublicAccess" /></div>
      <div class="field"><label>Network Default Action</label><SelectButton v-model="model.networkDefaultAction" :options="['Allow','Deny']" /></div>
      <div class="field">
        <label>Virtual Network Rules (allowed subnets)</label>
        <div v-if="subnetOptions.length === 0" class="helper-text">No subnets in the diagram yet.</div>
        <div v-else class="checkbox-list">
          <div v-for="option in subnetOptions" :key="option.value" class="checkbox-row">
            <Checkbox v-model="selectedVnetRules" :input-id="option.inputId" :value="option.value" />
            <label :for="option.inputId">{{ option.label }}</label>
          </div>
        </div>
      </div>

      <!-- Security Section -->
      <div class="section-divider">Security Settings</div>
      <div class="field checkbox-field">
        <label>Shared Key Access Allowed</label>
        <ToggleSwitch v-model="model.allowSharedKeyAccess" />
        <small v-if="getWarning('allowSharedKeyAccess')" class="warning-text">{{ getWarning('allowSharedKeyAccess') }}</small>
      </div>
      <div class="field checkbox-field">
        <label>Public Endpoint Enabled</label>
        <ToggleSwitch v-model="model.allowPublicEndpoint" />
        <small class="helper-text">Disable for private-only access (requires private endpoints)</small>
        <small v-if="getWarning('allowPublicEndpoint')" class="warning-text">{{ getWarning('allowPublicEndpoint') }}</small>
      </div>

      <!-- Data Protection Section -->
      <div class="section-divider">Data Protection</div>
      <div class="field checkbox-field">
        <label>Soft Delete for Blobs</label>
        <ToggleSwitch v-model="model.enableSoftDelete" />
        <small class="helper-text">Recover deleted blobs within retention period</small>
      </div>
      <div class="field" v-if="model.enableSoftDelete">
        <label>Soft Delete Retention (days)</label>
        <div :class="{ 'has-error': getError('softDeleteRetentionDays') }" class="input-wrapper">
          <InputNumber v-model="model.softDeleteRetentionDays" :min="1" :max="365" class="w-full" />
        </div>
        <small class="helper-text">Azure recommends minimum 7 days</small>
        <small v-if="getError('softDeleteRetentionDays')" class="error-text">{{ getError('softDeleteRetentionDays') }}</small>
        <small v-if="getWarning('softDeleteRetentionDays')" class="warning-text">{{ getWarning('softDeleteRetentionDays') }}</small>
      </div>
      <small v-if="getWarning('enableHttpsOnly') && model.enableSoftDelete" class="warning-text">{{ getWarning('enableHttpsOnly') }}</small>
    </template>
    <template v-if="isManagedDisk">
      <!-- Disk Type Selector -->
      <div class="field">
        <label>Disk Type *</label>
        <Select v-model="model.diskType" :options="diskTypeOptions" option-label="label" option-value="value" class="w-full" />
        <small v-if="getError('diskType')" class="error-text">{{ getError('diskType') }}</small>
        <small v-if="getWarning('diskType')" class="warning-text">{{ getWarning('diskType') }}</small>
        <small class="helper-text">Ultra and Premium SSD v2 available in select regions; Standard HDD retiring Sept 8, 2028 for OS disks</small>
      </div>

      <!-- Disk Role Selector -->
      <div class="field">
        <label>Disk Role *</label>
        <SelectButton v-model="model.diskRole" :options="diskRoleOptions" option-label="label" option-value="value" />
        <small v-if="getError('diskRole')" class="error-text">{{ getError('diskRole') }}</small>
        <small class="helper-text">OS: System boot disk; Data: Application data disk</small>
      </div>

      <!-- Redundancy Selector (dynamic based on disk type) -->
      <div class="field">
        <label>Redundancy *</label>
        <Select v-model="model.redundancy" :options="redundancyOptions" class="w-full" />
        <small v-if="getError('redundancy')" class="error-text">{{ getError('redundancy') }}</small>
        <small class="helper-text">LRS: 11 9's durability; ZRS: 12 9's (multi-zone, Premium/Standard SSD only)</small>
      </div>

      <!-- Disk Size Validation (dynamic min/max per type) -->
      <div class="field">
        <label>Disk Size (GB) *</label>
        <div :class="{ 'has-error': getError('diskSizeGb') }" class="input-wrapper">
          <InputNumber v-model="model.diskSizeGb" :min="sizeLimit.min" :max="sizeLimit.max" class="w-full" />
        </div>
        <small v-if="getError('diskSizeGb')" class="error-text">{{ getError('diskSizeGb') }}</small>
        <small class="helper-text">Range: {{ sizeLimit.min }}-{{ sizeLimit.max }} GB for {{ model.diskType || 'selected type' }}</small>
      </div>

      <!-- Performance Configuration (Ultra/Premium SSD v2 only) -->
      <template v-if="isPerformanceConfigurable">
        <div class="field">
          <label>IOPS (optional)</label>
          <div :class="{ 'has-warning': getWarning('iops') }" class="input-wrapper">
            <InputNumber v-model="model.iops" class="w-full" />
          </div>
          <small v-if="getWarning('iops')" class="warning-text">{{ getWarning('iops') }}</small>
          <small class="helper-text">{{ iopsBandwidth }}</small>
        </div>

        <div class="field">
          <label>Throughput (MB/s, optional)</label>
          <div :class="{ 'has-warning': getWarning('throughput') }" class="input-wrapper">
            <InputNumber v-model="model.throughput" class="w-full" />
          </div>
          <small v-if="getWarning('throughput')" class="warning-text">{{ getWarning('throughput') }}</small>
          <small class="helper-text">{{ throughputBandwidth }}</small>
        </div>
      </template>

      <!-- OS Type (shown only for OS disks as optional consistency metadata) -->
      <div v-if="model.diskRole === ManagedDiskRole.OS" class="field">
        <label>OS Type (optional)</label>
        <SelectButton v-model="model.osType" :options="['Windows', 'Linux']" />
        <small v-if="getError('osType')" class="error-text">{{ getError('osType') }}</small>
        <small class="helper-text">Should match the attached VM OS when this disk is attached</small>
      </div>

      <!-- Attached VM Selector -->
      <div class="field">
        <label>Attached to VM</label>
        <Select v-model="model.attachedToVmId" :options="vmOptions" option-label="label" option-value="value" class="w-full" placeholder="Not attached" showClear />
        <small v-if="getWarning('attachedToVmId')" class="warning-text">{{ getWarning('attachedToVmId') }}</small>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { NetworkComponentType, ManagedDiskType, ManagedDiskRedundancy, ManagedDiskRole, MANAGED_DISK_SIZE_LIMITS } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import {
  getCoercedManagedDiskRedundancy,
  getPremiumSsdV2PerformanceLimits,
  getUltraDiskPerformanceLimits,
  getValidManagedDiskRedundancies,
  isManagedDiskPerformanceConfigurable,
  normalizeManagedDiskData,
} from '~/lib/managedDisk'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity !== 'warning')?.message
}
function getWarning(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity === 'warning')?.message
}
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id, inputId: `sa-subnet-${n.id}` })))
const vmOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.VM).map(n => ({ label: n.data.name, value: n.id })))

// Managed Disk computed properties
const diskTypeOptions = computed(() => Object.values(ManagedDiskType).map(type => ({
  label: type === ManagedDiskType.PREMIUM_SSD_V2 ? 'Premium SSD v2' : type.replace('_', ' '),
  value: type,
})))

const diskRoleOptions = computed(() => [
  { label: 'OS', value: ManagedDiskRole.OS },
  { label: 'Data', value: ManagedDiskRole.DATA },
])

const redundancyOptions = computed(() => {
  const validRedundancies = getValidManagedDiskRedundancies(model.value.diskType)
  if (validRedundancies.length === 0) {
    return []
  }
  return validRedundancies.map(r => ({
    label: r === ManagedDiskRedundancy.LRS ? 'Locally Redundant (LRS)' : 'Zone Redundant (ZRS)',
    value: r,
  }))
})

const sizeLimit = computed(() => {
  const diskType = model.value.diskType as ManagedDiskType | undefined
  if (!diskType || !MANAGED_DISK_SIZE_LIMITS[diskType]) {
    return { min: 4, max: 32767 }
  }
  return MANAGED_DISK_SIZE_LIMITS[diskType]
})

const isPerformanceConfigurable = computed(() => {
  return isManagedDiskPerformanceConfigurable(model.value.diskType)
})

const iopsBandwidth = computed(() => {
  if (model.value.diskType === ManagedDiskType.ULTRA && model.value.diskSizeGb) {
    const limits = getUltraDiskPerformanceLimits(Number(model.value.diskSizeGb))
    return `Ultra: ${limits.minIops}-${limits.maxIops} IOPS (1000 IOPS/GiB, max 400,000)`
  }
  if (model.value.diskType === ManagedDiskType.PREMIUM_SSD_V2 && model.value.diskSizeGb) {
    const limits = getPremiumSsdV2PerformanceLimits(Number(model.value.diskSizeGb), Number(model.value.iops || 3000))
    return `Premium v2: ${limits.minIops}-${limits.maxIops} IOPS (baseline 3000 + 500/GiB above 6 GB)`
  }
  return ''
})

const throughputBandwidth = computed(() => {
  if (model.value.diskType === ManagedDiskType.ULTRA) {
    const limits = getUltraDiskPerformanceLimits(Number(model.value.diskSizeGb || 0))
    const maxByIops = model.value.iops ? Math.min(limits.maxThroughput, Number(model.value.iops) * 0.25) : limits.maxThroughput
    return `Ultra: ${limits.minThroughput}-${maxByIops} MB/s`
  }
  if (model.value.diskType === ManagedDiskType.PREMIUM_SSD_V2) {
    const limits = getPremiumSsdV2PerformanceLimits(Number(model.value.diskSizeGb || 0), Number(model.value.iops || 3000))
    return `Premium v2: ${limits.minThroughput}-${limits.maxThroughput} MB/s`
  }
  return 'N/A'
})

watch(
  () => model.value.type,
  () => {
    if (model.value.type === NetworkComponentType.MANAGED_DISK) {
      model.value = normalizeManagedDiskData({ ...model.value })
    }
  },
  { immediate: true },
)

watch(
  () => model.value.diskType,
  (diskType) => {
    if (!isManagedDisk.value) return
    model.value.redundancy = getCoercedManagedDiskRedundancy(diskType, model.value.redundancy)
    if (!isManagedDiskPerformanceConfigurable(diskType)) {
      model.value.iops = undefined
      model.value.throughput = undefined
    }
  },
)

watch(
  () => model.value.diskRole,
  (diskRole) => {
    if (!isManagedDisk.value) return
    if (diskRole === ManagedDiskRole.DATA && model.value.osType) {
      model.value.osType = undefined
    }
  },
)
const storageTypes = [
  { label: 'Storage Account', value: NetworkComponentType.STORAGE_ACCOUNT },
  { label: 'Blob Storage', value: NetworkComponentType.BLOB_STORAGE },
  { label: 'Managed Disk', value: NetworkComponentType.MANAGED_DISK },
]
const isStorageAccount = computed(() => [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE].includes(model.value.type))
const isManagedDisk = computed(() => model.value.type === NetworkComponentType.MANAGED_DISK)
const accountKindOptions = ['StorageV2', 'BlobStorage', 'BlockBlobStorage', 'FileStorage', 'Storage']
const replicationOptions = computed(() => {
  const kind = model.value.accountKind
  if (kind === 'BlockBlobStorage') return ['LRS', 'ZRS']
  if (kind === 'FileStorage') return ['LRS', 'ZRS']
  if (kind === 'Storage' || kind === 'BlobStorage') return ['LRS', 'GRS', 'RAGRS']
  return ['LRS', 'GRS', 'RAGRS', 'ZRS', 'GZRS', 'RAGZRS']
})
const showAccessTier = computed(() => ['StorageV2', 'BlobStorage'].includes(String(model.value.accountKind)))
const showBlobPublicAccess = computed(() => ['StorageV2', 'BlobStorage'].includes(String(model.value.accountKind)))
const selectedVnetRules = computed({
  get: () => model.value.virtualNetworkRules || [],
  set: (ids: string[]) => { model.value = { ...model.value, virtualNetworkRules: ids } },
})
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.helper-text { font-size: 0.72rem; color: var(--text-muted); }
.warning-text { font-size: 0.72rem; color: var(--orange-500); }
.error-text { font-size: 0.72rem; color: var(--red-500); }
.section-divider { font-size: 0.82rem; font-weight: 700; color: var(--text-color-secondary); margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.input-wrapper.has-warning :deep(input),
.input-wrapper.has-warning :deep(.p-inputnumber-input) {
  border-color: var(--orange-500) !important;
}
</style>
