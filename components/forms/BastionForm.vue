<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-bastion" /></div>
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Basic','Standard']" /></div>
    <div class="field">
      <label>Subnet</label>
      <small class="caption">Bastion must be deployed in a subnet named <strong>AzureBastionSubnet</strong>.</small>
      <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="AzureBastionSubnet" />
    </div>
    <div class="field">
      <label>Public IP Address</label>
      <Select v-model="model.publicIpId" :options="ipOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Public IP" />
    </div>
    <div class="field" v-if="model.sku === 'Standard'">
      <label>Scale Units</label>
      <InputNumber v-model="model.scaleUnits" :min="2" :max="50" class="w-full" />
    </div>
    <div class="field checkbox-field" v-if="model.sku === 'Standard'">
      <label>Enable Tunneling</label>
      <ToggleSwitch v-model="model.enableTunneling" />
    </div>
    <div class="field checkbox-field" v-if="model.sku === 'Standard'">
      <label>Enable IP Connect</label>
      <ToggleSwitch v-model="model.enableIpConnect" />
    </div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
  </div>
</template>

<script setup lang="ts">
import type { BastionComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'

const props = defineProps<{ modelValue: Partial<BastionComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as BastionComponent, set: v => emit('update:modelValue', v) })

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
.caption { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
