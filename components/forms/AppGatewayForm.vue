<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-app-gw" /></div>
    <div class="field"><label>SKU</label><Select v-model="model.sku" :options="['Standard_v2','WAF_v2','Standard','WAF']" class="w-full" /></div>
    <div class="field"><label>Frontend Type</label><SelectButton v-model="model.frontendType" :options="['Public','Internal']" /></div>
    <div class="field"><label>Capacity</label><InputNumber v-model="model.capacity" :min="1" :max="32" class="w-full" /></div>
    <div class="field checkbox-field"><label>Enable HTTP/2</label><ToggleSwitch v-model="model.enableHttp2" /></div>
    <div class="field checkbox-field"><label>Enable WAF</label><ToggleSwitch v-model="model.enableWaf" /></div>
    <div class="field" v-if="model.enableWaf"><label>WAF Mode</label><SelectButton v-model="model.wafMode" :options="['Detection','Prevention']" /></div>
    <div class="field"><label>Subnet</label>
      <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
    </div>
    <div class="field" v-if="model.frontendType === 'Public'">
      <label>Frontend Public IP</label>
      <Select v-model="model.frontendIpId" :options="ipOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Public IP" showClear />
    </div>
    <div class="backend-section">
      <div class="backend-header">
        <span class="backend-title">Backend Pool Members</span>
        <small class="backend-caption">Select NICs or compute nodes for the backend pool</small>
      </div>
      <div v-if="backendOptions.length === 0" class="helper-text">No backend-eligible components in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in backendOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedBackendIds" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
        </div>
      </div>
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
const ipOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS).map(n => ({ label: n.data.name, value: n.id })))

const BACKEND_TYPES = [
  NetworkComponentType.NETWORK_IC,
  NetworkComponentType.VM,
  NetworkComponentType.VMSS,
  NetworkComponentType.AKS,
  NetworkComponentType.APP_SERVICE,
  NetworkComponentType.FUNCTIONS,
]
const backendOptions = computed(() =>
  (props.nodes || [])
    .filter(n => BACKEND_TYPES.includes(n.data?.type))
    .map(n => ({ label: n.data.name, value: n.id, inputId: `agw-backend-${n.id}` }))
)
const selectedBackendIds = computed({
  get: () => Array.isArray(model.value.backendPools) ? model.value.backendPools as string[] : [],
  set: (ids: string[]) => { model.value = { ...model.value, backendPools: ids } },
})
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.backend-section { display: flex; flex-direction: column; gap: 0.45rem; }
.backend-header { display: flex; flex-direction: column; gap: 0.15rem; }
.backend-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.backend-caption, .helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
</style>
