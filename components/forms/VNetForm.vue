<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-vnet" /></div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
    <div class="field">
      <label>Address Space (comma-separated) *</label>
      <div :class="{ 'has-error': getError('addressSpace') }" class="input-wrapper">
        <InputText v-model="addressSpaceStr" class="w-full" placeholder="10.0.0.0/16, 10.1.0.0/16" />
      </div>
      <small v-if="getError('addressSpace')" class="error-text">{{ getError('addressSpace') }}</small>
    </div>
    <div class="field"><label>DNS Servers (comma-separated)</label><InputText v-model="dnsServersStr" class="w-full" placeholder="168.63.129.16" /></div>
    <div class="field">
      <label>Region *</label>
      <div :class="{ 'has-error': getError('region') }" class="input-wrapper">
        <Select v-model="model.region" :options="regions" class="w-full" />
      </div>
      <small v-if="getError('region')" class="error-text">{{ getError('region') }}</small>
    </div>
    <div class="field">
      <label>Resource Group</label>
      <div :class="{ 'has-error': getError('resourceGroup') }" class="input-wrapper">
        <InputText v-model="model.resourceGroup" class="w-full" placeholder="my-rg" />
      </div>
      <small v-if="getError('resourceGroup')" class="error-text">{{ getError('resourceGroup') }}</small>
    </div>
    <div class="field checkbox-field">
      <label>DDoS Protection</label><ToggleSwitch v-model="model.enableDdosProtection" />
    </div>
    <div class="field checkbox-field">
      <label>VM Protection</label><ToggleSwitch v-model="model.enableVmProtection" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VNetComponent } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<VNetComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as VNetComponent, set: v => emit('update:modelValue', v) })

const addressSpaceStr = computed({
  get: () => model.value.addressSpace?.join(', ') || '',
  set: v => { model.value = { ...model.value, addressSpace: v.split(',').map(s => s.trim()).filter(Boolean) } }
})
const dnsServersStr = computed({
  get: () => model.value.dnsServers?.join(', ') || '',
  set: v => { model.value = { ...model.value, dnsServers: v.split(',').map(s => s.trim()).filter(Boolean) } }
})

const regions = ['eastus','eastus2','westus','westus2','westeurope','northeurope','southeastasia','australiaeast','centralus','canadacentral']

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName)?.message
}
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(textarea),
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
</style>
