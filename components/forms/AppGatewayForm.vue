<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-app-gw" /></div>
    <div class="field"><label>SKU</label><Select v-model="model.sku" :options="['Standard_v2','WAF_v2','Standard','WAF']" class="w-full" /></div>
    <div class="field"><label>Capacity</label><InputNumber v-model="model.capacity" :min="1" :max="32" class="w-full" /></div>
    <div class="field checkbox-field"><label>Enable HTTP/2</label><ToggleSwitch v-model="model.enableHttp2" /></div>
    <div class="field checkbox-field"><label>Enable WAF</label><ToggleSwitch v-model="model.enableWaf" /></div>
    <div class="field" v-if="model.enableWaf"><label>WAF Mode</label><SelectButton v-model="model.wafMode" :options="['Detection','Prevention']" /></div>
    <div class="field"><label>Subnet</label>
      <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
    </div>
  </div>
</template>
<script setup lang="ts">
import type { AppGatewayComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: Partial<AppGatewayComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as AppGatewayComponent, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
