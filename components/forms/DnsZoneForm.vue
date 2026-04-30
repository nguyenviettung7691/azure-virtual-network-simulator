<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-dns-zone" /></div>
    <div class="field"><label>Zone Name *</label><InputText v-model="model.zoneName" class="w-full" placeholder="example.com" /></div>
    <div class="field"><label>Zone Type</label><SelectButton v-model="model.zoneType" :options="['Public','Private']" /></div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
  </div>
</template>
<script setup lang="ts">
import type { DnsZoneComponent } from '~/types/network'
const props = defineProps<{ modelValue: Partial<DnsZoneComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as DnsZoneComponent, set: v => emit('update:modelValue', v) })
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
</style>
