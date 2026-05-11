<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-dns-zone" /></div>
    <div class="field"><label>Zone Name *</label>
      <div :class="{ 'has-error': getError('zoneName') }" class="input-wrapper">
        <InputText v-model="model.zoneName" class="w-full" placeholder="example.com" />
      </div>
      <small v-if="getError('zoneName')" class="error-text">{{ getError('zoneName') }}</small>
    </div>
    <div class="field"><label>Zone Type</label><SelectButton v-model="model.zoneType" :options="['Public','Private']" /></div>
    <div v-if="model.zoneType === 'Private'" class="links-section">
      <div class="section-header">
        <span class="section-title">VNet Links</span>
        <small class="section-caption">Private zones should be linked to one or more VNets.</small>
      </div>
      <div v-if="vnetOptions.length === 0" class="helper-text">No VNets are available in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in vnetOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedVnetLinks" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
        </div>
      </div>
    </div>
    <div class="records-section">
      <div class="records-header">
        <span class="section-title">Record Sets ({{ records.length }})</span>
        <Button icon="pi pi-plus" size="small" text label="Add Record" @click="addRecord" />
      </div>
      <div v-if="records.length === 0" class="helper-text">No record sets configured yet.</div>
      <div v-for="(record, idx) in records" :key="`${record.name}-${idx}`" class="record-row">
        <InputText v-model="record.name" placeholder="@ or web" style="width:110px" />
        <Select v-model="record.type" :options="recordTypes" style="width:100px" />
        <InputNumber v-model="record.ttl" :min="1" :max="86400" placeholder="TTL" style="width:95px" />
        <InputText
          :model-value="record.values.join(', ')"
          placeholder="10.0.1.10"
          style="flex:1; min-width:180px"
          @update:model-value="value => updateRecordValues(idx, String(value || ''))"
        />
        <Button icon="pi pi-trash" text size="small" severity="danger" @click="removeRecord(idx)" />
      </div>
    </div>
    <div class="field"><label>Description</label><Textarea v-model="model.description" rows="2" class="w-full" /></div>
  </div>
</template>
<script setup lang="ts">
import type { DnsZoneComponent } from '~/types/network'
import type { DnsRecord } from '~/types/network'
import { NetworkComponentType } from '~/types/network'

import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<DnsZoneComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue as DnsZoneComponent, set: v => emit('update:modelValue', v) })

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName)?.message
}

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'PTR', 'SRV', 'TXT']

const vnetOptions = computed(() =>
  (props.nodes || [])
    .filter(node => node.data?.type === NetworkComponentType.VNET)
    .map(node => ({
      label: node.data.name,
      value: node.id,
      inputId: `dns-zone-vnet-${node.id}`,
    }))
)

const selectedVnetLinks = computed({
  get: () => model.value.vnetLinks || [],
  set: (vnetLinks: string[]) => {
    model.value = { ...model.value, vnetLinks }
  },
})

const records = ref<DnsRecord[]>(cloneRecords(model.value.recordSets))

watch(() => model.value.id, () => {
  records.value = cloneRecords(model.value.recordSets)
}, { immediate: true })

watch(records, (value) => {
  model.value = { ...model.value, recordSets: cloneRecords(value) }
}, { deep: true })

function cloneRecords(value?: DnsRecord[]) {
  return (value || []).map(record => ({
    ...record,
    values: [...(record.values || [])],
  }))
}

function addRecord() {
  records.value.push({ name: '@', type: 'A', ttl: 300, values: ['10.0.0.10'] })
}

function removeRecord(idx: number) {
  records.value.splice(idx, 1)
}

function updateRecordValues(idx: number, nextValue: string) {
  const record = records.value[idx]
  if (!record) return
  records.value[idx] = {
    ...record,
    values: nextValue.split(',').map(value => value.trim()).filter(Boolean),
  }
}
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.links-section, .records-section { display: flex; flex-direction: column; gap: 0.45rem; }
.section-header { display: flex; flex-direction: column; gap: 0.15rem; }
.section-title { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.section-caption, .helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger) {
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
.records-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.record-row { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
</style>
