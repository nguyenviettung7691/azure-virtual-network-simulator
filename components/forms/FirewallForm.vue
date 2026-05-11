<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-firewall" /></div>
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Standard','Premium']" /></div>
    <div class="field"><label>Threat Intel Mode</label>
      <SelectButton v-model="model.threatIntelMode" :options="['Alert','Deny','Off']" />
    </div>
    <div class="field"><label>VNet</label>
      <div :class="{ 'has-error': getError('vnetId') }" class="input-wrapper">
        <Select v-model="model.vnetId" :options="vnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select VNet" />
      </div>
      <small v-if="getError('vnetId')" class="error-text">{{ getError('vnetId') }}</small>
    </div>
    <div class="field">
      <label>Public IP Addresses</label>
      <small class="caption">Azure Firewall requires at least one Public IP.</small>
      <div v-if="getError('publicIpIds')" class="error-badge">{{ getError('publicIpIds') }}</div>
      <div v-if="ipOptions.length === 0" class="helper-text">No Public IP components in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in ipOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedPublicIpIds" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
        </div>
      </div>
    </div>
    <div class="field">
      <label>Firewall Policies (comma-separated)</label>
      <InputText v-model="policiesStr" class="w-full" placeholder="my-fw-policy" />
    </div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
  </div>
</template>

<script setup lang="ts">
import type { FirewallComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'

import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<FirewallComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as FirewallComponent, set: v => emit('update:modelValue', v) })

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName)?.message
}

const vnetOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.VNET)
    .map(n => ({ label: n.data.name, value: n.id }))
)

const ipOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS)
    .map(n => ({ label: n.data.name, value: n.id, inputId: `fw-ip-${n.id}` }))
)

const selectedPublicIpIds = computed({
  get: () => model.value.publicIpIds || [],
  set: (ids: string[]) => { model.value = { ...model.value, publicIpIds: ids } },
})

const policiesStr = computed({
  get: () => (model.value.firewallPolicies || []).join(', '),
  set: v => { model.value = { ...model.value, firewallPolicies: v.split(',').map(s => s.trim()).filter(Boolean) } },
})
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.caption { font-size: 0.72rem; color: var(--text-muted); }
.helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.error-badge { font-size: 0.72rem; color: var(--red-700); background-color: var(--red-50); padding: 0.3rem 0.45rem; border-radius: 4px; margin-bottom: 0.2rem; }
</style>
