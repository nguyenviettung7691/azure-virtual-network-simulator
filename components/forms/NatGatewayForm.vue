<template>
  <div class="component-form">
    <div class="field">
      <label>Name *</label>
      <div :class="{ 'has-error': getError('name') }" class="input-wrapper">
        <InputText v-model="model.name" class="w-full" maxlength="80" placeholder="natgw-prod" />
      </div>
      <small v-if="getError('name')" class="error-text">{{ getError('name') }}</small>
    </div>

    <div class="field">
      <label>SKU</label>
      <Select v-model="model.sku" :options="skuOptions" option-label="label" option-value="value" class="w-full" disabled />
      <small class="hint-text">Only Standard SKU is supported.</small>
    </div>

    <div class="field">
      <label>Idle Timeout (minutes)</label>
      <div :class="{ 'has-error': getError('idleTimeoutInMinutes') }" class="input-wrapper">
        <InputNumber v-model="model.idleTimeoutInMinutes" class="w-full" :min="4" :max="120" />
      </div>
      <small v-if="getError('idleTimeoutInMinutes')" class="error-text">{{ getError('idleTimeoutInMinutes') }}</small>
    </div>

    <div class="field">
      <label>Availability Zones</label>
      <div :class="{ 'has-error': getError('availabilityZones') }" class="input-wrapper">
        <InputText v-model="availabilityZonesStr" class="w-full" placeholder="1,2,3" />
      </div>
      <small v-if="getError('availabilityZones')" class="error-text">{{ getError('availabilityZones') }}</small>
    </div>

    <div class="field">
      <label>Public IP Addresses</label>
      <div :class="{ 'has-error': getError('publicIpIds') }" class="input-wrapper">
        <MultiSelect v-model="model.publicIpIds" :options="publicIpOptions" option-label="label" option-value="value" class="w-full" />
      </div>
      <small v-if="getError('publicIpIds')" class="error-text">{{ getError('publicIpIds') }}</small>
      <small class="hint-text">Use Standard public IPs. Total capacity references (IPs + prefixes) must be 16 or fewer.</small>
    </div>

    <div class="field">
      <label>Public IP Prefix IDs (compatibility)</label>
      <div :class="{ 'has-error': getError('publicIpPrefixIds') }" class="input-wrapper">
        <InputText v-model="publicIpPrefixIdsStr" class="w-full" placeholder="prefix-a, prefix-b" />
      </div>
      <small v-if="getError('publicIpPrefixIds')" class="error-text">{{ getError('publicIpPrefixIds') }}</small>
    </div>

    <div class="field">
      <label>Subnets</label>
      <div :class="{ 'has-error': getError('subnetIds') }" class="input-wrapper">
        <MultiSelect v-model="model.subnetIds" :options="subnetOptions" option-label="label" option-value="value" class="w-full" />
      </div>
      <small v-if="getError('subnetIds')" class="error-text">{{ getError('subnetIds') }}</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
import { validateNatGateway } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])

const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const skuOptions = [{ label: 'Standard', value: 'Standard' }]

const publicIpOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS && n.data?.sku === 'Standard')
    .map(n => ({ label: n.data.name, value: n.id })),
)

const subnetOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.SUBNET)
    .map(n => ({ label: n.data.name, value: n.id })),
)

const availabilityZonesStr = computed({
  get: () => (Array.isArray(model.value.availabilityZones) ? model.value.availabilityZones.join(', ') : ''),
  set: (value: string) => {
    model.value = {
      ...model.value,
      availabilityZones: value.split(',').map(z => z.trim()).filter(Boolean),
    }
  },
})

const publicIpPrefixIdsStr = computed({
  get: () => (Array.isArray(model.value.publicIpPrefixIds) ? model.value.publicIpPrefixIds.join(', ') : ''),
  set: (value: string) => {
    model.value = {
      ...model.value,
      publicIpPrefixIds: value.split(',').map(id => id.trim()).filter(Boolean),
    }
  },
})

const validationErrors = computed(() => validateNatGateway(model.value, props.nodes || []).errors)

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
.input-wrapper.has-error :deep(.p-multiselect),
.input-wrapper.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.error-text {
  font-size: 0.75rem;
  color: var(--red-700);
  background-color: var(--red-50);
  padding: 0.2rem 0.35rem;
  border-radius: 4px;
  display: inline-block;
  max-width: 100%;
  word-break: break-word;
}
.hint-text {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  opacity: 0.8;
  font-style: italic;
}
</style>
