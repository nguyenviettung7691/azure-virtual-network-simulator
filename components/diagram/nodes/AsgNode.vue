<template>
  <div
    class="asg-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <div class="generic-node-content" :style="{ borderColor: '#b4009e' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#b4009e20' }">
        <Icon icon="mdi:account-group" :style="{ color: '#b4009e' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">App Security Group</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ (data.nicIds?.length || 0) }} NICs</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { AsgComponent } from '~/types/network'

interface Props {
  id: string
  data: AsgComponent
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
