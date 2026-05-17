<template>
  <div class="component-form">
    <div class="field">
      <label>Name *</label>
      <InputText v-model="model.name" class="w-full" placeholder="my-firewall" />
    </div>

    <div class="field">
      <label>SKU *</label>
      <SelectButton v-model="model.sku" :options="['Basic', 'Standard', 'Premium']" @change="onSkuChange" />
      <small class="caption">
        <template v-if="model.sku === 'Basic'">Basic: Up to 250 Mbps, Alert-only threat intelligence</template>
        <template v-else-if="model.sku === 'Standard'">Standard: Up to 30 Gbps, DNS proxy, network FQDN filtering, forced tunneling</template>
        <template v-else-if="model.sku === 'Premium'">Premium: Up to 100 Gbps, IDPS, TLS inspection, URL filtering, PCI DSS compliance</template>
      </small>
    </div>

    <div class="field">
      <label>VNet *</label>
      <div :class="{ 'has-error': getError('vnetId') }" class="input-wrapper">
        <Select v-model="model.vnetId" :options="vnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select VNet" />
      </div>
      <small v-if="getError('vnetId')" class="error-text">{{ getError('vnetId') }}</small>
    </div>

    <!-- Standard/Premium: Forced Tunneling Mode -->
    <div v-if="model.sku !== 'Basic'" class="field">
      <div class="checkbox-field">
        <Checkbox v-model="model.forcedTunneling" input-id="fw-forced-tunnel" />
        <label for="fw-forced-tunnel">Enable Forced Tunneling</label>
      </div>
      <small class="caption">Route all Internet-bound traffic to a designated next hop (Standard/Premium only)</small>
    </div>

    <!-- Subnet (optional, used with Forced Tunneling or shown optionally) -->
    <div class="field">
      <label>Subnet (Optional)</label>
      <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Subnet" allow-empty />
      </div>
      <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      <small v-else class="caption">Required if Forced Tunneling enabled; otherwise optional for AKS/gateway subnet attachment</small>
    </div>

    <!-- Public IP Addresses -->
    <div class="field">
      <div class="field-header">
        <label>Public IP Addresses</label>
        <span v-if="model.publicIpIds && model.publicIpIds.length > 0" class="badge" :class="{ 'warning': model.publicIpIds.length >= 220 }">
          {{ model.publicIpIds.length }}/250
        </span>
      </div>
      <small class="caption">
        <template v-if="model.forcedTunneling">Optional in Forced Tunnel mode (data plane only)</template>
        <template v-else>{{ model.sku || 'Firewall' }} requires at least one Public IP for NAT</template>
      </small>
      <div v-if="getError('publicIpIds')" class="error-badge">{{ getError('publicIpIds') }}</div>
      <div v-if="ipOptions.length === 0" class="helper-text">No Public IP components in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in ipOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedPublicIpIds" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
        </div>
      </div>
    </div>

    <!-- Availability Zones -->
    <div class="field">
      <label>Availability Zones (Optional)</label>
      <InputText v-model="availabilityZonesStr" class="w-full" placeholder="1,2,3" />
      <small class="caption">Comma-separated zone numbers or names (e.g., 1,2,3)</small>
    </div>

    <!-- Threat Intelligence -->
    <div class="field">
      <label>Threat Intelligence Mode</label>
      <SelectButton 
        v-model="model.threatIntelMode" 
        :options="threatIntelOptions" 
        :disabled="model.sku === 'Basic'"
      />
      <small v-if="model.sku === 'Basic'" class="caption">Basic SKU: Alert mode only</small>
      <small v-else-if="getError('threatIntelMode')" class="error-text">{{ getError('threatIntelMode') }}</small>
    </div>

    <!-- Standard/Premium: DNS Proxy -->
    <div v-if="model.sku !== 'Basic'" class="field">
      <div class="checkbox-field">
        <Checkbox v-model="model.dnsProxyEnabled" input-id="fw-dns-proxy" />
        <label for="fw-dns-proxy">Enable DNS Proxy</label>
      </div>
      <small class="caption">Forward DNS queries from VNets to configured DNS servers (Standard/Premium only)</small>
    </div>

    <!-- Standard/Premium: Custom DNS Servers -->
    <div v-if="model.sku !== 'Basic' && model.dnsProxyEnabled" class="field">
      <label>Custom DNS Servers</label>
      <InputText v-model="customDnsStr" class="w-full" placeholder="8.8.8.8, 1.1.1.1" />
      <small class="caption">Comma-separated IPv4 addresses; leave empty to use Azure DNS</small>
      <div v-if="getError('customDnsServers')" class="error-badge">{{ getError('customDnsServers') }}</div>
    </div>

    <!-- Premium-only: IDPS -->
    <div v-if="model.sku === 'Premium'" class="field">
      <label>IDPS Mode (Intrusion Detection & Prevention)</label>
      <SelectButton v-model="model.idpsMode" :options="['Off', 'Alert', 'AlertDeny']" />
      <small class="caption">Premium only: 67,000+ signatures, 20-40 new rules daily; AlertDeny blocks matching traffic</small>
    </div>

    <!-- Premium-only: TLS Inspection -->
    <div v-if="model.sku === 'Premium'" class="field">
      <div class="checkbox-field">
        <Checkbox v-model="model.tlsInspectionEnabled" input-id="fw-tls-inspection" />
        <label for="fw-tls-inspection">Enable TLS Inspection (Outbound & East-West)</label>
      </div>
      <small class="caption">Premium only: Decrypt/inspect/re-encrypt HTTPS traffic for threat detection</small>
    </div>

    <!-- Premium-only: Scale Units -->
    <div v-if="model.sku === 'Premium'" class="field">
      <label>Scale Units</label>
      <InputNumber v-model="model.scaleUnits" :min="1" :max="100" placeholder="1" />
      <small class="caption">Premium only: Range 1-100; scales performance and throughput</small>
      <div v-if="getError('scaleUnits')" class="error-badge">{{ getError('scaleUnits') }}</div>
    </div>

    <!-- Firewall Policies -->
    <div class="field">
      <label>Firewall Policies (comma-separated)</label>
      <InputText v-model="policiesStr" class="w-full" placeholder="my-fw-policy" />
      <small class="caption">Reference firewall policy names for organizational tracking</small>
    </div>

    <!-- Description -->
    <div class="field">
      <label>Description</label>
      <Textarea v-model="model.description" rows="2" class="w-full" />
    </div>
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

const subnetOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.SUBNET)
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

const threatIntelOptions = computed(() => {
  if (model.value.sku === 'Basic') return ['Alert']
  return ['Alert', 'Deny', 'Off']
})

const availabilityZonesStr = computed({
  get: () => (model.value.availabilityZones || []).join(', '),
  set: v => { model.value = { ...model.value, availabilityZones: v.split(',').map(s => s.trim()).filter(Boolean) } },
})

const customDnsStr = computed({
  get: () => (model.value.customDnsServers || []).join(', '),
  set: v => { model.value = { ...model.value, customDnsServers: v.split(',').map(s => s.trim()).filter(Boolean) } },
})

const policiesStr = computed({
  get: () => (model.value.firewallPolicies || []).join(', '),
  set: v => { model.value = { ...model.value, firewallPolicies: v.split(',').map(s => s.trim()).filter(Boolean) } },
})

function onSkuChange() {
  // Reset SKU-specific fields when changing SKU
  if (model.value.sku === 'Basic') {
    model.value.forcedTunneling = false
    model.value.dnsProxyEnabled = false
    model.value.customDnsServers = []
    model.value.idpsMode = undefined
    model.value.tlsInspectionEnabled = false
    model.value.scaleUnits = undefined
    if (model.value.threatIntelMode === 'Deny') {
      model.value.threatIntelMode = 'Alert'
    }
  }
}
</script>

<style scoped>
.component-form { 
  display: flex; 
  flex-direction: column; 
  gap: 0.75rem; 
}

.field { 
  display: flex; 
  flex-direction: column; 
  gap: 0.3rem; 
}

.field label { 
  font-size: 0.82rem; 
  font-weight: 600; 
  color: var(--text-color-secondary); 
}

.caption { 
  font-size: 0.72rem; 
  color: var(--text-muted); 
}

.helper-text { 
  font-size: 0.72rem; 
  color: var(--text-muted); 
}

.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  background: var(--green-50);
  color: var(--green-700);
}

.badge.warning {
  background: var(--orange-50);
  color: var(--orange-700);
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--text);
}

.checkbox-list { 
  display: flex; 
  flex-direction: column; 
  gap: 0.35rem; 
  padding: 0.55rem 0.65rem; 
  border: 1px solid var(--border); 
  border-radius: 8px; 
  background: var(--surface-alt); 
}

.checkbox-row { 
  display: flex; 
  align-items: center; 
  gap: 0.45rem; 
  font-size: 0.82rem; 
  color: var(--text); 
}

.input-wrapper { 
  position: relative; 
}

.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}

.error-badge { 
  font-size: 0.72rem; 
  color: var(--red-700); 
  background-color: var(--red-50); 
  padding: 0.3rem 0.45rem; 
  border-radius: 4px; 
  margin-bottom: 0.2rem; 
}

.error-text {
  font-size: 0.72rem;
  color: var(--red-700);
}
</style>

