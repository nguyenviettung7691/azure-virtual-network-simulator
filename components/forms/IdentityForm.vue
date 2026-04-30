<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-key-vault" /></div>
    <div class="field"><label>Identity Type</label>
      <Select v-model="model.type" :options="identityTypes" option-label="label" option-value="value" class="w-full" />
    </div>
    <div v-if="isKeyVault">
      <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Standard','Premium']" /></div>
      <div class="field checkbox-field"><label>Soft Delete</label><ToggleSwitch v-model="model.enableSoftDelete" /></div>
      <div class="field checkbox-field"><label>Purge Protection</label><ToggleSwitch v-model="model.enablePurgeProtection" /></div>
      <div class="field"><label>Network Default Action</label><SelectButton v-model="model.networkDefaultAction" :options="['Allow','Deny']" /></div>
    </div>
    <div v-if="isManagedIdentity">
      <div class="field"><label>Identity Type</label><SelectButton v-model="model.identityType" :options="['SystemAssigned','UserAssigned']" /></div>
      <div class="field"><label>Client ID</label><InputText v-model="model.clientId" class="w-full" placeholder="00000000-..." /></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const identityTypes = [
  { label: 'Key Vault', value: NetworkComponentType.KEY_VAULT },
  { label: 'Managed Identity', value: NetworkComponentType.MANAGED_IDENTITY },
]
const isKeyVault = computed(() => model.value.type === NetworkComponentType.KEY_VAULT)
const isManagedIdentity = computed(() => model.value.type === NetworkComponentType.MANAGED_IDENTITY)
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
