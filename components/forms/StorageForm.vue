<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="mystorage" /></div>
    <div class="field"><label>Storage Type</label>
      <Select v-model="model.type" :options="storageTypes" option-label="label" option-value="value" class="w-full" />
    </div>
    <template v-if="isStorageAccount">
      <div class="field"><label>Account Kind</label><Select v-model="model.accountKind" :options="['StorageV2','BlobStorage','BlockBlobStorage','FileStorage','Storage']" class="w-full" /></div>
      <div class="field"><label>Replication</label><Select v-model="model.replication" :options="['LRS','GRS','RAGRS','ZRS','GZRS','RAGZRS']" class="w-full" /></div>
      <div class="field"><label>Access Tier</label><SelectButton v-model="model.accessTier" :options="['Hot','Cool','Archive']" /></div>
      <div class="field"><label>Min TLS Version</label><Select v-model="model.minTlsVersion" :options="['TLS1_0','TLS1_1','TLS1_2']" class="w-full" /></div>
      <div class="field checkbox-field"><label>HTTPS Only</label><ToggleSwitch v-model="model.enableHttpsOnly" /></div>
      <div class="field checkbox-field"><label>Allow Blob Public Access</label><ToggleSwitch v-model="model.allowBlobPublicAccess" /></div>
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
    </template>
    <template v-if="isManagedDisk">
      <div class="field"><label>Disk Size (GB)</label><InputNumber v-model="model.diskSizeGb" :min="4" :max="32767" class="w-full" /></div>
      <div class="field"><label>SKU</label><Select v-model="model.sku" :options="['Standard_LRS','Premium_LRS','StandardSSD_LRS','UltraSSD_LRS']" class="w-full" /></div>
      <div class="field"><label>OS Type</label><SelectButton v-model="model.osType" :options="['Windows','Linux']" /></div>
      <div class="field"><label>Attached to VM</label>
        <Select v-model="model.attachedToVmId" :options="vmOptions" option-label="label" option-value="value" class="w-full" placeholder="Not attached" showClear />
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id, inputId: `sa-subnet-${n.id}` })))
const vmOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.VM).map(n => ({ label: n.data.name, value: n.id })))
const storageTypes = [
  { label: 'Storage Account', value: NetworkComponentType.STORAGE_ACCOUNT },
  { label: 'Blob Storage', value: NetworkComponentType.BLOB_STORAGE },
  { label: 'Managed Disk', value: NetworkComponentType.MANAGED_DISK },
]
const isStorageAccount = computed(() => [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE].includes(model.value.type))
const isManagedDisk = computed(() => model.value.type === NetworkComponentType.MANAGED_DISK)
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
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
</style>
