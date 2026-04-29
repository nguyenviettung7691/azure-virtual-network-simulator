<template>
  <div
    class="network-ic-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <div class="generic-node-content" :style="{ borderColor: '#005a9e' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#005a9e20' }">
        <Icon icon="mdi:ethernet" :style="{ color: '#005a9e' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Network Interface</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.privateIpAddress || data.privateIpAllocationMethod }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { NetworkICComponent } from '~/types/network'

interface Props {
  id: string
  data: NetworkICComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
