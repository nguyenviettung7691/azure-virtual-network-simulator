<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-subnet" /></div>
    <div class="field"><label>Address Prefix *</label><InputText v-model="model.addressPrefix" class="w-full" placeholder="10.0.1.0/24" /></div>
    <div class="field"><label>Parent VNet</label>
      <Select v-model="model.vnetId" :options="vnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select VNet" />
    </div>
    <div class="field"><label>Network Security Group (NSG)</label>
      <Select v-model="model.nsgId" :options="nsgOptions" option-label="label" option-value="value" class="w-full" placeholder="None" showClear />
    </div>
    <div class="field"><label>Route Table (UDR)</label>
      <Select v-model="model.routeTableId" :options="udrOptions" option-label="label" option-value="value" class="w-full" placeholder="None" showClear />
    </div>
    <div class="field"><label>Service Endpoints (comma-separated)</label><InputText v-model="endpointsStr" class="w-full" placeholder="Microsoft.Storage, Microsoft.KeyVault" /></div>
    <div class="field"><label>Delegations (comma-separated)</label><InputText v-model="delegationsStr" class="w-full" placeholder="Microsoft.Web/serverFarms" /></div>
    <div class="field"><label>Private Endpoint Network Policies</label>
      <Select v-model="model.privateEndpointNetworkPolicies" :options="['Enabled','Disabled']" class="w-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SubnetComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: Partial<SubnetComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as SubnetComponent, set: v => emit('update:modelValue', v) })
const vnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.VNET).map(n => ({ label: n.data.name, value: n.id })))
const nsgOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.NSG).map(n => ({ label: n.data.name, value: n.id })))
const udrOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.UDR).map(n => ({ label: n.data.name, value: n.id })))
const endpointsStr = computed({
  get: () => model.value.serviceEndpoints?.join(', ') || '',
  set: v => { model.value = { ...model.value, serviceEndpoints: v.split(',').map(s => s.trim()).filter(Boolean) } }
})
const delegationsStr = computed({
  get: () => model.value.delegations?.join(', ') || '',
  set: v => { model.value = { ...model.value, delegations: v.split(',').map(s => s.trim()).filter(Boolean) } }
})
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
</style>
