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
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: '#0063b1' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#0063b120' }">
        <Icon :name="nodeIcon" mode="svg" class="generic-icon" />
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
import type { AppGatewayComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getAzureComponentIcon } from '~/lib/azureIcons'

interface Props {
  id: string
  data: AppGatewayComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()
const nodeIcon = getAzureComponentIcon(NetworkComponentType.APP_GATEWAY)

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
