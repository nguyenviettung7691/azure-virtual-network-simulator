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
        <Icon :name="nodeIcon" mode="svg" class="generic-icon" />
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
import type { UdrComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getAzureComponentIcon } from '~/lib/azureIcons'

interface Props {
  id: string
  data: UdrComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()
const nodeIcon = getAzureComponentIcon(NetworkComponentType.UDR)

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
