<template>
  <div class="component-form">
    <!-- Name field (all SKUs) -->
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-bastion" /></div>
    
    <!-- SKU selector (all SKUs) -->
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Developer','Basic','Standard','Premium']" /></div>
    
    <!-- Developer SKU note -->
    <div v-if="model.sku === 'Developer'" class="field info-box">
      <small><strong>Developer SKU:</strong> Shared infrastructure for dev/test only. No dedicated subnet or public IP required. Supports one VM connection at a time.</small>
    </div>

    <!-- Subnet field (Basic+ only) -->
    <div v-if="model.sku !== 'Developer'" class="field">
      <label>Subnet *</label>
      <small class="caption">Must be a dedicated subnet named <strong>AzureBastionSubnet</strong> with size <strong>/26 or larger</strong> (/25, /24, etc).</small>
      <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="AzureBastionSubnet" />
      </div>
      <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
    </div>

    <!-- Public IP field (Basic/Standard/Premium, or Premium non-private-only) -->
    <div v-if="model.sku !== 'Developer' && (!model.isPrivateOnly || model.sku !== 'Premium')" class="field">
      <label>Public IP Address *</label>
      <small class="caption">Must be Standard SKU with Static allocation method.</small>
      <div :class="{ 'has-error': getError('publicIpId') }" class="input-wrapper">
        <Select v-model="model.publicIpId" :options="ipOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Public IP" />
      </div>
      <small v-if="getError('publicIpId')" class="error-text">{{ getError('publicIpId') }}</small>
    </div>

    <!-- Scale Units field (Basic with note; Standard/Premium configurable) -->
    <div v-if="model.sku === 'Basic'" class="field">
      <label>Scale Units</label>
      <small class="caption">Basic SKU has fixed capacity of 2 instances (40 RDP / 80 SSH concurrent sessions)</small>
      <div class="input-wrapper">
        <InputNumber v-model="model.scaleUnits" :min="2" :max="2" class="w-full" disabled />
      </div>
    </div>
    <div v-if="model.sku === 'Standard' || model.sku === 'Premium'" class="field">
      <label>Scale Units</label>
      <small class="caption">Configurable instances (2-50). Each instance supports 20 RDP + 40 SSH concurrent sessions.</small>
      <div :class="{ 'has-error': getError('scaleUnits') }" class="input-wrapper">
        <InputNumber v-model="model.scaleUnits" :min="2" :max="50" class="w-full" />
      </div>
      <small v-if="getError('scaleUnits')" class="error-text">{{ getError('scaleUnits') }}</small>
    </div>

    <!-- Standard+ Advanced Features (tunneling, IP Connect) -->
    <div v-if="model.sku === 'Standard' || model.sku === 'Premium'" class="field checkbox-field">
      <label>Enable Tunneling</label>
      <small class="caption">Allows SSH/RDP via native client tunneling</small>
      <ToggleSwitch v-model="model.enableTunneling" />
    </div>
    <div v-if="model.sku === 'Standard' || model.sku === 'Premium'" class="field checkbox-field">
      <label>Enable IP Connect</label>
      <small class="caption">Connect to VMs using IP address instead of hostname</small>
      <ToggleSwitch v-model="model.enableIpConnect" />
    </div>

    <!-- Standard+ Shareable Links -->
    <div v-if="model.sku === 'Standard' || model.sku === 'Premium'" class="field checkbox-field">
      <label>Enable Shareable Links</label>
      <small class="caption">Allow users to connect without accessing Azure portal</small>
      <ToggleSwitch v-model="model.enableShareableLink" />
    </div>

    <!-- Standard+ Custom Inbound Ports -->
    <div v-if="model.sku === 'Standard' || model.sku === 'Premium'" class="field">
      <label>Custom Inbound Ports</label>
      <small class="caption">Comma-separated list of custom RDP/SSH ports (default: 3389, 22)</small>
      <div :class="{ 'has-error': getError('customInboundPorts') }" class="input-wrapper">
        <InputText v-model="customPortsStr" class="w-full" placeholder="e.g., 3389, 22, 2222" />
      </div>
      <small v-if="getError('customInboundPorts')" class="error-text">{{ getError('customInboundPorts') }}</small>
    </div>

    <!-- Premium-only: Private-only deployment -->
    <div v-if="model.sku === 'Premium'" class="field checkbox-field">
      <label>Private-Only Deployment</label>
      <small class="caption">No public IP required; requires ExpressRoute or VPN for connectivity</small>
      <ToggleSwitch v-model="model.isPrivateOnly" />
    </div>

    <!-- Premium-only: Session Recording -->
    <div v-if="model.sku === 'Premium'" class="field checkbox-field">
      <label>Enable Session Recording</label>
      <small class="caption">Record sessions for compliance (Premium feature)</small>
      <ToggleSwitch v-model="model.enableSessionRecording" />
    </div>

    <!-- Availability Zones (all dedicated SKUs) -->
    <div v-if="model.sku !== 'Developer'" class="field">
      <label>Availability Zones</label>
      <small class="caption">Optional. Support varies by region (currently in preview for select regions).</small>
      <div class="input-wrapper">
        <InputText v-model="availabilityZonesStr" class="w-full" placeholder="e.g., 1, 2, 3" />
      </div>
    </div>

    <!-- Description field (all SKUs) -->
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
  </div>
</template>

<script setup lang="ts">
import type { BastionComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'

import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<BastionComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as BastionComponent, set: v => emit('update:modelValue', v) })

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName)?.message
}

// Computed property for custom inbound ports (comma-separated string ↔ number[])
const customPortsStr = computed({
  get: () => model.value.customInboundPorts?.join(', ') || '',
  set: (v: string) => {
    const ports = v
      .split(',')
      .map(p => parseInt(p.trim(), 10))
      .filter(p => !isNaN(p) && p > 0 && p < 65536)
    model.value.customInboundPorts = ports.length > 0 ? ports : undefined
  }
})

// Computed property for availability zones (comma-separated string ↔ string[])
const availabilityZonesStr = computed({
  get: () => model.value.availabilityZones?.join(', ') || '',
  set: (v: string) => {
    const zones = v
      .split(',')
      .map(z => z.trim())
      .filter(z => z.length > 0)
    model.value.availabilityZones = zones.length > 0 ? zones : undefined
  }
})

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
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.caption { font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 0.15rem; }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-inputtext) { border-color: var(--red-500); }
.error-text { font-size: 0.7rem; color: var(--red-500); }
.info-box { padding: 0.6rem; background-color: rgba(33, 150, 243, 0.1); border-left: 3px solid #2196f3; border-radius: 3px; }
.info-box small { color: var(--text-color); }
</style>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.caption { font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 0.15rem; }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-inputtext) { border-color: var(--red-500); }
.error-text { font-size: 0.7rem; color: var(--red-500); }
.info-box { padding: 0.6rem; background-color: rgba(33, 150, 243, 0.1); border-left: 3px solid #2196f3; border-radius: 3px; }
.info-box small { color: var(--text-color); }
</style>
