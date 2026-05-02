<template>
  <div
    class="udr-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: '#8764b8' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#8764b820' }">
        <Icon icon="mdi:routes" :style="{ color: '#8764b8' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Route Table (UDR)</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.routes?.length || 0 }} routes</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { UdrComponent } from '~/types/network'

interface Props {
  id: string
  data: UdrComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
