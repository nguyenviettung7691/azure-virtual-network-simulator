<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-public-ip" /></div>

    <!-- SKU Selector (Standard/Standard_v2 only; Basic retired Sep 30, 2025) -->
    <div class="field">
      <label>SKU *</label>
      <SelectButton v-model="model.sku" :options="['Standard', 'Standard_v2']" />
      <small class="caption">Basic SKU was retired September 30, 2025. Use Standard for all new deployments.</small>
      <small v-if="getError('sku')" class="error-text">{{ getError('sku') }}</small>
    </div>

    <!-- Tier Selector (Regional / Global) -->
    <div class="field">
      <label>Tier</label>
      <SelectButton v-model="model.tier" :options="tierOptions" option-label="label" option-value="value" />
      <small class="caption">Global tier supports cross-region load balancer configurations.</small>
      <small v-if="getWarning('tier')" class="warning-text">{{ getWarning('tier') }}</small>
    </div>

    <!-- Availability Zones (comma-separated) -->
    <div class="field">
      <label>Availability Zones (Optional)</label>
      <InputText v-model="availabilityZonesStr" class="w-full" placeholder="1,2,3" />
      <small class="caption">Comma-separated zone IDs for zone redundancy (Standard_v2 always zone-redundant).</small>
      <small v-if="getWarning('availabilityZones')" class="warning-text">{{ getWarning('availabilityZones') }}</small>
    </div>

    <!-- Routing Preference (Standard only) -->
    <div v-if="model.sku === 'Standard'" class="field">
      <label>Routing Preference (Optional)</label>
      <SelectButton v-model="model.routingPreference" :options="routingPreferenceOptions" option-label="label" option-value="value" />
      <small class="caption">Optimize routing path for cost/latency (Standard only; not supported on Standard_v2).</small>
      <small v-if="getError('routingPreference')" class="error-text">{{ getError('routingPreference') }}</small>
    </div>

    <!-- Allocation Method -->
    <div class="field">
      <label>Allocation Method</label>
      <SelectButton v-model="model.allocationMethod" :options="['Static', 'Dynamic']" />
      <small v-if="getWarning('allocationMethod')" class="warning-text">{{ getWarning('allocationMethod') }}</small>
    </div>

    <!-- IP Version -->
    <div class="field"><label>IP Version</label><SelectButton v-model="model.ipVersion" :options="['IPv4', 'IPv6']" /></div>

    <!-- IP Address -->
    <div class="field">
      <label>IP Address (Optional)</label>
      <div :class="{ 'has-error': getError('ipAddress') }" class="input-wrapper">
        <InputText v-model="model.ipAddress" class="w-full" placeholder="20.x.x.x (Azure assigns from pool)" />
      </div>
      <small class="caption">Azure assigns the public IP from available pool; this field is for documentation.</small>
      <small v-if="getError('ipAddress')" class="error-text">{{ getError('ipAddress') }}</small>
      <small v-else-if="getWarning('ipAddress')" class="warning-text">{{ getWarning('ipAddress') }}</small>
    </div>

    <!-- DNS Label -->
    <div class="field">
      <label>DNS Label (Optional)</label>
      <div :class="{ 'has-error': getError('dnsLabel') }" class="input-wrapper">
        <InputText v-model="model.dnsLabel" class="w-full" placeholder="my-app" />
      </div>
      <small class="caption">Maps to {label}.{region}.cloudapp.azure.com</small>
      <small v-if="getError('dnsLabel')" class="error-text">{{ getError('dnsLabel') }}</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IpAddressComponent } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<IpAddressComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as IpAddressComponent, set: v => emit('update:modelValue', v) })

// Tier dropdown options
const tierOptions = computed(() => [
  { label: 'Regional (default)', value: undefined },
  { label: 'Global', value: 'Global' },
])

// Routing preference options (only for Standard v1)
const routingPreferenceOptions = computed(() => [
  { label: 'Default', value: undefined },
  { label: 'Internet', value: 'Internet' },
  { label: 'Microsoft', value: 'Microsoft' },
])

// Availability Zones: comma-separated string ↔ string[] array
const availabilityZonesStr = computed({
  get: () => (model.value.availabilityZones || []).join(','),
  set: (v: string) => {
    const zones = v
      .split(',')
      .map(z => z.trim())
      .filter(z => z !== '')
    model.value = { ...model.value, availabilityZones: zones.length > 0 ? zones : undefined }
  },
})

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity === 'error')?.message
}

function getWarning(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity === 'warning')?.message
}
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.caption { font-size: 0.75rem; color: var(--text-color-secondary); font-style: italic; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.error-text { color: var(--red-500); font-size: 0.75rem; }
.warning-text { color: var(--orange-500); font-size: 0.75rem; }
</style>
