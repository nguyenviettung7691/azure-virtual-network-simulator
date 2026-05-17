<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-app-gw" /></div>
    
    <div class="field"><label>SKU (v2 Only)</label><Select v-model="model.sku" :options="['Standard_v2','WAF_v2']" class="w-full" /></div>
    
    <div class="field"><label>Frontend Type</label><SelectButton v-model="model.frontendType" :options="['Public','Internal']" /></div>
    
    <div class="field"><label>Capacity (Fixed Mode)</label>
      <div :class="{ 'has-error': getError('capacity') }" class="input-wrapper">
        <InputNumber v-model="model.capacity" :min="1" :max="32" class="w-full" />
      </div>
      <small v-if="getError('capacity')" class="error-text">{{ getError('capacity') }}</small>
      <small class="helper-text">Fixed instance count (1-32)</small>
    </div>

    <div class="autoscaling-section">
      <div class="section-header">Autoscaling (Optional)</div>
      <div class="field"><label>Min Instances</label>
        <div :class="{ 'has-error': getError('minInstances') }" class="input-wrapper">
          <InputNumber v-model="model.minInstances" :min="1" :max="125" class="w-full" />
        </div>
        <small v-if="getError('minInstances')" class="error-text">{{ getError('minInstances') }}</small>
      </div>

      <div class="field"><label>Max Instances</label>
        <div :class="{ 'has-error': getError('maxInstances') }" class="input-wrapper">
          <InputNumber v-model="model.maxInstances" :min="1" :max="125" class="w-full" />
        </div>
        <small v-if="getError('maxInstances')" class="error-text">{{ getError('maxInstances') }}</small>
        <small class="helper-text">Autoscale up to 125 instances based on traffic</small>
      </div>
    </div>

    <div class="field"><label>Idle Timeout (Minutes)</label>
      <div :class="{ 'has-error': getError('idleTimeoutInMinutes') }" class="input-wrapper">
        <InputNumber v-model="model.idleTimeoutInMinutes" :min="4" :max="30" class="w-full" />
      </div>
      <small v-if="getError('idleTimeoutInMinutes')" class="error-text">{{ getError('idleTimeoutInMinutes') }}</small>
      <small class="helper-text">Connection timeout: 4-30 minutes (default 4)</small>
    </div>

    <div class="field"><label>Availability Zones</label>
      <div :class="{ 'has-error': getError('availabilityZones') }" class="input-wrapper">
        <InputText v-model="availabilityZonesStr" class="w-full" placeholder="e.g., 1,2,3" />
      </div>
      <small v-if="getError('availabilityZones')" class="error-text">{{ getError('availabilityZones') }}</small>
      <small v-if="getWarning('availabilityZones')" class="warning-text">⚠️ {{ getWarning('availabilityZones') }}</small>
      <small class="helper-text">Comma-separated zone IDs (1, 2, 3) for zone redundancy</small>
    </div>

    <div class="field checkbox-field"><label>Enable HTTP/2</label><ToggleSwitch v-model="model.enableHttp2" /></div>
    
    <div class="field checkbox-field"><label>Enable WAF</label><ToggleSwitch v-model="model.enableWaf" /></div>
    
    <div class="field" v-if="model.enableWaf"><label>WAF Mode</label><SelectButton v-model="model.wafMode" :options="['Detection','Prevention']" /></div>

    <div class="field checkbox-field"><label>Enable Mutual Authentication (mTLS)</label><ToggleSwitch v-model="model.enableMutualAuthentication" /></div>

    <div class="field"><label>Subnet *</label>
      <div :class="{ 'has-error': getError('subnetId') }" class="input-wrapper">
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
      </div>
      <small v-if="getError('subnetId')" class="error-text">{{ getError('subnetId') }}</small>
      <small v-if="getWarning('subnetId')" class="warning-text">⚠️ {{ getWarning('subnetId') }}</small>
    </div>

    <div class="field" v-if="model.frontendType === 'Public'">
      <label>Frontend Public IP *</label>
      <div :class="{ 'has-error': getError('frontendIpId') }" class="input-wrapper">
        <Select v-model="model.frontendIpId" :options="ipOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Public IP" />
      </div>
      <small v-if="getError('frontendIpId')" class="error-text">{{ getError('frontendIpId') }}</small>
      <small v-if="getWarning('frontendIpId')" class="warning-text">⚠️ {{ getWarning('frontendIpId') }}</small>
      <small class="helper-text">Must be Standard SKU with Static allocation</small>
    </div>

    <div class="field"><label>Key Vault Certificate ID</label>
      <div :class="{ 'has-error': getError('keyVaultCertificateId') }" class="input-wrapper">
        <Select v-model="model.keyVaultCertificateId" :options="keyVaultOptions" option-label="label" option-value="value" class="w-full" placeholder="Select Key Vault" showClear />
      </div>
      <small v-if="getWarning('keyVaultCertificateId')" class="warning-text">⚠️ {{ getWarning('keyVaultCertificateId') }}</small>
      <small class="helper-text">Recommended for TLS certificate storage and auto-rotation</small>
    </div>

    <div class="backend-section">
      <div class="backend-header">
        <span class="backend-title">Backend Pool Members</span>
        <small class="backend-caption">Select NICs or compute nodes for the backend pool</small>
      </div>
      <div v-if="backendOptions.length === 0" class="helper-text">No backend-eligible components in the diagram yet.</div>
      <div v-else class="checkbox-list">
        <div v-for="option in backendOptions" :key="option.value" class="checkbox-row">
          <Checkbox v-model="selectedBackendIds" :input-id="option.inputId" :value="option.value" />
          <label :for="option.inputId">{{ option.label }}</label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AppGatewayComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getValidator } from '~/lib/componentValidators'
import type { FieldError } from '~/types/validation'

const props = defineProps<{ modelValue: Partial<AppGatewayComponent>; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue as AppGatewayComponent,
  set: v => emit('update:modelValue', v),
})

// Availability Zones: parse/serialize comma-separated string
const availabilityZonesStr = computed({
  get: () => {
    const zones = model.value.availabilityZones
    return Array.isArray(zones) ? zones.join(',') : ''
  },
  set: (str: string) => {
    const zones = str
      .split(',')
      .map(z => z.trim())
      .filter(z => z.length > 0)
    model.value = { ...model.value, availabilityZones: zones }
  },
})

const subnetOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.SUBNET)
    .map(n => ({ label: n.data.name, value: n.id }))
)

const ipOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.IP_ADDRESS)
    .map(n => ({ label: n.data.name, value: n.id }))
)

const keyVaultOptions = computed(() =>
  (props.nodes || [])
    .filter(n => n.data?.type === NetworkComponentType.KEY_VAULT)
    .map(n => ({ label: n.data.name, value: n.id }))
)

const BACKEND_TYPES = [
  NetworkComponentType.NETWORK_IC,
  NetworkComponentType.VM,
  NetworkComponentType.VMSS,
  NetworkComponentType.AKS,
  NetworkComponentType.APP_SERVICE,
  NetworkComponentType.FUNCTIONS,
]

const backendOptions = computed(() =>
  (props.nodes || [])
    .filter(n => BACKEND_TYPES.includes(n.data?.type))
    .map(n => ({ label: n.data.name, value: n.id, inputId: `agw-backend-${n.id}` }))
)

const selectedBackendIds = computed({
  get: () => (Array.isArray(model.value.backendPools) ? (model.value.backendPools as string[]) : []),
  set: (ids: string[]) => {
    model.value = { ...model.value, backendPools: ids }
  },
})

const validationErrors = computed(() => {
  const validator = getValidator(model.value.type!)
  if (!validator) return []
  return validator(model.value, props.nodes || []).errors
})

function getError(fieldName: string): string | undefined {
  const error = validationErrors.value.find(
    (e: FieldError) => e.fieldName === fieldName && e.severity === 'error'
  )
  return error?.message
}

function getWarning(fieldName: string): string | undefined {
  const warning = validationErrors.value.find(
    (e: FieldError) => e.fieldName === fieldName && e.severity === 'warning'
  )
  return warning?.message
}
</script>

<style scoped>
.component-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.checkbox-field {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.section-header {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  margin-top: 0.45rem;
  margin-bottom: 0.45rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--border);
}

.autoscaling-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.55rem 0;
}

.backend-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.backend-header {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.backend-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.backend-caption,
.helper-text {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.error-text {
  font-size: 0.72rem;
  color: var(--red-600);
}

.warning-text {
  font-size: 0.72rem;
  color: var(--orange-600);
}

.checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-alt);
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--text);
}

.input-wrapper {
  position: relative;
}

.input-wrapper.has-error :deep(input),
.input-wrapper.has-error :deep(.p-select),
.input-wrapper.has-error :deep(.p-select-trigger),
.input-wrapper.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}
</style>
