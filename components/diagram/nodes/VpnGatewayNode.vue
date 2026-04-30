<template>
  <div
    class="vpn-gateway-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <div class="generic-node-content" :style="{ borderColor: '#004578' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#00457820' }">
        <Icon icon="mdi:vpn" :style="{ color: '#004578' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">VPN Gateway</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ data.sku }} - {{ data.vpnType }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { VpnGatewayComponent } from '~/types/network'

interface Props {
  id: string
  data: VpnGatewayComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
