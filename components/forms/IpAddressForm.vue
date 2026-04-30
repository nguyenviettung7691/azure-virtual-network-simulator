<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-public-ip" /></div>
    <div class="field"><label>IP Address</label><InputText v-model="model.ipAddress" class="w-full" placeholder="20.x.x.x (leave blank for dynamic)" /></div>
    <div class="field"><label>Allocation Method</label><SelectButton v-model="model.allocationMethod" :options="['Static','Dynamic']" /></div>
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Basic','Standard']" /></div>
    <div class="field"><label>IP Version</label><SelectButton v-model="model.ipVersion" :options="['IPv4','IPv6']" /></div>
    <div class="field"><label>DNS Label</label><InputText v-model="model.dnsLabel" class="w-full" placeholder="my-app" /></div>
  </div>
</template>
<script setup lang="ts">
import type { IpAddressComponent } from '~/types/network'
const props = defineProps<{ modelValue: Partial<IpAddressComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as IpAddressComponent, set: v => emit('update:modelValue', v) })
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
</style>
