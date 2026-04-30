<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="mystorage" /></div>
    <div class="field"><label>Storage Type</label>
      <Select v-model="model.type" :options="storageTypes" option-label="label" option-value="value" class="w-full" />
    </div>
    <div v-if="isStorageAccount">
      <div class="field"><label>Account Kind</label><Select v-model="model.accountKind" :options="['StorageV2','BlobStorage','BlockBlobStorage','FileStorage','Storage']" class="w-full" /></div>
      <div class="field"><label>Replication</label><Select v-model="model.replication" :options="['LRS','GRS','RAGRS','ZRS','GZRS','RAGZRS']" class="w-full" /></div>
      <div class="field"><label>Access Tier</label><SelectButton v-model="model.accessTier" :options="['Hot','Cool','Archive']" /></div>
      <div class="field checkbox-field"><label>HTTPS Only</label><ToggleSwitch v-model="model.enableHttpsOnly" /></div>
      <div class="field checkbox-field"><label>Allow Blob Public Access</label><ToggleSwitch v-model="model.allowBlobPublicAccess" /></div>
    </div>
    <div v-if="isManagedDisk">
      <div class="field"><label>Disk Size (GB)</label><InputNumber v-model="model.diskSizeGb" :min="4" :max="32767" class="w-full" /></div>
      <div class="field"><label>SKU</label><Select v-model="model.sku" :options="['Standard_LRS','Premium_LRS','StandardSSD_LRS','UltraSSD_LRS']" class="w-full" /></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const storageTypes = [
  { label: 'Storage Account', value: NetworkComponentType.STORAGE_ACCOUNT },
  { label: 'Blob Storage', value: NetworkComponentType.BLOB_STORAGE },
  { label: 'Managed Disk', value: NetworkComponentType.MANAGED_DISK },
]
const isStorageAccount = computed(() => [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE].includes(model.value.type))
const isManagedDisk = computed(() => model.value.type === NetworkComponentType.MANAGED_DISK)
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
