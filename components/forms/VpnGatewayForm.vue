<template>
  <div class="component-form">
    <!-- Name -->
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-vpn-gw" /></div>
    
    <!-- SKU with Generation grouping and deprecation notice -->
    <div class="field">
      <label>SKU</label>
      <Select v-model="model.sku" :options="skuOptions" option-label="label" option-value="value" class="w-full" />
      <small v-if="model.sku && isNonAzSku(model.sku)" class="warning-text">
        ⚠ Non-AZ SKU retiring Sep 30, 2026. Prefer VpnGw1AZ-5AZ for new deployments.
      </small>
      <small v-if="model.sku === 'Basic'" class="warning-text">
        ⚠ Basic SKU has no SLA. Use VpnGw1 or higher for production.
      </small>
    </div>

    <!-- VPN Type -->
    <div class="field"><label>VPN Type</label><SelectButton v-model="model.vpnType" :options="['RouteBased','PolicyBased']" /></div>
    
    <!-- Gateway Generation (informational, auto-inferred) -->
    <div class="field">
      <small class="caption">Generation: {{ inferredGeneration }} (auto-detected from SKU)</small>
    </div>

    <!-- Enable BGP -->
    <div class="field checkbox-field"><label>Enable BGP</label><ToggleSwitch v-model="model.enableBgp" /></div>

    <!-- Active-Active Mode -->
    <div class="field checkbox-field"><label>Active-Active Mode</label><ToggleSwitch v-model="model.activeActive" /></div>

    <!-- Availability Zones (conditional on AZ-capable SKU) -->
    <div v-if="isAzCapableSku(model.sku)" class="field">
      <label>Availability Zones</label>
      <small class="caption">Select zones for zone-redundant deployment (optional).</small>
      <MultiSelect v-model="model.availabilityZones" :options="[{ label: 'Zone 1', value: '1' }, { label: 'Zone 2', value: '2' }, { label: 'Zone 3', value: '3' }]" option-label="label" option-value="value" placeholder="Select zones" class="w-full" />
    </div>

    <!-- BGP Settings (collapsible advanced section) -->
    <fieldset v-if="model.enableBgp" class="bgp-settings">
      <legend>BGP Settings</legend>
      <div class="field">
        <label>BGP ASN</label>
        <InputNumber v-model="model.bgpSettings!.asn" :use-grouping="false" placeholder="65000" class="w-full" />
      </div>
      <div class="field">
        <label>BGP Peering Address</label>
        <InputText v-model="model.bgpSettings!.bgpPeeringAddress" class="w-full" placeholder="10.0.1.30" />
      </div>
      <div class="field">
        <label>BGP Peering Address (IPv6)</label>
        <InputText v-model="model.bgpSettings!.bgpPeeringAddressForIPv6" class="w-full" placeholder="(optional)" />
      </div>
    </fieldset>

    <!-- Subnet (GatewaySubnet) -->
    <div class="field">
      <label>Subnet *</label>
      <small class="caption">Must be a subnet named <strong>GatewaySubnet</strong> (/27 or larger recommended).</small>
      <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="GatewaySubnet" />
      </div>
      <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
    </div>

    <!-- Gateway Public IP -->
    <div class="field">
      <label>Gateway Public IP</label>
      <small class="caption">Standard SKU recommended (Basic SKU deprecating).</small>
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

const model = computed({
  get: () => {
    const m = props.modelValue as VpnGatewayComponent
    // Ensure bgpSettings object exists if needed
    if (m.enableBgp && !m.bgpSettings) {
      m.bgpSettings = {}
    }
    return m
  },
  set: v => emit('update:modelValue', v),
})

// SKU options organized by generation
const skuOptions = computed(() => [
  { label: '── Generation 1 ──', value: '', disabled: true },
  { label: 'Basic (no SLA)', value: 'Basic' },
  { label: 'VpnGw1 (650 Mbps)', value: 'VpnGw1' },
  { label: 'VpnGw2 (1 Gbps)', value: 'VpnGw2' },
  { label: 'VpnGw3 (1.25 Gbps)', value: 'VpnGw3' },
  { label: 'VpnGw1AZ (650 Mbps, zone-redundant)', value: 'VpnGw1AZ' },
  { label: 'VpnGw2AZ (1 Gbps, zone-redundant)', value: 'VpnGw2AZ' },
  { label: 'VpnGw3AZ (1.25 Gbps, zone-redundant)', value: 'VpnGw3AZ' },
  { label: '── Generation 2 ──', value: '', disabled: true },
  { label: 'VpnGw2 (1.25 Gbps)', value: 'VpnGw2' },
  { label: 'VpnGw3 (2.5 Gbps)', value: 'VpnGw3' },
  { label: 'VpnGw4 (5 Gbps)', value: 'VpnGw4' },
  { label: 'VpnGw5 (10 Gbps)', value: 'VpnGw5' },
  { label: 'VpnGw2AZ (1.25 Gbps, zone-redundant)', value: 'VpnGw2AZ' },
  { label: 'VpnGw3AZ (2.5 Gbps, zone-redundant)', value: 'VpnGw3AZ' },
  { label: 'VpnGw4AZ (5 Gbps, zone-redundant)', value: 'VpnGw4AZ' },
  { label: 'VpnGw5AZ (10 Gbps, zone-redundant)', value: 'VpnGw5AZ' },
])

const subnetOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.SUBNET)
    .map(n => ({ label: n.data.name, value: n.id }))
)

const ipOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS)
    .map(n => ({ label: n.data.name, value: n.id }))
)

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

// Infer gateway generation from SKU
const inferredGeneration = computed(() => {
  if (!model.value.sku) return 'Unknown'
  const gen2Skus = ['VpnGw2', 'VpnGw3', 'VpnGw4', 'VpnGw5', 'VpnGw2AZ', 'VpnGw3AZ', 'VpnGw4AZ', 'VpnGw5AZ']
  return gen2Skus.includes(model.value.sku) ? 'Generation 2' : 'Generation 1'
})

// Check if SKU is AZ-capable
function isAzCapableSku(sku?: string): boolean {
  if (!sku) return false
  return sku.endsWith('AZ')
}

// Check if SKU is non-AZ and deprecated
function isNonAzSku(sku?: string): boolean {
  if (!sku) return false
  const nonAzSkus = ['VpnGw1', 'VpnGw2', 'VpnGw3', 'VpnGw4', 'VpnGw5']
  return nonAzSkus.includes(sku)
}

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName)?.message
}
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.caption { font-size: 0.72rem; color: var(--text-muted); }
.warning-text { font-size: 0.72rem; color: var(--orange-500); font-weight: 500; display: block; margin-top: 0.2rem; }
.error-text { font-size: 0.72rem; color: var(--red-500); font-weight: 500; }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}

.bgp-settings {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.75rem;
  margin-top: 0.5rem;
  background: var(--surface-alt);
}

.bgp-settings legend {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  padding: 0 0.4rem;
}

.bgp-settings .field { margin-bottom: 0.5rem; }
</style>
