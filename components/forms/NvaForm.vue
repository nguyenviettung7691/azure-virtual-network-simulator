<template>
  <div class="component-form">
    <!-- Name -->
    <div class="field">
      <label>Name *</label>
      <InputText v-model="model.name" class="w-full" placeholder="my-nva" />
    </div>

    <!-- Description -->
    <div class="field">
      <label>Description</label>
      <Textarea v-model="model.description" rows="2" class="w-full" />
    </div>

    <!-- NVA Role -->
    <div class="field">
      <label>NVA Role</label>
      <small class="caption">Classifies the NVA's primary function in the network</small>
      <Select v-model="model.nvaRole" :options="nvaRoleOptions" option-label="label" option-value="value" class="w-full" placeholder="Select role (optional)" show-clear />
    </div>

    <!-- VM Size -->
    <div class="field">
      <label>VM Size</label>
      <small class="caption">Azure VM size (e.g. Standard_D4s_v3, Standard_F8s_v2). Sizes with accelerated networking recommended.</small>
      <div :class="{ 'has-warning': getWarning('vmSize') }" class="input-wrapper">
        <InputText v-model="model.vmSize" class="w-full" placeholder="Standard_D2s_v3" />
      </div>
      <small v-if="getWarning('vmSize')" class="warning-text">{{ getWarning('vmSize') }}</small>
    </div>

    <!-- Marketplace Image -->
    <div class="field">
      <label>Publisher</label>
      <small class="caption">Azure Marketplace publisher (e.g. cisco, checkpoint, fortinet, barracudanetworks)</small>
      <div :class="{ 'has-warning': getWarning('publisher') }" class="input-wrapper">
        <InputText v-model="model.publisher" class="w-full" placeholder="cisco" />
      </div>
      <small v-if="getWarning('publisher')" class="warning-text">{{ getWarning('publisher') }}</small>
    </div>
    <div class="field">
      <label>Offer</label>
      <small class="caption">Azure Marketplace offer name (e.g. cisco-csr-1000v, checkpoint-cloudguard-ips)</small>
      <InputText v-model="model.offer" class="w-full" placeholder="cisco-csr-1000v" />
    </div>
    <div class="field">
      <label>Image SKU</label>
      <small class="caption">Azure Marketplace image plan/SKU (e.g. 17_3_3-byol, byol)</small>
      <InputText v-model="model.sku" class="w-full" placeholder="17_3_3-byol" />
    </div>
    <div class="field">
      <label>Version</label>
      <InputText v-model="model.version" class="w-full" placeholder="latest" />
    </div>

    <!-- HA Mode -->
    <div class="field">
      <label>High Availability Mode</label>
      <small class="caption">Deployment topology for NVA resiliency (informational)</small>
      <Select v-model="model.haMode" :options="haModeOptions" option-label="label" option-value="value" class="w-full" placeholder="Select HA mode (optional)" show-clear />
    </div>

    <!-- Availability Zones -->
    <div class="field">
      <label>Availability Zones</label>
      <small class="caption">Deploy across availability zones for zone redundancy. Comma-separated (e.g. 1, 2, 3).</small>
      <div :class="{ 'has-warning': getWarning('availabilityZones') }" class="input-wrapper">
        <InputText v-model="availabilityZonesStr" class="w-full" placeholder="e.g., 1, 2, 3" />
      </div>
      <small v-if="getWarning('availabilityZones')" class="warning-text">{{ getWarning('availabilityZones') }}</small>
    </div>

    <!-- Public IP -->
    <div class="field">
      <label>Public IP Address</label>
      <small class="caption">Optional public IP for internet-facing NVA deployments (e.g. external firewall)</small>
      <div :class="{ 'has-error': getError('publicIpId') }" class="input-wrapper">
        <Select v-model="model.publicIpId" :options="publicIpOptions" option-label="label" option-value="value" class="w-full" placeholder="Select public IP (optional)" show-clear />
      </div>
      <small v-if="getError('publicIpId')" class="error-text">{{ getError('publicIpId') }}</small>
    </div>

    <!-- IP Forwarding -->
    <div class="field">
      <div class="checkbox-row">
        <label>Enable IP Forwarding</label>
        <ToggleSwitch v-model="model.enableIpForwarding" />
      </div>
      <small :class="['caption', { 'caption-warning': !!getWarning('enableIpForwarding') }]">
        {{ getWarning('enableIpForwarding') || 'Required — NVA must forward traffic not destined for its own IP. Disabling this causes Azure to drop routed packets.' }}
      </small>
    </div>

    <!-- Subnet -->
    <div class="field">
      <label>Subnet *</label>
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

const subnetOptions = computed(() =>
  (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))

const publicIpOptions = computed(() =>
  (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS).map(n => ({ label: n.data.name, value: n.id })))

const nvaRoleOptions = [
  { label: 'Firewall / NGFW', value: 'Firewall' },
  { label: 'SD-WAN', value: 'SDWAN' },
  { label: 'VPN Endpoint', value: 'VPN' },
  { label: 'Proxy / Web Filter', value: 'Proxy' },
  { label: 'Other', value: 'Other' },
]

const haModeOptions = [
  { label: 'Single Instance', value: 'Single' },
  { label: 'Active-Active', value: 'ActiveActive' },
  { label: 'Active-Standby', value: 'ActiveStandby' },
]

// Availability zones: comma-separated string ↔ string[]
const availabilityZonesStr = computed({
  get: () => (model.value.availabilityZones || []).join(', '),
  set: (val: string) => {
    const zones = val.split(',').map((z: string) => z.trim()).filter((z: string) => z !== '')
    model.value = { ...model.value, availabilityZones: zones.length > 0 ? zones : undefined }
  },
})

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
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
.checkbox-row { display: flex; flex-direction: row; align-items: center; justify-content: space-between; }
.caption { font-size: 0.75rem; color: var(--text-color-secondary); }
.caption-warning { color: var(--orange-600); }
.input-wrapper { position: relative; }
.error-text { color: var(--red-500); font-size: 0.75rem; }
.warning-text { color: var(--orange-600); font-size: 0.75rem; }
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger),
.input-wrapper.has-error :deep(.p-inputtext) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.input-wrapper.has-warning :deep(.p-inputtext) {
  border-color: var(--orange-500) !important;
}
</style>
