<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-nsg" /></div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
    <div class="rules-section">
      <div class="rules-header">
        <span class="rules-title">Security Rules ({{ rules.length }})</span>
        <Button icon="pi pi-plus" size="small" text label="Add Rule" @click="addRule" />
      </div>
      <div v-for="(rule, idx) in rules" :key="rule.id" class="rule-row">
        <InputText v-model="rule.name" placeholder="rule-name" style="width:120px" />
        <InputNumber v-model="rule.priority" :min="100" :max="4096" placeholder="100" style="width:80px" />
        <Select v-model="rule.direction" :options="['Inbound','Outbound']" style="width:100px" />
        <Select v-model="rule.access" :options="['Allow','Deny']" style="width:80px" />
        <Select v-model="rule.protocol" :options="['Tcp','Udp','Icmp','*']" style="width:80px" />
        <InputText v-model="rule.destinationPortRange" placeholder="Port" style="width:80px" />
        <Button icon="pi pi-trash" text size="small" severity="danger" @click="removeRule(idx)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NsgComponent, NsgRule } from '~/types/network'
const props = defineProps<{ modelValue: Partial<NsgComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as NsgComponent, set: v => emit('update:modelValue', v) })
const rules = ref<NsgRule[]>(model.value.securityRules || [])
watch(rules, v => { model.value = { ...model.value, securityRules: v } }, { deep: true })
function addRule() {
  rules.value.push({ id: `rule-${Date.now()}`, name: 'new-rule', priority: 100 + rules.value.length * 10, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourceAddressPrefix: '*', sourcePortRange: '*', destinationAddressPrefix: '*', destinationPortRange: '80' })
}
function removeRule(idx: number) { rules.value.splice(idx, 1) }
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.rules-section { display: flex; flex-direction: column; gap: 0.4rem; }
.rules-header { display: flex; align-items: center; justify-content: space-between; }
.rules-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.rule-row { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
</style>
