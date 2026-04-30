<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-nic" /></div>
    <div class="field"><label>Component Type</label>
      <Select v-model="model.type" :options="nicTypes" option-label="label" option-value="value" class="w-full" />
    </div>
    <div v-if="isNIC">
      <div class="field"><label>Private IP</label><InputText v-model="model.privateIpAddress" class="w-full" placeholder="10.0.1.4" /></div>
      <div class="field"><label>Allocation Method</label><SelectButton v-model="model.privateIpAllocationMethod" :options="['Dynamic','Static']" /></div>
      <div class="field checkbox-field"><label>Accelerated Networking</label><ToggleSwitch v-model="model.enableAcceleratedNetworking" /></div>
      <div class="field checkbox-field"><label>IP Forwarding</label><ToggleSwitch v-model="model.enableIpForwarding" /></div>
    </div>
    <div v-if="isServiceEndpoint">
      <div class="field"><label>Service</label>
        <Select v-model="model.service" :options="serviceOptions" class="w-full" />
      </div>
    </div>
    <div v-if="isPrivateEndpoint">
      <div class="field"><label>Connection Name</label><InputText v-model="model.connectionName" class="w-full" placeholder="my-pe-connection" /></div>
      <div class="field"><label>Private IP Address</label><InputText v-model="model.privateIpAddress" class="w-full" placeholder="10.0.1.5" /></div>
    </div>
    <div class="field"><label>Subnet</label>
      <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
const nicTypes = [
  { label: 'Network Interface', value: NetworkComponentType.NETWORK_IC },
  { label: 'Service Endpoint', value: NetworkComponentType.SERVICE_ENDPOINT },
  { label: 'Private Endpoint', value: NetworkComponentType.PRIVATE_ENDPOINT },
]
const serviceOptions = ['Microsoft.Storage','Microsoft.KeyVault','Microsoft.Sql','Microsoft.ServiceBus','Microsoft.EventHub','Microsoft.CosmosDB','Microsoft.ContainerRegistry','Microsoft.Web']
const isNIC = computed(() => model.value.type === NetworkComponentType.NETWORK_IC)
const isServiceEndpoint = computed(() => model.value.type === NetworkComponentType.SERVICE_ENDPOINT)
const isPrivateEndpoint = computed(() => model.value.type === NetworkComponentType.PRIVATE_ENDPOINT)
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
