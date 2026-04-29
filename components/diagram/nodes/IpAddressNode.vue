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
    <div class="generic-node-content" :style="{ borderColor: '#0099bc' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#0099bc20' }">
        <Icon icon="mdi:ip-network" :style="{ color: '#0099bc' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Public IP Address</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.ipAddress || data.allocationMethod }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { IpAddressComponent } from '~/types/network'

interface Props {
  id: string
  data: IpAddressComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>

<style scoped>
/* Styles provided globally via assets/css/diagram.css */
</style>
