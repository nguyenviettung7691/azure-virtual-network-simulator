<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-subnet" /></div>
    <div class="field">
      <label>Address Prefix *</label>
      <div :class="{ 'has-error': getError('addressPrefix') }" class="input-wrapper">
        <InputText v-model="model.addressPrefix" class="w-full" placeholder="10.0.1.0/24" />
      </div>
      <small v-if="getError('addressPrefix')" class="error-text">{{ getError('addressPrefix') }}</small>
    </div>
    <div class="field">
      <label>Parent VNet</label>
      <div :class="{ 'has-error': getError('vnetId') }" class="input-wrapper">
        <Select v-model="model.vnetId" :options="vnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select VNet" />
      </div>
      <small v-if="getError('vnetId')" class="error-text">{{ getError('vnetId') }}</small>
    </div>
    <div class="field"><label>Network Security Group (NSG)</label>
      <div :class="{ 'has-error': getError('nsgId') && getError('nsgId')?.includes('not exist') }" class="input-wrapper">
        <Select v-model="model.nsgId" :options="nsgOptions" option-label="label" option-value="value" class="w-full" placeholder="None" showClear />
      </div>
      <small v-if="getError('nsgId')" class="error-text">{{ getError('nsgId') }}</small>
    </div>
    <div class="field"><label>Route Table (UDR)</label>
      <div :class="{ 'has-error': getError('routeTableId') && getError('routeTableId')?.includes('not exist') }" class="input-wrapper">
        <Select v-model="model.routeTableId" :options="udrOptions" option-label="label" option-value="value" class="w-full" placeholder="None" showClear />
      </div>
      <small v-if="getError('routeTableId')" class="error-text">{{ getError('routeTableId') }}</small>
    </div>
    <div class="field"><label>Service Endpoints (comma-separated)</label><InputText v-model="endpointsStr" class="w-full" placeholder="Microsoft.Storage, Microsoft.KeyVault" /></div>
    <div class="field"><label>Delegations (comma-separated)</label><InputText v-model="delegationsStr" class="w-full" placeholder="Microsoft.Web/serverFarms" /></div>
    <div class="field"><label>Private Endpoint Network Policies</label>
      <Select v-model="model.privateEndpointNetworkPolicies" :options="['Enabled','Disabled']" class="w-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SubnetComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<SubnetComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as SubnetComponent, set: v => emit('update:modelValue', v) })
const vnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.VNET).map(n => ({ label: n.data.name, value: n.id })))
const nsgOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.NSG).map(n => ({ label: n.data.name, value: n.id })))
const udrOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.UDR).map(n => ({ label: n.data.name, value: n.id })))
const endpointsStr = computed({
  get: () => model.value.serviceEndpoints?.join(', ') || '',
  set: v => { model.value = { ...model.value, serviceEndpoints: v.split(',').map(s => s.trim()).filter(Boolean) } }
})
const delegationsStr = computed({
  get: () => model.value.delegations?.join(', ') || '',
  set: v => { model.value = { ...model.value, delegations: v.split(',').map(s => s.trim()).filter(Boolean) } }
})

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName)?.message
}
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.error-text { font-size: 0.72rem; color: var(--red-700); background-color: var(--red-50); padding: 0.2rem 0.35rem; border-radius: 4px; display: inline-block; }
</style>
