<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-nva" /></div>
    <div class="field"><label>VM Size</label><InputText v-model="model.vmSize" class="w-full" placeholder="Standard_D2s_v3" /></div>
    <div class="field"><label>Publisher</label><InputText v-model="model.publisher" class="w-full" placeholder="cisco" /></div>
    <div class="field"><label>Offer</label><InputText v-model="model.offer" class="w-full" placeholder="cisco-csr-1000v" /></div>
    <div class="field"><label>SKU</label><InputText v-model="model.sku" class="w-full" placeholder="17_3_3-byol" /></div>
    <div class="field"><label>Version</label><InputText v-model="model.version" class="w-full" placeholder="latest" /></div>
    <div class="field checkbox-field"><label>Enable IP Forwarding</label><ToggleSwitch v-model="model.enableIpForwarding" /></div>
    <div class="field"><label>Subnet</label>
      <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
      </div>
      <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { NvaComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'
const props = defineProps<{ modelValue: Partial<NvaComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as NvaComponent, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))

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
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.error-text { font-size: 0.72rem; color: var(--red-700); background-color: var(--red-50); padding: 0.2rem 0.35rem; border-radius: 4px; display: inline-block; }
</style>
