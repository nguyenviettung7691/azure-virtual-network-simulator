<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-peering" /></div>
    <div class="field"><label>Local VNet</label>
      <Select v-model="model.localVnetId" :options="vnetOptions" option-label="label" option-value="value" class="w-full" />
    </div>
    <div class="field"><label>Remote VNet</label>
      <Select v-model="model.remoteVnetId" :options="vnetOptions" option-label="label" option-value="value" class="w-full" />
    </div>
    <div class="field checkbox-field"><label>Allow VNet Access</label><ToggleSwitch v-model="model.allowVirtualNetworkAccess" /></div>
    <div class="field checkbox-field"><label>Allow Forwarded Traffic</label><ToggleSwitch v-model="model.allowForwardedTraffic" /></div>
    <div class="field checkbox-field"><label>Allow Gateway Transit</label><ToggleSwitch v-model="model.allowGatewayTransit" /></div>
    <div class="field checkbox-field"><label>Use Remote Gateways</label><ToggleSwitch v-model="model.useRemoteGateways" /></div>
  </div>
</template>
<script setup lang="ts">
import type { VnetPeeringComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: Partial<VnetPeeringComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as VnetPeeringComponent, set: v => emit('update:modelValue', v) })
const vnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.VNET).map(n => ({ label: n.data.name, value: n.id })))
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
