<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-nsg" /></div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
    <div class="rules-section">
      <div class="rules-header">
        <span class="rules-title">Security Rules ({{ rules.length }})</span>
        <Button icon="pi pi-plus" size="small" text label="Add Rule" @click="addRule" />
      </div>
      <div v-if="overallRuleError" class="overall-error">{{ overallRuleError }}</div>
      <div v-if="rules.length === 0" class="helper-text">No rules configured yet.</div>
      <div v-for="(rule, idx) in rules" :key="rule.id" class="rule-card" :class="{ 'has-rule-error': getRuleErrors(idx).length > 0 }">
        <div class="rule-row rule-row-top">
          <div :class="{ 'has-error': hasRuleFieldError(idx, 'name') }" class="input-wrapper" style="flex:2; min-width:100px">
            <InputText v-model="rule.name" placeholder="rule-name" class="w-full" />
          </div>
          <div :class="{ 'has-error': hasRuleFieldError(idx, 'priority') }" class="input-wrapper" style="width:90px">
            <InputNumber v-model="rule.priority" :min="100" :max="4096" placeholder="Priority" />
          </div>
          <Select v-model="rule.direction" :options="['Inbound','Outbound']" style="width:110px" />
          <Select v-model="rule.access" :options="['Allow','Deny']" style="width:90px" />
          <Select v-model="rule.protocol" :options="['Tcp','Udp','Icmp','*']" style="width:80px" />
          <Button icon="pi pi-trash" text size="small" severity="danger" @click="removeRule(idx)" />
        </div>
        <div class="rule-row rule-row-bottom">
          <div class="rule-addr-group">
            <small class="rule-field-label">Src Address</small>
            <div :class="{ 'has-error': hasRuleFieldError(idx, 'sourceAddressPrefix') }" class="input-wrapper">
              <InputText v-model="rule.sourceAddressPrefix" placeholder="* or 10.0.0.0/8" style="width:140px" />
            </div>
          </div>
          <div class="rule-addr-group">
            <small class="rule-field-label">Src Port</small>
            <div :class="{ 'has-error': hasRuleFieldError(idx, 'sourcePortRange') }" class="input-wrapper">
              <InputText v-model="rule.sourcePortRange" placeholder="*" style="width:75px" />
            </div>
          </div>
          <div class="rule-addr-group">
            <small class="rule-field-label">Dest Address</small>
            <div :class="{ 'has-error': hasRuleFieldError(idx, 'destinationAddressPrefix') }" class="input-wrapper">
              <InputText v-model="rule.destinationAddressPrefix" placeholder="* or VirtualNetwork" style="width:140px" />
            </div>
          </div>
          <div class="rule-addr-group">
            <small class="rule-field-label">Dest Port</small>
            <div :class="{ 'has-error': hasRuleFieldError(idx, 'destinationPortRange') }" class="input-wrapper">
              <InputText v-model="rule.destinationPortRange" placeholder="80 or 80,443" style="width:100px" />
            </div>
          </div>
        </div>
        <div v-if="getRuleErrors(idx).length > 0" class="rule-errors">
          <small v-for="(err, i) in getRuleErrors(idx)" :key="i" class="error-text">{{ err }}</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NsgComponent, NsgRule } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<NsgComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as NsgComponent, set: v => emit('update:modelValue', v) })
const rules = ref<NsgRule[]>(model.value.securityRules || [])
watch(rules, v => { model.value = { ...model.value, securityRules: v } }, { deep: true })

function addRule() {
  rules.value.push({ id: `rule-${Date.now()}`, name: 'new-rule', priority: 100 + rules.value.length * 10, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourceAddressPrefix: '*', sourcePortRange: '*', destinationAddressPrefix: '*', destinationPortRange: '80' })
}

function removeRule(idx: number) { rules.value.splice(idx, 1) }

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, []).errors
})

const overallRuleError = computed(() => {
  const err = validationErrors.value.find((e: FieldError) => !e.fieldName.includes('['))
  return err?.message
})

function getRuleErrors(ruleIdx: number): string[] {
  return validationErrors.value
    .filter((e: FieldError) => e.fieldName.startsWith(`rules[${ruleIdx}]`))
    .map((e: FieldError) => e.message)
}

function hasRuleFieldError(ruleIdx: number, fieldName: string): boolean {
  return validationErrors.value.some((e: FieldError) => e.fieldName === `rules[${ruleIdx}].${fieldName}`)
}
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.rules-section { display: flex; flex-direction: column; gap: 0.5rem; }
.rules-header { display: flex; align-items: center; justify-content: space-between; }
.rules-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.helper-text { font-size: 0.72rem; color: var(--text-muted); }
.overall-error { font-size: 0.72rem; color: var(--red-700); background-color: var(--red-50); padding: 0.4rem 0.6rem; border-radius: 4px; }
.rule-card { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.rule-card.has-rule-error { border-color: var(--red-500); background-color: var(--red-50); }
.rule-row { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
.rule-row-bottom { gap: 0.5rem; }
.rule-addr-group { display: flex; flex-direction: column; gap: 0.15rem; }
.rule-field-label { font-size: 0.68rem; color: var(--text-muted); font-weight: 600; }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.rule-errors { display: flex; flex-direction: column; gap: 0.2rem; padding-top: 0.2rem; }
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
