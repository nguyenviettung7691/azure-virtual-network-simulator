<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-vm" /></div>
    <div class="field"><label>Type</label>
      <Select v-model="model.type" :options="computeTypes" option-label="label" option-value="value" class="w-full" />
    </div>

    <!-- VM fields -->
    <template v-if="isVM">
      <div class="field"><label>VM Size</label><InputText v-model="model.size" class="w-full" placeholder="Standard_D2s_v3" /></div>
      <div class="field"><label>OS</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
      <div class="field"><label>Image Publisher</label><InputText v-model="model.imagePublisher" class="w-full" placeholder="Canonical" /></div>
      <div class="field"><label>Image Offer</label><InputText v-model="model.imageOffer" class="w-full" placeholder="UbuntuServer" /></div>
      <div class="field"><label>Image SKU</label><InputText v-model="model.imageSku" class="w-full" placeholder="18.04-LTS" /></div>
      <div class="field"><label>Disk Type</label>
        <Select v-model="model.diskType" :options="['Standard_LRS','StandardSSD_LRS','Premium_LRS']" class="w-full" />
      </div>
      <div class="field"><label>Subnet</label>
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
      </div>
      <div class="field"><label>Availability Zone</label>
        <Select v-model="model.availabilityZone" :options="['1','2','3','No zone']" class="w-full" />
      </div>
    </template>

    <!-- VMSS fields -->
    <template v-if="isVMSS">
      <div class="field"><label>SKU (VM Size)</label><InputText v-model="model.sku" class="w-full" placeholder="Standard_D2s_v3" /></div>
      <div class="field"><label>OS</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
      <div class="field"><label>Image Publisher</label><InputText v-model="model.imagePublisher" class="w-full" placeholder="Canonical" /></div>
      <div class="field"><label>Image Offer</label><InputText v-model="model.imageOffer" class="w-full" placeholder="UbuntuServer" /></div>
      <div class="field"><label>Image SKU</label><InputText v-model="model.imageSku" class="w-full" placeholder="18.04-LTS" /></div>
      <div class="field"><label>Initial Capacity</label><InputNumber v-model="model.capacity" :min="1" :max="1000" class="w-full" /></div>
      <div class="field"><label>Upgrade Policy</label>
        <Select v-model="model.upgradePolicy" :options="['Automatic','Manual','Rolling']" class="w-full" />
      </div>
      <div class="field checkbox-field"><label>Autoscale Enabled</label><ToggleSwitch v-model="model.autoscaleEnabled" /></div>
      <template v-if="model.autoscaleEnabled">
        <div class="field"><label>Min Capacity</label><InputNumber v-model="model.minCapacity" :min="1" :max="1000" class="w-full" /></div>
        <div class="field"><label>Max Capacity</label><InputNumber v-model="model.maxCapacity" :min="1" :max="1000" class="w-full" /></div>
      </template>
      <div class="field"><label>Subnet</label>
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
      </div>
    </template>

    <!-- AKS fields -->
    <template v-if="isAKS">
      <div class="field"><label>Kubernetes Version</label><InputText v-model="model.kubernetesVersion" class="w-full" placeholder="1.29.0" /></div>
      <div class="field"><label>Node Count</label><InputNumber v-model="model.nodeCount" :min="1" :max="1000" class="w-full" /></div>
      <div class="field"><label>Node VM Size</label><InputText v-model="model.nodeVmSize" class="w-full" placeholder="Standard_D4s_v3" /></div>
      <div class="field"><label>Network Plugin</label>
        <Select v-model="model.networkPlugin" :options="['azure','kubenet','none']" class="w-full" />
      </div>
      <div class="field"><label>API Server Access</label><SelectButton v-model="model.apiServerAccess" :options="['Public','Private']" /></div>
      <div class="field checkbox-field"><label>Enable RBAC</label><ToggleSwitch v-model="model.enableRbac" /></div>
      <div class="field checkbox-field"><label>Private Cluster</label><ToggleSwitch v-model="model.enablePrivateCluster" /></div>
      <div class="field"><label>Subnet</label>
        <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
      </div>
    </template>

    <!-- App Service fields -->
    <template v-if="isAppService">
      <div class="field"><label>SKU</label><InputText v-model="model.sku" class="w-full" placeholder="P1v3" /></div>
      <div class="field"><label>Tier</label>
        <Select v-model="model.tier" :options="['Free','Shared','Basic','Standard','Premium','Isolated']" class="w-full" />
      </div>
      <div class="field"><label>OS</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
      <div class="field"><label>Runtime Stack</label><InputText v-model="model.runtimeStack" class="w-full" placeholder="DOTNET|8.0, NODE|20-lts" /></div>
      <div class="field"><label>VNet Integration Subnet</label>
        <Select v-model="model.vnetIntegrationSubnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="None (public)" showClear />
      </div>
      <div class="field"><label>Custom Domain</label><InputText v-model="model.customDomain" class="w-full" placeholder="myapp.example.com" /></div>
      <div class="field checkbox-field"><label>HTTPS Only</label><ToggleSwitch v-model="model.enableHttps" /></div>
    </template>

    <!-- Functions fields -->
    <template v-if="isFunctions">
      <div class="field"><label>Runtime Stack</label>
        <Select v-model="model.runtimeStack" :options="['dotnet','node','python','java','powershell']" class="w-full" />
      </div>
      <div class="field"><label>Runtime Version</label><InputText v-model="model.runtimeVersion" class="w-full" placeholder="8.0 / 20 / 3.11" /></div>
      <div class="field"><label>Hosting Plan SKU</label><InputText v-model="model.hostingPlanSku" class="w-full" placeholder="Y1 (Consumption) or EP1" /></div>
      <div class="field"><label>VNet Integration Subnet</label>
        <Select v-model="model.vnetIntegrationSubnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="None (public)" showClear />
      </div>
      <div class="field"><label>Storage Account</label>
        <Select v-model="model.storageAccountId" :options="storageOptions" option-label="label" option-value="value" class="w-full" placeholder="Select storage account" showClear />
      </div>
      <div class="field checkbox-field"><label>Enable Private Endpoint</label><ToggleSwitch v-model="model.enablePrivateEndpoint" /></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
const storageOptions = computed(() => (props.nodes || []).filter(n => [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE].includes(n.data?.type)).map(n => ({ label: n.data.name, value: n.id })))
const computeTypes = [
  { label: 'Virtual Machine', value: NetworkComponentType.VM },
  { label: 'VM Scale Set', value: NetworkComponentType.VMSS },
  { label: 'AKS Cluster', value: NetworkComponentType.AKS },
  { label: 'App Service', value: NetworkComponentType.APP_SERVICE },
  { label: 'Azure Functions', value: NetworkComponentType.FUNCTIONS },
]
const isVM = computed(() => model.value.type === NetworkComponentType.VM)
const isVMSS = computed(() => model.value.type === NetworkComponentType.VMSS)
const isAKS = computed(() => model.value.type === NetworkComponentType.AKS)
const isAppService = computed(() => model.value.type === NetworkComponentType.APP_SERVICE)
const isFunctions = computed(() => model.value.type === NetworkComponentType.FUNCTIONS)
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.checkbox-field { flex-direction: row; align-items: center; justify-content: space-between; }
</style>
