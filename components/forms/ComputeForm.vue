<template>
  <div class="component-form">
    <div class="field"><label>Name *</label><InputText v-model="model.name" class="w-full" placeholder="my-vm" /></div>
    <div class="field"><label>Type</label>
      <Select v-model="model.type" :options="computeTypes" option-label="label" option-value="value" class="w-full" />
    </div>
    <div class="field"><label>VM Size / SKU</label><InputText v-model="model.size" class="w-full" placeholder="Standard_D2s_v3" /></div>
    <div class="field"><label>OS</label><SelectButton v-model="model.os" :options="['Windows','Linux']" /></div>
    <div class="field"><label>Image Publisher</label><InputText v-model="model.imagePublisher" class="w-full" placeholder="Canonical" /></div>
    <div class="field"><label>Image Offer</label><InputText v-model="model.imageOffer" class="w-full" placeholder="UbuntuServer" /></div>
    <div class="field"><label>Image SKU</label><InputText v-model="model.imageSku" class="w-full" placeholder="18.04-LTS" /></div>
    <div class="field"><label>Subnet</label>
      <Select v-model="model.subnetId" :options="subnetOptions" option-label="label" option-value="value" class="w-full" placeholder="Select subnet" />
    </div>
    <div class="field"><label>Availability Zone</label>
      <Select v-model="model.availabilityZone" :options="['1','2','3','No zone']" class="w-full" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'
const props = defineProps<{ modelValue: any; nodes: any[] }>()
const emit = defineEmits(['update:modelValue'])
const model = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const subnetOptions = computed(() => (props.nodes || []).filter(n => n.data?.type === NetworkComponentType.SUBNET).map(n => ({ label: n.data.name, value: n.id })))
const computeTypes = [
  { label: 'Virtual Machine', value: NetworkComponentType.VM },
  { label: 'VM Scale Set', value: NetworkComponentType.VMSS },
  { label: 'AKS Cluster', value: NetworkComponentType.AKS },
  { label: 'App Service', value: NetworkComponentType.APP_SERVICE },
  { label: 'Azure Functions', value: NetworkComponentType.FUNCTIONS },
]
</script>
<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
</style>
