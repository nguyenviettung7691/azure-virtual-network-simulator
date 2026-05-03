<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-lb" /></div>
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Basic','Standard','Gateway']" /></div>
    <div class="field"><label>Type</label><SelectButton v-model="model.loadBalancerType" :options="['Public','Internal']" /></div>
    <div class="field"><label>Tier</label><SelectButton v-model="model.tier" :options="['Regional','Global']" /></div>

    <!-- Frontend IP Configuration -->
    <div class="section">
      <div class="section-title">Frontend IP Configuration</div>
      <template v-if="model.loadBalancerType === 'Public'">
        <div class="field"><label>Frontend Public IP</label>
          <Select v-model="frontendPublicIpId" :options="ipOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Public IP" showClear />
        </div>
      </template>
      <template v-else>
        <div class="field"><label>Frontend Subnet</label>
          <Select v-model="frontendSubnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Subnet" showClear />
        </div>
        <div class="field"><label>Frontend Private IP</label>
          <InputText v-model="frontendPrivateIp" class="w-full" placeholder="10.0.1.10 (empty = Dynamic)" />
        </div>
      </template>
    </div>

    <!-- Backend Pool -->
    <div class="section">
      <div class="section-title">Backend Pool Members</div>
      <small class="caption">Select NICs to include in the default backend pool</small>
      <div v-if="nicOptions.length === 0" class="helper-text">No NIC components are available in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in nicOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedBackendNicIds" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
        </div>
      </div>
    </div>

    <!-- Health Probes -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">Health Probes</span>
        <Button icon="pi pi-plus" size="small" text rounded @click="addProbe" aria-label="Add probe" />
      </div>
      <div v-if="probes.length === 0" class="helper-text">No health probes configured.</div>
      <div v-for="(probe, i) in probes" :key="i" class="rule-card">
        <div class="rule-row">
          <InputText v-model="probe.name" class="flex-1" placeholder="probe-name" />
          <Select v-model="probe.protocol" :options="['Http','Https','Tcp']" class="w-5rem" />
          <InputNumber v-model="probe.port" :min="1" :max="65535" class="w-5rem" placeholder="Port" />
          <Button icon="pi pi-trash" size="small" text rounded severity="danger" @click="removeProbe(i)" />
        </div>
        <div class="rule-row">
          <label class="caption">Interval (s)</label>
          <InputNumber v-model="probe.intervalInSeconds" :min="5" :max="2147483647" class="w-5rem" />
          <label class="caption">Unhealthy threshold</label>
          <InputNumber v-model="probe.numberOfProbes" :min="1" :max="2147483647" class="w-5rem" />
          <InputText v-if="probe.protocol !== 'Tcp'" v-model="probe.requestPath" class="flex-1" placeholder="/health" />
        </div>
      </div>
    </div>

    <!-- Load Balancing Rules -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">Load Balancing Rules</span>
        <Button icon="pi pi-plus" size="small" text rounded @click="addRule" aria-label="Add rule" />
      </div>
      <div v-if="rules.length === 0" class="helper-text">No rules configured.</div>
      <div v-for="(rule, i) in rules" :key="i" class="rule-card">
        <div class="rule-row">
          <InputText v-model="rule.name" class="flex-1" placeholder="rule-name" />
          <Select v-model="rule.protocol" :options="['Tcp','Udp','All']" class="w-5rem" />
          <Button icon="pi pi-trash" size="small" text rounded severity="danger" @click="removeRule(i)" />
        </div>
        <div class="rule-row">
          <label class="caption">Frontend Port</label>
          <InputNumber v-model="rule.frontendPort" :min="1" :max="65535" class="w-5rem" />
          <label class="caption">Backend Port</label>
          <InputNumber v-model="rule.backendPort" :min="1" :max="65535" class="w-5rem" />
        </div>
      </div>
    </div>

    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
  </div>
</template>
<script setup lang="ts">
import type { LoadBalancerComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'

const props = defineProps<{ modelValue: Partial<LoadBalancerComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as LoadBalancerComponent, set: v => emit('update:modelValue', v) })

const nicOptions = computed(() =>
  (props.nodes || [])
    .filter(node => node.data?.type === NetworkComponentType.NETWORK_IC)
    .map(node => ({ label: node.data.name, value: node.id, inputId: `load-balancer-nic-${node.id}` }))
)
const ipOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS).map(n => ({ label: n.data.name, value: n.id })))
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))

const selectedBackendNicIds = computed({
  get: () => {
    const backendPools = Array.isArray(model.value.backendPools) ? model.value.backendPools : []
    return backendPools.flatMap(pool => pool.nicIds || [])
  },
  set: (nicIds: string[]) => {
    const existingPool = Array.isArray(model.value.backendPools) ? model.value.backendPools[0] : undefined
    model.value = {
      ...model.value,
      backendPools: nicIds.length > 0
        ? [{ id: existingPool?.id || `${model.value.id || 'load-balancer'}-backend-pool`, name: existingPool?.name || 'default-pool', nicIds }]
        : [],
    }
  },
})

// Frontend IP helpers
const frontendPublicIpId = computed({
  get: () => (model.value.frontendIpConfigs?.[0] as any)?.publicIpId ?? '',
  set: (v: string) => { model.value = { ...model.value, frontendIpConfigs: [{ id: 'feip', name: 'feip-config', publicIpId: v }] } },
})
const frontendSubnetId = computed({
  get: () => (model.value.frontendIpConfigs?.[0] as any)?.subnetId ?? '',
  set: (v: string) => {
    const existing = model.value.frontendIpConfigs?.[0] as any
    model.value = { ...model.value, frontendIpConfigs: [{ id: 'feip', name: 'feip-config', subnetId: v, privateIpAddress: existing?.privateIpAddress ?? '', privateIpAllocationMethod: 'Dynamic' }] }
  },
})
const frontendPrivateIp = computed({
  get: () => (model.value.frontendIpConfigs?.[0] as any)?.privateIpAddress ?? '',
  set: (v: string) => {
    const existing = model.value.frontendIpConfigs?.[0] as any
    model.value = { ...model.value, frontendIpConfigs: [{ ...existing, privateIpAddress: v }] }
  },
})

// Health probes
const probes = computed({
  get: () => (model.value.healthProbes as any[]) || [],
  set: (v: any[]) => { model.value = { ...model.value, healthProbes: v } },
})
function addProbe() { probes.value = [...probes.value, { name: 'probe', protocol: 'Tcp', port: 80, intervalInSeconds: 15, numberOfProbes: 2, requestPath: '' }] }
function removeProbe(i: number) { probes.value = probes.value.filter((_: any, idx: number) => idx !== i) }

// LB rules
const rules = computed({
  get: () => (model.value.loadBalancingRules as any[]) || [],
  set: (v: any[]) => { model.value = { ...model.value, loadBalancingRules: v } },
})
function addRule() { rules.value = [...rules.value, { name: 'rule', protocol: 'Tcp', frontendPort: 80, backendPort: 80 }] }
function removeRule(i: number) { rules.value = rules.value.filter((_: any, idx: number) => idx !== i) }
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.section { display: flex; flex-direction: column; gap: 0.45rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.caption, .helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
.rule-card { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.rule-row { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
</style>
