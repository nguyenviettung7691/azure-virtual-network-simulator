<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-route-table" /></div>
    <div class="field checkbox-field"><label>Disable BGP Route Propagation</label><ToggleSwitch v-model="model.disableBgpRoutePropagation" /></div>
    <div class="routes-section">
      <div class="routes-header">
        <span class="section-title">Routes ({{ routes.length }})</span>
        <Button icon="pi pi-plus" size="small" text label="Add Route" @click="addRoute" />
      </div>
      <div v-for="(route, idx) in routes" :key="route.id" class="route-row">
        <InputText v-model="route.name" placeholder="route-name" style="width:120px" />
        <InputText v-model="route.addressPrefix" placeholder="0.0.0.0/0" style="width:120px" />
        <Select v-model="route.nextHopType" :options="hopTypes" style="width:150px" />
        <InputText v-if="route.nextHopType === 'VirtualAppliance'" v-model="route.nextHopIpAddress" placeholder="10.x.x.x" style="width:110px" />
        <Button icon="pi pi-trash" text size="small" severity="danger" @click="removeRoute(idx)" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { UdrComponent, UdrRoute } from '~/types/network'
const props = defineProps<{ modelValue: Partial<UdrComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as UdrComponent, set: v => emit('update:modelValue', v) })
const routes = ref<UdrRoute[]>(model.value.routes || [])
watch(routes, v => { model.value = { ...model.value, routes: v } }, { deep: true })
const hopTypes = ['VirtualNetworkGateway','VnetLocal','Internet','VirtualAppliance','None']
function addRoute() { routes.value.push({ id: `r-${Date.now()}`, name: 'new-route', addressPrefix: '0.0.0.0/0', nextHopType: 'Internet' }) }
function removeRoute(i: number) { routes.value.splice(i, 1) }
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.routes-section { display: flex; flex-direction: column; gap: 0.4rem; }
.routes-header { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.route-row { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
</style>
