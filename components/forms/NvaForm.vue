<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-nva" /></div>
    <div class="field"><label>VM Size</label><InputText v-model="model.vmSize" class="w-full" placeholder="Standard_D2s_v3" /></div>
    <div class="field"><label>Publisher</label><InputText v-model="model.publisher" class="w-full" placeholder="cisco" /></div>
    <div class="field"><label>Offer</label><InputText v-model="model.offer" class="w-full" placeholder="cisco-csr-1000v" /></div>
    <div class="field"><label>SKU</label><InputText v-model="model.sku" class="w-full" placeholder="17_3_3-byol" /></div>
    <div class="field"><label>Version</label><InputText v-model="model.version" class="w-full" placeholder="latest" /></div>
    <div class="field checkbox-field"><label>Enable IP Forwarding</label><ToggleSwitch v-model="model.enableIpForwarding" /></div>
    <div class="field"><label>Subnet</label>
      <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
    </div>
  </div>
</template>
<script setup lang="ts">
import type { NvaComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: Partial<NvaComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as NvaComponent, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
