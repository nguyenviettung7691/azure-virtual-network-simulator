<template>
  <div
    class="vnet-node diagram-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />

    <div class="node-header vnet-header">
      <Icon icon="mdi:network" class="node-icon" />
      <div class="node-title-group">
        <span class="node-label">Virtual Network</span>
        <span class="node-name">{{ data.name }}</span>
      </div>
      <div class="node-header-meta">
        <span class="node-region">{{ data.region }}</span>
        <div class="node-header-info">
          <div class="node-property" v-if="data.addressSpace?.length">
            <span class="prop-label">Address Space:</span>
            <span class="prop-value">{{ data.addressSpace.join(', ') }}</span>
          </div>
          <div class="node-property" v-if="data.dnsServers?.length">
            <span class="prop-label">DNS:</span>
            <span class="prop-value">{{ data.dnsServers.join(', ') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="node-body vnet-body">
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
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>

<style scoped>
.vnet-node {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
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
  background: linear-gradient(135deg, rgba(0, 120, 212, 0.9) 0%, rgba(0, 120, 212, 0.82) 100%);
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid rgba(0, 120, 212, 0.34);
}

.node-header-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  margin-left: auto;
  min-width: 0;
}

.node-header-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
}

.node-icon {
  width: 20px;
  height: 20px;
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
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-region {
  font-size: 10px;
  font-weight: 700;
  color: #032742;
  background-color: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(0, 90, 158, 0.45);
  padding: 2px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

:global(.dark-mode) .vnet-header {
  background: linear-gradient(135deg, rgba(96, 205, 255, 0.9) 0%, rgba(96, 205, 255, 0.82) 100%);
  border-bottom-color: rgba(159, 230, 255, 0.42);
}

:global(.dark-mode) .node-icon,
:global(.dark-mode) .node-name {
  color: #05314a;
}

:global(.dark-mode) .node-label {
  color: #f3fbff;
  opacity: 0.9;
}

:global(.dark-mode) .node-region {
  color: #f8fcff;
  background-color: rgba(8, 40, 63, 0.72);
  border-color: rgba(159, 230, 255, 0.56);
}

.vnet-body {
  padding: 10px 14px;
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

.vnet-content-area {
  min-height: 60px;
  margin-top: 8px;
}
</style>
