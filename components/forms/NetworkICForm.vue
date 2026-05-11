<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-nic" /></div>
    <div class="field"><label>Component Type</label>
      <Select v-model="model.type" :options="nicTypes" option-label="label" option-value="value" class="w-full" />
    </div>

    <!-- NIC-specific fields -->
    <template v-if="isNIC">
      <div class="field"><label>Private IP</label><InputText v-model="model.privateIpAddress" class="w-full" placeholder="10.0.1.4" /></div>
      <div class="field"><label>Allocation Method</label><SelectButton v-model="model.privateIpAllocationMethod" :options="['Dynamic','Static']" /></div>
      <div class="field"><label>Subnet</label>
        <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
          <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" showClear />
        </div>
        <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      </div>
      <div class="field"><label>Public IP Address</label>
        <Select v-model="model.publicIpId" :options="ipOptions" option-label="label" option-value="value" class="w-full" placeholder="None" showClear />
      </div>
      <div class="field"><label>Network Security Group (NSG)</label>
        <Select v-model="model.nsgId" :options="nsgOptions" option-label="label" option-value="value" class="w-full" placeholder="None" showClear />
      </div>
      <div class="field">
        <label>Application Security Groups (ASGs)</label>
        <div v-if="asgOptions.length === 0" class="helper-text">No ASG components in the diagram yet.</div>
        <div v-else class="checkbox-list">
          <div v-for="option in asgOptions" :key="option.value" class="checkbox-row">
            <Checkbox v-model="selectedAsgIds" :input-id="option.inputId" :value="option.value" />
            <label :for="option.inputId">{{ option.label }}</label>
          </div>
        </div>
      </div>
      <div class="field checkbox-field"><label>Accelerated Networking</label><ToggleSwitch v-model="model.enableAcceleratedNetworking" /></div>
      <div class="field checkbox-field"><label>IP Forwarding</label><ToggleSwitch v-model="model.enableIpForwarding" /></div>
    </template>

    <!-- Service Endpoint-specific fields -->
    <template v-if="isServiceEndpoint">
      <div class="field"><label>Service</label>
        <div :class="{ 'has-error': getError('service') }" class="input-wrapper">
          <Select v-model="model.service" :options="serviceOptions" class="w-full" />
        </div>
        <small v-if="getError('service')" class="error-text">{{ getError('service') }}</small>
      </div>
      <div class="field"><label>Subnet</label>
        <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
          <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
        </div>
        <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      </div>
    </template>

    <!-- Private Endpoint-specific fields -->
    <template v-if="isPrivateEndpoint">
      <div class="field"><label>Connection Name</label><InputText v-model="model.connectionName" class="w-full" placeholder="my-pe-connection" /></div>
      <div class="field"><label>Private IP Address</label><InputText v-model="model.privateIpAddress" class="w-full" placeholder="10.0.1.5" /></div>
      <div class="field"><label>Subnet</label>
        <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
          <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
        </div>
        <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      </div>
      <div class="field"><label>Target Resource (Private Link Service)</label>
        <Select v-model="model.privateLinkServiceId" :options="privateLinkOptions" option-label="label" option-value="value" class="w-full" placeholder="Select target resource" showClear />
      </div>
      <div class="field"><label>Sub-resource Group IDs (comma-separated)</label>
        <InputText v-model="groupIdsStr" class="w-full" placeholder="blob, vault, sqlServer" />
      </div>
      <div class="field"><label>Private DNS Zone Group</label>
        <div :class="{ 'has-error': getError('dnsZoneGroupId') }" class="input-wrapper">
          <Select v-model="model.dnsZoneGroupId" :options="dnsZoneOptions" option-label="label" option-value="value" class="w-full" placeholder="None" showClear />
        </div>
        <small v-if="getError('dnsZoneGroupId')" class="error-text">{{ getError('dnsZoneGroupId') }}</small>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'

import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName)?.message
}

const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
const nsgOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.NSG).map(n => ({ label: n.data.name, value: n.id })))
const ipOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS).map(n => ({ label: n.data.name, value: n.id })))
const asgOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.ASG).map(n => ({ label: n.data.name, value: n.id, inputId: `nic-asg-${n.id}` })))
const dnsZoneOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.DNS_ZONE && n.data?.zoneType === 'Private').map(n => ({ label: n.data.name, value: n.id })))

const PRIVATE_LINK_TYPES = [
  NetworkComponentType.STORAGE_ACCOUNT,
  NetworkComponentType.BLOB_STORAGE,
  NetworkComponentType.KEY_VAULT,
  NetworkComponentType.APP_SERVICE,
  NetworkComponentType.FUNCTIONS,
  NetworkComponentType.AKS,
]
const privateLinkOptions = computed(() =>
  (props.nodes || [])
    .filter(n => PRIVATE_LINK_TYPES.includes(n.data?.type))
    .map(n => ({ label: `${n.data.name} (${n.data.type})`, value: n.id }))
)

const nicTypes = [
  { label: 'Network Interface', value: NetworkComponentType.NETWORK_IC },
  { label: 'Service Endpoint', value: NetworkComponentType.SERVICE_ENDPOINT },
  { label: 'Private Endpoint', value: NetworkComponentType.PRIVATE_ENDPOINT },
]
const serviceOptions = ['Microsoft.Storage','Microsoft.KeyVault','Microsoft.Sql','Microsoft.ServiceBus','Microsoft.EventHub','Microsoft.CosmosDB','Microsoft.ContainerRegistry','Microsoft.Web']

const isNIC = computed(() => model.value.type === NetworkComponentType.NETWORK_IC)
const isServiceEndpoint = computed(() => model.value.type === NetworkComponentType.SERVICE_ENDPOINT)
const isPrivateEndpoint = computed(() => model.value.type === NetworkComponentType.PRIVATE_ENDPOINT)

const selectedAsgIds = computed({
  get: () => model.value.asgIds || [],
  set: (ids: string[]) => { model.value = { ...model.value, asgIds: ids } },
})

const groupIdsStr = computed({
  get: () => (model.value.groupIds || []).join(', '),
  set: (v: string) => { model.value = { ...model.value, groupIds: v.split(',').map((s: string) => s.trim()).filter(Boolean) } },
})
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.error-text {
  font-size: 0.75rem;
  color: var(--red-800);
  background: linear-gradient(135deg, var(--red-50), var(--surface-0));
  border: 1px solid var(--red-200);
  border-left: 3px solid var(--red-500);
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: flex-start;
  gap: 0.35rem;
  line-height: 1.35;
  max-width: 100%;
  word-break: break-word;
  box-shadow: 0 1px 2px rgb(239 68 68 / 0.12);
}
.error-text::before {
  content: '⚠';
  font-size: 0.7rem;
  line-height: 1.4;
  margin-top: 0.05rem;
  flex-shrink: 0;
}
</style>
