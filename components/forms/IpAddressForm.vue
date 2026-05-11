<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-public-ip" /></div>
    <div class="field">
      <label>IP Address</label>
      <div :class="{ 'has-error': getError('ipAddress') }" class="input-wrapper">
        <InputText v-model="model.ipAddress" class="w-full" placeholder="20.x.x.x (leave blank for dynamic)" />
      </div>
      <small v-if="getError('ipAddress')" class="error-text">{{ getError('ipAddress') }}</small>
    </div>
    <div class="field"><label>Allocation Method</label><SelectButton v-model="model.allocationMethod" :options="['Static','Dynamic']" /></div>
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Basic','Standard']" /></div>
    <div class="field"><label>IP Version</label><SelectButton v-model="model.ipVersion" :options="['IPv4','IPv6']" /></div>
    <div class="field">
      <label>DNS Label</label>
      <div :class="{ 'has-error': getError('dnsLabel') }" class="input-wrapper">
        <InputText v-model="model.dnsLabel" class="w-full" placeholder="my-app" />
      </div>
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
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
</style>
