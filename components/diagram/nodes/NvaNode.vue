<template>
  <div
    class="nva-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: '#6b4226' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#6b422620' }">
        <Icon icon="mdi:router-network" :style="{ color: '#6b4226' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Network Virtual Appliance</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.offer || 'NVA' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { NvaComponent } from '~/types/network'

interface Props {
  id: string
  data: NvaComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
