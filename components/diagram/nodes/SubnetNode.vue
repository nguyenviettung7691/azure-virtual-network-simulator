<template>
  <div
    class="subnet-node diagram-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />

    <div class="node-header subnet-header">
      <Icon icon="mdi:lan" class="node-icon" />
      <div class="node-title-group">
        <span class="node-label">Subnet</span>
        <span class="node-name">{{ data.name }}</span>
      </div>
      <div class="node-header-info">
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
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>

<style scoped>
.subnet-node {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
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
  background: linear-gradient(135deg, rgba(80, 167, 240, 0.9) 0%, rgba(80, 167, 240, 0.82) 100%);
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid rgba(80, 167, 240, 0.36);
}

.node-header-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  margin-left: auto;
  min-width: 0;
}

.node-icon {
  width: 18px;
  height: 18px;
  color: rgba(255, 255, 255, 0.98);
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
  color: var(--text, #323130);
  opacity: 0.85;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.node-name {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.dark-mode) .subnet-header {
  background: linear-gradient(135deg, rgba(96, 205, 255, 0.9) 0%, rgba(96, 205, 255, 0.82) 100%);
  border-bottom-color: rgba(159, 230, 255, 0.4);
}

:global(.dark-mode) .subnet-node {
  --subnet-accent: #60cdff;
}

:global(.dark-mode) .node-icon,
:global(.dark-mode) .node-name {
  color: #05314a;
}

:global(.dark-mode) .node-label {
  color: #f3fbff;
  opacity: 0.9;
}

.node-property {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 0;
  font-size: 10px;
  min-width: 0;
}

.prop-label {
  color: rgba(255, 255, 255, 0.92);
  flex-shrink: 0;
}

.prop-value {
  color: rgba(255, 255, 255, 0.98);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.nsg-badge {
  background-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.98);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}
</style>
