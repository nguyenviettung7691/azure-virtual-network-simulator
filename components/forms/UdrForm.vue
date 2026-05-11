<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-route-table" /></div>
    <div class="field checkbox-field"><label>Disable BGP Route Propagation</label><ToggleSwitch v-model="model.disableBgpRoutePropagation" /></div>
    <div class="routes-section">
      <div class="routes-header">
        <span class="section-title">Routes ({{ routes.length }})</span>
        <Button icon="pi pi-plus" size="small" text label="Add Route" @click="addRoute" />
      </div>
      <div v-for="(route, idx) in routes" :key="route.id" class="route-row" :class="{ 'has-route-error': getRouteErrors(idx).length > 0 }">
        <InputText v-model="route.name" placeholder="route-name" style="width:120px" />
        <div :class="{ 'has-error': hasRouteFieldError(idx, 'addressPrefix') }" class="input-wrapper">
          <InputText v-model="route.addressPrefix" placeholder="0.0.0.0/0" style="width:120px" />
        </div>
        <Select v-model="route.nextHopType" :options="hopTypes" style="width:150px" />
        <div :class="{ 'has-error': hasRouteFieldError(idx, 'nextHopIpAddress') }" class="input-wrapper">
          <InputText v-if="route.nextHopType === 'VirtualAppliance'" v-model="route.nextHopIpAddress" placeholder="10.x.x.x" style="width:110px" />
        </div>
        <Button icon="pi pi-trash" text size="small" severity="danger" @click="removeRoute(idx)" />
        <small v-for="(err, i) in getRouteErrors(idx)" :key="i" class="error-text">{{ err }}</small>
      </div>
    </div>
    <div class="subnet-section">
      <div class="section-header">
        <span class="section-title">Associated Subnets</span>
      </div>
      <div v-if="subnetOptions.length === 0" class="helper-text">No subnets in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in subnetOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedSubnetIds" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { UdrComponent, UdrRoute } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'
const props = defineProps<{ modelValue: Partial<UdrComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as UdrComponent, set: v => emit('update:modelValue', v) })
const routes = ref<UdrRoute[]>(model.value.routes || [])
watch(routes, v => { model.value = { ...model.value, routes: v } }, { deep: true })
const hopTypes = ['VirtualNetworkGateway','VnetLocal','Internet','VirtualAppliance','None']
function addRoute() { routes.value.push({ id: `r-${Date.now()}`, name: 'new-route', addressPrefix: '0.0.0.0/0', nextHopType: 'Internet' }) }
function removeRoute(i: number) { routes.value.splice(i, 1) }
const subnetOptions = computed(() => (props.nodes || []).filter((n: any) => n.data?.type === NetworkComponentType.SUBNET).map((n: any) => ({ label: n.data.name, value: n.id, inputId: `udr-subnet-${n.id}` })))
const selectedSubnetIds = computed({
  get: () => model.value.subnetIds || [],
  set: (ids: string[]) => { model.value = { ...model.value, subnetIds: ids } },
})

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getRouteErrors(routeIdx: number): string[] {
  return validationErrors.value
    .filter((e: FieldError) => e.fieldName.startsWith(`routes[${routeIdx}]`))
    .map((e: FieldError) => e.message)
}

function hasRouteFieldError(routeIdx: number, fieldName: string): boolean {
  return validationErrors.value.some((e: FieldError) => e.fieldName === `routes[${routeIdx}].${fieldName}`)
}
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.routes-section { display: flex; flex-direction: column; gap: 0.4rem; }
.routes-header { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.route-row { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; padding: 0.35rem 0.45rem; border-radius: 6px; }
.route-row.has-route-error { background-color: var(--red-50); border: 1px solid var(--red-200); }
.subnet-section { display: flex; flex-direction: column; gap: 0.45rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; }
.helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input) {
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
