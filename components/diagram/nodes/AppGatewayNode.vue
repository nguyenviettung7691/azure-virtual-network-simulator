<template>
  <div
    class="app-gateway-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <div class="generic-node-content" :style="{ borderColor: '#0063b1' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#0063b120' }">
        <Icon icon="mdi:application" :style="{ color: '#0063b1' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Application Gateway</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.sku }} Cap: {{ data.capacity }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { AppGatewayComponent } from '~/types/network'

interface Props {
  id: string
  data: AppGatewayComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
