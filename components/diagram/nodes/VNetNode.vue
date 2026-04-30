<template>
  <div
    class="vnet-node diagram-node"
    :class="{ selected }"
    :style="{ width: `${nodeWidth}px`, height: `${nodeHeight}px` }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />

    <div class="node-header vnet-header">
      <Icon icon="mdi:network" class="node-icon" />
      <div class="node-title-group">
        <span class="node-label">Virtual Network</span>
        <span class="node-name">{{ data.name }}</span>
      </div>
      <span class="node-region">{{ data.region }}</span>
    </div>

    <div class="node-body vnet-body">
      <div class="node-property" v-if="data.addressSpace?.length">
        <span class="prop-label">Address Space:</span>
        <span class="prop-value">{{ data.addressSpace.join(', ') }}</span>
      </div>
      <div class="node-property" v-if="data.dnsServers?.length">
        <span class="prop-label">DNS:</span>
        <span class="prop-value">{{ data.dnsServers.join(', ') }}</span>
      </div>
      <div class="vnet-content-area">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { VNetComponent } from '~/types/network'

interface Props {
  id: string
  data: VNetComponent
  selected?: boolean
  /** Node width passed by Vue Flow (set in diagram store) */
  width?: number
  /** Node height passed by Vue Flow (set in diagram store) */
  height?: number
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

const nodeWidth = computed(() => props.width || 400)
const nodeHeight = computed(() => props.height || 300)

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>

<style scoped>
.vnet-node {
  background-color: rgba(0, 120, 212, 0.05);
  border: 2px solid #0078d4;
  border-radius: 8px;
  padding: 0;
  cursor: grab;
  transition: box-shadow 200ms ease, border-color 200ms ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.vnet-node.selected {
  box-shadow: 0 0 0 3px #50a7f0, 0 4px 16px rgba(0, 120, 212, 0.25);
}

.vnet-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background-color: rgba(0, 120, 212, 0.1);
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid rgba(0, 120, 212, 0.2);
}

.node-icon {
  width: 20px;
  height: 20px;
  color: #0078d4;
  flex-shrink: 0;
}

.node-title-group {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.node-label {
  font-size: 10px;
  color: #605e5c;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.node-name {
  font-size: 13px;
  font-weight: 600;
  color: #0078d4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-region {
  font-size: 10px;
  color: #605e5c;
  background-color: rgba(0, 120, 212, 0.1);
  padding: 2px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

.vnet-body {
  padding: 10px 14px;
}

.node-property {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}

.prop-label {
  color: #605e5c;
  flex-shrink: 0;
}

.prop-value {
  color: #323130;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnet-content-area {
  min-height: 60px;
  margin-top: 8px;
}
</style>
