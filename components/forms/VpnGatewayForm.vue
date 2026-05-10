<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-vpn-gw" /></div>
    <div class="field"><label>SKU</label><Select v-model="model.sku" :options="['Basic','VpnGw1','VpnGw2','VpnGw3','VpnGw4','VpnGw5']" class="w-full" /></div>
    <div class="field"><label>VPN Type</label><SelectButton v-model="model.vpnType" :options="['RouteBased','PolicyBased']" /></div>
    <div class="field checkbox-field"><label>Enable BGP</label><ToggleSwitch v-model="model.enableBgp" /></div>
    <div class="field checkbox-field"><label>Active-Active Mode</label><ToggleSwitch v-model="model.activeActive" /></div>
    <div class="field">
      <label>Subnet</label>
      <small class="caption">Must be a subnet named <strong>GatewaySubnet</strong>.</small>
      <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="GatewaySubnet" />
      </div>
      <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
    </div>
    <div class="field"><label>Gateway Public IP</label>
      <Select v-model="model.gatewayIpId" :options="ipOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Public IP" showClear />
    </div>
  </div>
</template>
<script setup lang="ts">
import type { VpnGatewayComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'
const props = defineProps<{ modelValue: Partial<VpnGatewayComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as VpnGatewayComponent, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
const ipOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS).map(n => ({ label: n.data.name, value: n.id })))

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
.caption { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.error-text { font-size: 0.72rem; color: var(--red-700); background-color: var(--red-50); padding: 0.2rem 0.35rem; border-radius: 4px; display: inline-block; }
</style>
