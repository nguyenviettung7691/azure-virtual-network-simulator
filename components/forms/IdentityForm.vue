<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-key-vault" /></div>
    <div class="field"><label>Identity Type</label>
      <Select v-model="model.type" :options="identityTypes" option-label="label" option-value="value" class="w-full" />
    </div>
    <template v-if="isKeyVault">
      <div class="field"><label>SKU</label><SelectButton v-model="model.sku" :options="['Standard','Premium']" /></div>
      <div class="field checkbox-field"><label>Soft Delete</label><ToggleSwitch v-model="model.enableSoftDelete" /></div>
      <template v-if="model.enableSoftDelete">
        <div class="field"><label>Soft Delete Retention Days</label><InputNumber v-model="model.softDeleteRetentionDays" :min="7" :max="90" class="w-full" /></div>
      </template>
      <div class="field checkbox-field"><label>Purge Protection</label><ToggleSwitch v-model="model.enablePurgeProtection" /></div>
      <div class="field"><label>Network Default Action</label><SelectButton v-model="model.networkDefaultAction" :options="['Allow','Deny']" /></div>
      <div class="field">
        <label>Virtual Network Rules (allowed subnets)</label>
        <div v-if="subnetOptions.length === 0" class="helper-text">No subnets in the diagram yet.</div>
        <div v-else class="checkbox-list">
          <div v-for="option in subnetOptions" :key="option.value" class="checkbox-row">
            <Checkbox v-model="selectedVnetRules" :input-id="option.inputId" :value="option.value" />
            <label :for="option.inputId">{{ option.label }}</label>
          </div>
        </div>
      </div>
    </template>
    <template v-if="isManagedIdentity">
      <div class="field"><label>Identity Type</label><SelectButton v-model="model.identityType" :options="['SystemAssigned','UserAssigned']" /></div>
      <div class="field"><label>Client ID</label><InputText v-model="model.clientId" class="w-full" placeholder="00000000-..." /></div>
      <div class="field"><label>Assigned To</label>
        <Select v-model="model.assignedToId" :options="allNodeOptions" option-label="label" option-value="value" class="w-full" placeholder="Select resource" showClear />
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id, inputId: `kv-subnet-${n.id}` })))
const allNodeOptions = computed(() => (props.nodes || []).filter(n => n.data?.type !== NetworkComponentType.INTERNET).map(n => ({ label: `${n.data.name} (${n.data.type})`, value: n.id })))
const identityTypes = [
  { label: 'Key Vault', value: NetworkComponentType.KEY_VAULT },
  { label: 'Managed Identity', value: NetworkComponentType.MANAGED_IDENTITY },
]
const isKeyVault = computed(() => model.value.type === NetworkComponentType.KEY_VAULT)
const isManagedIdentity = computed(() => model.value.type === NetworkComponentType.MANAGED_IDENTITY)
const selectedVnetRules = computed({
  get: () => model.value.virtualNetworkRules || [],
  set: (ids: string[]) => { model.value = { ...model.value, virtualNetworkRules: ids } },
})
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.helper-text { font-size: 0.72rem; color: var(--text-muted); }
.checkbox-list { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem 0.65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); }
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
</style>
