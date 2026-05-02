<template>
  <div
    class="load-balancer-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: '#0078d4' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#0078d420' }">
        <Icon icon="mdi:scale-balance" :style="{ color: '#0078d4' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Load Balancer</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.sku }} - {{ data.loadBalancerType || 'Public' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { LoadBalancerComponent } from '~/types/network'

interface Props {
  id: string
  data: LoadBalancerComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
