<template>
  <div
    class="subnet-node diagram-node"
    :class="{ selected }"
    :style="{ width: `${width || 300}px`, height: `${height || 200}px` }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />

    <div class="node-header subnet-header">
      <Icon icon="mdi:lan" class="node-icon" />
      <div class="node-title-group">
        <span class="node-label">Subnet</span>
        <span class="node-name">{{ data.name }}</span>
      </div>
    </div>

    <div class="node-body">
      <div class="node-property" v-if="data.addressPrefix">
        <span class="prop-label">CIDR:</span>
        <span class="prop-value">{{ data.addressPrefix }}</span>
      </div>
      <div class="node-property" v-if="data.nsgId">
        <span class="prop-label">NSG:</span>
        <span class="prop-value nsg-badge">Protected</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { SubnetComponent } from '~/types/network'

interface Props {
  id: string
  data: SubnetComponent
  selected?: boolean
  width?: number
  height?: number
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>

<style scoped>
.subnet-node {
  background-color: rgba(80, 167, 240, 0.04);
  border: 2px dashed #50a7f0;
  border-radius: 8px;
  padding: 0;
  cursor: grab;
  transition: box-shadow 200ms ease, border-color 200ms ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.subnet-node.selected {
  box-shadow: 0 0 0 3px #50a7f0, 0 4px 12px rgba(80, 167, 240, 0.2);
  border-color: #0078d4;
}

.subnet-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: rgba(80, 167, 240, 0.08);
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid rgba(80, 167, 240, 0.2);
}

.node-icon {
  width: 18px;
  height: 18px;
  color: #50a7f0;
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
  font-size: 12px;
  font-weight: 600;
  color: #005a9e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-body {
  padding: 8px 12px;
}

.node-property {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 11px;
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

.nsg-badge {
  background-color: rgba(209, 52, 56, 0.1);
  color: #d13438;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}
</style>
