<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-lb" /></div>
    <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Basic','Standard','Gateway']" /></div>
    <div class="field"><label>Type</label><SelectButton v-model="model.loadBalancerType" :options="['Public','Internal']" /></div>
    <div class="field"><label>Tier</label><SelectButton v-model="model.tier" :options="['Regional','Global']" /></div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
  </div>
</template>
<script setup lang="ts">
import type { LoadBalancerComponent } from '~/types/network'
const props = defineProps<{ modelValue: Partial<LoadBalancerComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as LoadBalancerComponent, set: v => emit('update:modelValue', v) })
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
</style>
