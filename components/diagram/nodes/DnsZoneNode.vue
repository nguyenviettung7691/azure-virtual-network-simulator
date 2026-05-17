<template>
  <div
    class="dns-zone-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: '#038387' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#03838720' }">
        <Icon :name="nodeIcon" mode="svg" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">DNS Zone</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.zoneName }} ({{ data.zoneType }})</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { DnsZoneComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { getAzureComponentIcon } from '~/lib/azureIcons'

interface Props {
  id: string
  data: DnsZoneComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()
const nodeIcon = getAzureComponentIcon(NetworkComponentType.DNS_ZONE)

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
