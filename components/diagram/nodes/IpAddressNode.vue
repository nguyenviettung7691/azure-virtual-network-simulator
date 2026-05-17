<template>
  <div
    class="ip-address-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: '#0099bc' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#0099bc20' }">
        <Icon :name="nodeIcon" mode="svg" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Public IP</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ skuLabel }}{{ globalLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { IpAddressComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getAzureComponentIcon } from '~/lib/azureIcons'

interface Props {
  id: string
  data: IpAddressComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()
const nodeIcon = getAzureComponentIcon(NetworkComponentType.IP_ADDRESS)

const skuLabel = computed(() => {
  const sku = props.data.sku || 'Standard'
  const alloc = props.data.allocationMethod || 'Dynamic'
  return `${sku} (${alloc})`
})

const globalLabel = computed(() => {
  return props.data.tier === 'Global' ? ' - Global' : ''
})

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>

<style scoped>
/* Styles provided globally via assets/css/diagram.css */
</style>
