<template>
  <div class="component-form">
    <div class="field">
      <label>Name *</label>
      <div :class="{ 'has-error': getError('name') }" class="input-wrapper">
        <InputText v-model="model.name" class="w-full" :placeholder="isKeyVault ? 'my-key-vault' : 'my-managed-identity'" />
      </div>
      <small v-if="getError('name')" class="error-text">{{ getError('name') }}</small>
    </div>

    <div class="field">
      <label>Identity Type</label>
      <Select v-model="model.type" :options="identityTypes" option-label="label" option-value="value" class="w-full" />
    </div>

    <template v-if="isKeyVault">
      <div class="field">
        <label>Tenant ID</label>
        <InputText v-model="model.tenantId" class="w-full" placeholder="00000000-0000-0000-0000-000000000000" />
        <small class="help-text">Azure RBAC is the recommended default for new vaults on API version 2026-02-01+, but this simulator models legacy access policies only.</small>
        <small v-if="getWarning('tenantId')" class="warning-text">{{ getWarning('tenantId') }}</small>
      </div>

      <div class="field">
        <label>SKU</label>
        <SelectButton v-model="model.sku" :options="['Standard','Premium']" />
      </div>

      <div class="field checkbox-field">
        <label>Soft Delete</label>
        <ToggleSwitch v-model="model.enableSoftDelete" />
      </div>

      <div v-if="model.enableSoftDelete !== false" class="field">
        <label>Soft Delete Retention Days</label>
        <div :class="{ 'has-error': getError('softDeleteRetentionDays') }" class="input-wrapper">
          <InputNumber v-model="model.softDeleteRetentionDays" :min="7" :max="90" class="w-full" />
        </div>
        <small class="help-text">Azure requires 7-90 days for Key Vault soft delete retention.</small>
        <small v-if="getError('softDeleteRetentionDays')" class="error-text">{{ getError('softDeleteRetentionDays') }}</small>
      </div>

      <div class="field checkbox-field">
        <label>Purge Protection</label>
        <ToggleSwitch v-model="model.enablePurgeProtection" />
      </div>
      <small v-if="getError('enablePurgeProtection')" class="error-text">{{ getError('enablePurgeProtection') }}</small>

      <div class="field">
        <label>Network Default Action</label>
        <SelectButton v-model="model.networkDefaultAction" :options="['Allow','Deny']" />
        <small class="help-text">Allow keeps the public endpoint open. Deny turns on the firewall and requires selected networks, IP rules, or trusted-service bypass.</small>
        <small v-if="getError('networkDefaultAction')" class="error-text">{{ getError('networkDefaultAction') }}</small>
        <small v-if="getWarning('networkDefaultAction')" class="warning-text">{{ getWarning('networkDefaultAction') }}</small>
      </div>

      <div class="field checkbox-field">
        <label>Allow Trusted Microsoft Services</label>
        <ToggleSwitch v-model="model.allowTrustedMicrosoftServices" />
      </div>
      <small class="help-text">Trusted-service bypass is modeled as metadata only. Private-endpoint-only access remains out of scope for v1.</small>

      <div class="field">
        <label>Virtual Network Rules</label>
        <div v-if="subnetOptions.length === 0" class="help-text">No subnets in the diagram yet.</div>
        <div v-else class="checkbox-list">
          <div v-for="option in subnetOptions" :key="option.value" class="checkbox-row">
            <Checkbox v-model="selectedVnetRules" :input-id="option.inputId" :value="option.value" />
            <label :for="option.inputId">{{ option.label }}</label>
          </div>
        </div>
        <small class="help-text">Selected-network access requires the Microsoft.KeyVault service endpoint on each subnet.</small>
        <small v-if="getError('virtualNetworkRules')" class="error-text">{{ getError('virtualNetworkRules') }}</small>
        <small v-if="getWarning('virtualNetworkRules')" class="warning-text">{{ getWarning('virtualNetworkRules') }}</small>
      </div>

      <div class="field">
        <label>IP Rules</label>
        <InputText v-model="ipRulesStr" class="w-full" placeholder="203.0.113.10, 198.51.100.0/24" />
        <small class="help-text">Comma-separated public IPv4 addresses or CIDR ranges. Private RFC1918 ranges are rejected.</small>
        <small v-if="getError('ipRules')" class="error-text">{{ getError('ipRules') }}</small>
        <small v-if="getWarning('ipRules')" class="warning-text">{{ getWarning('ipRules') }}</small>
      </div>

      <div class="field">
        <div class="inline-header">
          <label>Legacy Access Policies</label>
          <Button label="Add Policy" icon="pi pi-plus" text size="small" @click="addAccessPolicy" />
        </div>
        <small class="help-text">This simulator models legacy access policies for data-plane access. Azure RBAC is documented but not behaviorally evaluated here.</small>
        <div v-if="accessPolicies.length === 0" class="helper-card">No access policies configured.</div>
        <div v-else class="policy-list">
          <div v-for="(policy, index) in accessPolicies" :key="index" class="policy-card">
            <div class="inline-header">
              <strong>Policy {{ index + 1 }}</strong>
              <Button icon="pi pi-trash" text severity="danger" rounded size="small" @click="removeAccessPolicy(index)" />
            </div>

            <div class="field">
              <label>Tenant ID</label>
              <InputText
                :model-value="policy.tenantId"
                class="w-full"
                placeholder="00000000-0000-0000-0000-000000000000"
                @update:modelValue="value => updateAccessPolicy(index, { tenantId: String(value || '') })"
              />
              <small v-if="getError(`accessPolicies[${index}].tenantId`)" class="error-text">{{ getError(`accessPolicies[${index}].tenantId`) }}</small>
            </div>

            <div class="field">
              <label>Object ID</label>
              <InputText
                :model-value="policy.objectId"
                class="w-full"
                placeholder="00000000-0000-0000-0000-000000000000"
                @update:modelValue="value => updateAccessPolicy(index, { objectId: String(value || '') })"
              />
              <small v-if="getError(`accessPolicies[${index}].objectId`)" class="error-text">{{ getError(`accessPolicies[${index}].objectId`) }}</small>
            </div>

            <div class="field">
              <label>Key Permissions</label>
              <MultiSelect
                :model-value="policy.permissions?.keys || []"
                :options="keyPermissionOptions"
                class="w-full"
                display="chip"
                placeholder="Select key permissions"
                @update:modelValue="value => updateAccessPolicy(index, { permissions: { keys: value as string[] } })"
              />
              <small v-if="getError(`accessPolicies[${index}].permissions.keys`)" class="error-text">{{ getError(`accessPolicies[${index}].permissions.keys`) }}</small>
            </div>

            <div class="field">
              <label>Secret Permissions</label>
              <MultiSelect
                :model-value="policy.permissions?.secrets || []"
                :options="secretPermissionOptions"
                class="w-full"
                display="chip"
                placeholder="Select secret permissions"
                @update:modelValue="value => updateAccessPolicy(index, { permissions: { secrets: value as string[] } })"
              />
              <small v-if="getError(`accessPolicies[${index}].permissions.secrets`)" class="error-text">{{ getError(`accessPolicies[${index}].permissions.secrets`) }}</small>
            </div>

            <div class="field">
              <label>Certificate Permissions</label>
              <MultiSelect
                :model-value="policy.permissions?.certificates || []"
                :options="certificatePermissionOptions"
                class="w-full"
                display="chip"
                placeholder="Select certificate permissions"
                @update:modelValue="value => updateAccessPolicy(index, { permissions: { certificates: value as string[] } })"
              />
              <small v-if="getError(`accessPolicies[${index}].permissions.certificates`)" class="error-text">{{ getError(`accessPolicies[${index}].permissions.certificates`) }}</small>
            </div>

            <small v-if="getError(`accessPolicies[${index}].permissions`)" class="error-text">{{ getError(`accessPolicies[${index}].permissions`) }}</small>
          </div>
        </div>
        <small v-if="getError('accessPolicies')" class="error-text">{{ getError('accessPolicies') }}</small>
        <small v-if="getWarning('accessPolicies')" class="warning-text">{{ getWarning('accessPolicies') }}</small>
      </div>
    </template>

    <template v-if="isManagedIdentity">
      <div class="field">
        <label>Identity Type</label>
        <SelectButton v-model="model.identityType" :options="['SystemAssigned','UserAssigned']" />
        <small v-if="getError('identityType')" class="error-text">{{ getError('identityType') }}</small>
        <small class="help-text">
          <span v-if="model.identityType === 'SystemAssigned'">
            System-assigned: created with the parent resource, deleted with the parent resource, and scoped to one resource.
          </span>
          <span v-else>
            User-assigned: standalone, reusable, assignable to multiple resources, and deleted separately.
          </span>
        </small>
      </div>

      <div class="field">
        <label>Client ID</label>
        <InputText v-model="model.clientId" class="w-full" placeholder="00000000-0000-0000-0000-000000000000" />
        <small class="help-text">Azure application (client) ID. Azure generates this value.</small>
        <small v-if="getWarning('clientId')" class="warning-text">{{ getWarning('clientId') }}</small>
      </div>

      <div class="field">
        <label>Principal ID</label>
        <InputText v-model="model.principalId" class="w-full" placeholder="00000000-0000-0000-0000-000000000000" />
        <small class="help-text">Service principal object ID in Microsoft Entra ID. Azure generates this value.</small>
        <small v-if="getWarning('principalId')" class="warning-text">{{ getWarning('principalId') }}</small>
      </div>

      <div class="field">
        <label>Tenant ID</label>
        <InputText v-model="model.tenantId" class="w-full" placeholder="00000000-0000-0000-0000-000000000000" />
        <small class="help-text">Microsoft Entra tenant ID.</small>
        <small v-if="getWarning('tenantId')" class="warning-text">{{ getWarning('tenantId') }}</small>
      </div>

      <div v-if="model.identityType === 'UserAssigned'" class="field">
        <label>Resource ID</label>
        <InputText v-model="model.resourceId" class="w-full" placeholder="/subscriptions/.../userAssignedIdentities/..." />
        <small class="help-text">Azure resource ID (user-assigned only).</small>
        <small v-if="getWarning('resourceId')" class="warning-text">{{ getWarning('resourceId') }}</small>
      </div>

      <div v-if="model.identityType === 'UserAssigned'" class="field">
        <label>Isolation Scope</label>
        <SelectButton v-model="model.isolationScope" :options="['Regional','None']" />
        <small class="help-text">Regional restricts assignment to same-region resources. None allows cross-region assignment.</small>
        <small v-if="getWarning('isolationScope')" class="warning-text">{{ getWarning('isolationScope') }}</small>
      </div>

      <div v-if="model.identityType === 'SystemAssigned'" class="field">
        <label>Assigned To</label>
        <Select v-model="model.assignedToId" :options="allNodeOptions" option-label="label" option-value="value" class="w-full" placeholder="Select resource" showClear />
        <small class="help-text">Parent resource this system-assigned identity is documenting.</small>
        <small v-if="getWarning('assignedToId')" class="warning-text">{{ getWarning('assignedToId') }}</small>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import { KEY_VAULT_ACCESS_POLICY_PERMISSION_OPTIONS } from '~/lib/keyVault'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity === 'error')?.message
}

function getWarning(fieldName: string): string | undefined {
  return validationErrors.value.find((e: FieldError) => e.fieldName === fieldName && e.severity === 'warning')?.message
}

const subnetOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.SUBNET)
    .map(n => ({ label: n.data.name, value: n.id, inputId: `kv-subnet-${n.id}` })),
)

const identityCapableTypes = [
  NetworkComponentType.VM,
  NetworkComponentType.VMSS,
  NetworkComponentType.AKS,
  NetworkComponentType.APP_SERVICE,
  NetworkComponentType.FUNCTIONS,
]

const allNodeOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.id !== model.value.id && identityCapableTypes.includes(n.data?.type))
    .map(n => ({ label: `${n.data.name} (${n.data.type})`, value: n.id })),
)

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

const ipRulesStr = computed({
  get: () => Array.isArray(model.value.ipRules) ? model.value.ipRules.join(', ') : '',
  set: (value: string) => {
    model.value = {
      ...model.value,
      ipRules: value.split(',').map((entry: string) => entry.trim()).filter(Boolean),
    }
  },
})

const accessPolicies = computed(() => Array.isArray(model.value.accessPolicies) ? model.value.accessPolicies : [])

const keyPermissionOptions = KEY_VAULT_ACCESS_POLICY_PERMISSION_OPTIONS.keys.map(value => ({ label: value, value }))
const secretPermissionOptions = KEY_VAULT_ACCESS_POLICY_PERMISSION_OPTIONS.secrets.map(value => ({ label: value, value }))
const certificatePermissionOptions = KEY_VAULT_ACCESS_POLICY_PERMISSION_OPTIONS.certificates.map(value => ({ label: value, value }))

function addAccessPolicy() {
  model.value = {
    ...model.value,
    accessPolicies: [
      ...accessPolicies.value,
      {
        tenantId: model.value.tenantId || '',
        objectId: '',
        permissions: {
          keys: [],
          secrets: [],
          certificates: [],
        },
      },
    ],
  }
}

function updateAccessPolicy(index: number, patch: Record<string, any>) {
  const next = [...accessPolicies.value]
  const current = next[index] || { tenantId: '', objectId: '', permissions: {} }
  next[index] = {
    ...current,
    ...patch,
    permissions: {
      ...(current.permissions || {}),
      ...(patch.permissions || {}),
    },
  }
  model.value = { ...model.value, accessPolicies: next }
}

function removeAccessPolicy(index: number) {
  const next = [...accessPolicies.value]
  next.splice(index, 1)
  model.value = { ...model.value, accessPolicies: next }
}
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
.helper-text, .help-text { font-size: 0.72rem; color: var(--text-muted); }
.error-text { font-size: 0.75rem; color: var(--red-500); font-weight: 500; }
.warning-text { font-size: 0.75rem; color: var(--orange-500); font-weight: 500; }
.checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-alt);
}
.checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
.input-wrapper { position: relative; }
.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger),
.input-wrapper.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
.inline-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.policy-list { display: flex; flex-direction: column; gap: 0.75rem; }
.policy-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-alt);
}
.helper-card {
  padding: 0.75rem;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--surface-ground);
  color: var(--text-muted);
  font-size: 0.78rem;
}
</style>
