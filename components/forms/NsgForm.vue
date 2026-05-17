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
      <div class="rule-evaluation-help">
        <small><strong>Rule Evaluation:</strong> Inbound: Subnet NSG first, then NIC NSG. Outbound: NIC NSG first, then Subnet NSG. Lower priority = evaluated first.</small>
      </div>
      <div v-for="(rule, idx) in rules" :key="rule.id" class="rule-card" :class="{ 'has-rule-error': getRuleErrors(idx).length > 0 }">
        <!-- Row 1: Name, Priority, Direction, Access, Protocol, Delete -->
        <div class="rule-row rule-row-top">
          <div :class="{ 'has-error': hasRuleFieldError(idx, 'name') }" class="input-wrapper" style="flex:2; min-width:100px">
            <InputText v-model="rule.name" placeholder="rule-name" class="w-full" />
            <small class="rule-field-label">Name (80 chars max)</small>
          </div>
          <div :class="{ 'has-error': hasRuleFieldError(idx, 'priority') }" class="input-wrapper" style="width:90px">
            <InputNumber v-model="rule.priority" :min="100" :max="4096" placeholder="Priority" />
            <small class="rule-field-label">Priority</small>
          </div>
          <Select v-model="rule.direction" :options="['Inbound','Outbound']" style="width:110px" />
          <Select v-model="rule.access" :options="['Allow','Deny']" style="width:90px" />
          <Select v-model="rule.protocol" :options="['Tcp','Udp','Icmp','*']" style="width:80px" />
          <Button icon="pi pi-trash" text size="small" severity="danger" @click="removeRule(idx)" />
        </div>

        <!-- Row 2: Source Type, Source Address/Tag/Asg, Source Port -->
        <div class="rule-row rule-addr-row">
          <div style="flex: 1; min-width: 140px">
            <small class="rule-field-label">Src Type</small>
            <div class="type-selector">
              <Button 
                :class="{ active: (rule.sourceType || 'IpCidr') === 'IpCidr' }"
                text 
                size="small" 
                label="IP/CIDR" 
                @click="rule.sourceType = 'IpCidr'"
              />
              <Button 
                :class="{ active: rule.sourceType === 'ServiceTag' }"
                text 
                size="small" 
                label="Tag" 
                @click="rule.sourceType = 'ServiceTag'"
              />
              <Button 
                :class="{ active: rule.sourceType === 'Asg' }"
                text 
                size="small" 
                label="ASG" 
                @click="rule.sourceType = 'Asg'"
              />
            </div>
          </div>
          
          <div :class="{ 'has-error': hasRuleFieldError(idx, 'sourceAddressPrefix') || hasRuleFieldError(idx, 'sourceAsgId') }" style="flex: 2; min-width: 160px">
            <small class="rule-field-label">Source</small>
            <InputText 
              v-if="(rule.sourceType || 'IpCidr') === 'IpCidr'"
              v-model="rule.sourceAddressPrefix" 
              placeholder="10.0.0.0/8 or *" 
              class="w-full"
            />
            <Dropdown 
              v-else-if="rule.sourceType === 'ServiceTag'"
              v-model="rule.sourceAddressPrefix"
              :options="serviceTagOptions"
              filter
              placeholder="Select service tag"
              class="w-full"
            />
            <Dropdown 
              v-else-if="rule.sourceType === 'Asg'"
              v-model="rule.sourceAsgId"
              :options="asgOptions"
              option-label="name"
              option-value="id"
              filter
              placeholder="Select ASG"
              class="w-full"
            />
          </div>

          <div :class="{ 'has-error': hasRuleFieldError(idx, 'sourcePortRange') }" style="flex: 1; min-width: 100px">
            <small class="rule-field-label">Src Port</small>
            <InputText v-model="rule.sourcePortRange" placeholder="* or 80" class="w-full" />
          </div>
        </div>

        <!-- Row 3: Destination Type, Destination Address/Tag/Asg, Destination Port -->
        <div class="rule-row rule-addr-row">
          <div style="flex: 1; min-width: 140px">
            <small class="rule-field-label">Dst Type</small>
            <div class="type-selector">
              <Button 
                :class="{ active: (rule.destinationType || 'IpCidr') === 'IpCidr' }"
                text 
                size="small" 
                label="IP/CIDR" 
                @click="rule.destinationType = 'IpCidr'"
              />
              <Button 
                :class="{ active: rule.destinationType === 'ServiceTag' }"
                text 
                size="small" 
                label="Tag" 
                @click="rule.destinationType = 'ServiceTag'"
              />
              <Button 
                :class="{ active: rule.destinationType === 'Asg' }"
                text 
                size="small" 
                label="ASG" 
                @click="rule.destinationType = 'Asg'"
              />
            </div>
          </div>
          
          <div :class="{ 'has-error': hasRuleFieldError(idx, 'destinationAddressPrefix') || hasRuleFieldError(idx, 'destinationAsgId') }" style="flex: 2; min-width: 160px">
            <small class="rule-field-label">Destination</small>
            <InputText 
              v-if="(rule.destinationType || 'IpCidr') === 'IpCidr'"
              v-model="rule.destinationAddressPrefix" 
              placeholder="10.0.1.0/24 or *" 
              class="w-full"
            />
            <Dropdown 
              v-else-if="rule.destinationType === 'ServiceTag'"
              v-model="rule.destinationAddressPrefix"
              :options="serviceTagOptions"
              filter
              placeholder="Select service tag"
              class="w-full"
            />
            <Dropdown 
              v-else-if="rule.destinationType === 'Asg'"
              v-model="rule.destinationAsgId"
              :options="asgOptions"
              option-label="name"
              option-value="id"
              filter
              placeholder="Select ASG"
              class="w-full"
            />
          </div>

          <div :class="{ 'has-error': hasRuleFieldError(idx, 'destinationPortRange') }" style="flex: 1; min-width: 100px">
            <small class="rule-field-label">Dst Port</small>
            <InputText v-model="rule.destinationPortRange" placeholder="80 or 80,443" class="w-full" />
          </div>
        </div>

        <!-- Row 4: Description -->
        <div class="rule-row">
          <div :class="{ 'has-error': hasRuleFieldError(idx, 'description') }" class="input-wrapper" style="flex: 1">
            <InputText v-model="rule.description" placeholder="Optional description" class="w-full" />
            <small class="rule-field-label">Description (140 chars max)</small>
          </div>
        </div>

        <!-- Errors -->
        <div v-if="getRuleErrors(idx).length > 0" class="rule-errors">
          <small v-for="(err, i) in getRuleErrors(idx)" :key="i" class="error-text">{{ err }}</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NsgComponent, NsgRule, NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<NsgComponent> }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as NsgComponent, set: v => emit('update:modelValue', v) })
const rules = ref<NsgRule[]>(model.value.securityRules || [])
watch(rules, v => { model.value = { ...model.value, securityRules: v } }, { deep: true })

// Service tag options
const serviceTagOptions = [
  'VirtualNetwork',
  'Internet',
  'AzureLoadBalancer',
  'AppService',
  'Storage',
  'KeyVault',
  'Sql',
  'AzureActiveDirectory',
  'AzureContainerRegistry',
  'AzureResourceManager',
  'AzureSqlDatabase',
  'AzureMonitor',
]

// ASG options from diagram (placeholder - will be empty until diagram context is available)
const asgOptions = computed(() => {
  // In a real implementation, this would be populated from the diagram store
  return []
})

function addRule() {
  rules.value.push({
    id: `rule-${Date.now()}`,
    name: 'new-rule',
    priority: 100 + rules.value.length * 10,
    direction: 'Inbound',
    access: 'Allow',
    protocol: 'Tcp',
    sourceAddressPrefix: '*',
    sourcePortRange: '*',
    destinationAddressPrefix: '*',
    destinationPortRange: '80',
    sourceType: 'IpCidr',
    destinationType: 'IpCidr',
  })
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
.rule-evaluation-help { font-size: 0.68rem; color: var(--text-muted); background-color: var(--surface-alt); padding: 0.5rem; border-radius: 4px; border-left: 3px solid var(--primary-color); }
.overall-error { font-size: 0.72rem; color: var(--red-700); background-color: var(--red-50); padding: 0.4rem 0.6rem; border-radius: 4px; }
.rule-card { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.rule-card.has-rule-error { border-color: var(--red-500); background-color: var(--red-50); }
.rule-row { display: flex; gap: 0.3rem; align-items: flex-start; flex-wrap: wrap; }
.rule-row-top { gap: 0.3rem; align-items: center; }
.rule-addr-row { gap: 0.4rem; align-items: flex-start; }
.rule-addr-group { display: flex; flex-direction: column; gap: 0.15rem; }
.rule-field-label { font-size: 0.68rem; color: var(--text-muted); font-weight: 600; display: block; margin-top: 0.15rem; }
.type-selector { display: flex; gap: 0.2rem; }
.type-selector :deep(.p-button) { padding: 0.25rem 0.5rem; font-size: 0.7rem; }
.type-selector :deep(.p-button.active) { background-color: var(--primary-color) !important; color: var(--primary-color-text) !important; }
.input-wrapper { position: relative; display: flex; flex-direction: column; gap: 0.15rem; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-dropdown),
.input-wrapper.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.rule-errors { display: flex; flex-direction: column; gap: 0.2rem; padding-top: 0.2rem; }
.error-text { color: var(--red-700); }
</style>
