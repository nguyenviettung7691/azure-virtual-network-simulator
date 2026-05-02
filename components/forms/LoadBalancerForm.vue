<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-lb" /></div>
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Basic','Standard','Gateway']" /></div>
    <div class="field"><label>Type</label><SelectButton v-model="model.loadBalancerType" :options="['Public','Internal']" /></div>
    <div class="field"><label>Tier</label><SelectButton v-model="model.tier" :options="['Regional','Global']" /></div>
    <div class="backend-section">
      <div class="backend-header">
        <span class="backend-title">Backend Pool Members</span>
        <small class="backend-caption">Select NICs to include in the default backend pool</small>
      </div>
      <div v-if="nicOptions.length === 0" class="helper-text">No NIC components are available in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in nicOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedBackendNicIds" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
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
    .map(node => ({
      label: node.data.name,
      value: node.id,
      inputId: `load-balancer-nic-${node.id}`,
    }))
)

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
        ? [{
            id: existingPool?.id || `${model.value.id || 'load-balancer'}-backend-pool`,
            name: existingPool?.name || 'default-pool',
            nicIds,
          }]
        : [],
    }
  },
})
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.backend-section { display: flex; flex-direction: column; gap: 0.45rem; }
.backend-header { display: flex; flex-direction: column; gap: 0.15rem; }
.backend-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.backend-caption, .helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
</style>
