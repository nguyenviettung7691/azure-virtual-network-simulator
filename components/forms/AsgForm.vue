<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-asg" /></div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
    <p class="hint">Application Security Groups logically group network interfaces. Assign NICs to this ASG for group-based NSG rules.</p>
  </div>
</template>
<script setup lang="ts">
import type { AsgComponent } from '~/types/network'
const props = defineProps<{ modelValue: Partial<AsgComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as AsgComponent, set: v => emit('update:modelValue', v) })
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.hint { font-size: 0.78rem; color: var(--text-color-secondary); font-style: italic; margin: 0; }
</style>
