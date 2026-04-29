<template>
  <div class="diagram-canvas-wrapper" ref="canvasWrapper">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
      :min-zoom="0.1"
      :max-zoom="4"
      :snap-to-grid="snapToGrid"
      :snap-grid="[20, 20]"
      fit-view-on-init
      class="vnet-flow"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      @pane-click="onPaneClick"
      @node-double-click="onNodeDblClick"
      @connect="onConnect"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @viewport-change="onViewportChange"
    >
      <Background :variant="BackgroundVariant.Dots" :gap="20" :size="1" />
      <Controls />
      <MiniMap
        :node-stroke-color="getNodeStrokeColor"
        :node-color="getNodeColor"
        :node-border-radius="4"
        mask-color="rgba(0,0,0,0.1)"
      />

      <!-- Empty state -->
      <div v-if="nodes.length === 0" class="canvas-empty-state">
        <Icon icon="mdi:draw" class="empty-icon" />
        <p class="empty-title">Start building your Azure network</p>
        <p class="empty-subtitle">Click component icons in the toolbar above to add components</p>
        <div class="empty-quick-start">
          <Button
            label="Add VNet"
            icon="mdi:network"
            size="small"
            @click="diagramStore.openAddComponentModal(NetworkComponentType.VNET)"
          />
          <Button
            label="Add Subnet"
            icon="mdi:lan"
            size="small"
            severity="secondary"
            @click="diagramStore.openAddComponentModal(NetworkComponentType.SUBNET)"
          />
        </div>
      </div>
    </VueFlow>

    <!-- Canvas toolbar overlay -->
    <div class="canvas-toolbar">
      <Button
        icon="mdi:auto-fix"
        v-tooltip.bottom="'Auto Layout'"
        size="small"
        severity="secondary"
        @click="onAutoLayout"
      />
      <Button
        icon="mdi:grid"
        v-tooltip.bottom="snapToGrid ? 'Disable snap' : 'Snap to grid'"
        size="small"
        :severity="snapToGrid ? 'primary' : 'secondary'"
        @click="snapToGrid = !snapToGrid"
      />
      <Button
        icon="mdi:fit-to-page"
        v-tooltip.bottom="'Fit view'"
        size="small"
        severity="secondary"
        @click="fitView()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { Icon } from '@iconify/vue'
import { Button } from 'primevue'
import { NetworkComponentType, getComponentColor } from '~/types/network'
import type { NodeTypesObject, EdgeTypesObject } from '@vue-flow/core'

import VNetNode from './nodes/VNetNode.vue'
import SubnetNode from './nodes/SubnetNode.vue'
import NsgNode from './nodes/NsgNode.vue'
import AsgNode from './nodes/AsgNode.vue'
import IpAddressNode from './nodes/IpAddressNode.vue'
import DnsZoneNode from './nodes/DnsZoneNode.vue'
import VpnGatewayNode from './nodes/VpnGatewayNode.vue'
import AppGatewayNode from './nodes/AppGatewayNode.vue'
import NvaNode from './nodes/NvaNode.vue'
import LoadBalancerNode from './nodes/LoadBalancerNode.vue'
import UdrNode from './nodes/UdrNode.vue'
import VnetPeeringNode from './nodes/VnetPeeringNode.vue'
import ComputeNode from './nodes/ComputeNode.vue'
import StorageNode from './nodes/StorageNode.vue'
import IdentityNode from './nodes/IdentityNode.vue'
import NetworkICNode from './nodes/NetworkICNode.vue'
import NetworkEdge from './edges/NetworkEdge.vue'

const diagramStore = useDiagramStore()
const { fitView } = useVueFlow()

const canvasWrapper = ref<HTMLElement | null>(null)
const snapToGrid = ref(false)

import type { DiagramEdge } from '~/types/diagram'

const nodes = computed({
  get: () => diagramStore.nodes,
  set: (val) => { diagramStore.nodes = val as any },
})

const edges = computed({
  get: () => diagramStore.edges as any[],
  set: (val) => { diagramStore.edges = val as any },
})

const nodeTypes: NodeTypesObject = {
  'vnet-node': VNetNode as any,
  'subnet-node': SubnetNode as any,
  'nsg-node': NsgNode as any,
  'asg-node': AsgNode as any,
  'ip-address-node': IpAddressNode as any,
  'dns-zone-node': DnsZoneNode as any,
  'vpn-gateway-node': VpnGatewayNode as any,
  'app-gateway-node': AppGatewayNode as any,
  'nva-node': NvaNode as any,
  'load-balancer-node': LoadBalancerNode as any,
  'udr-node': UdrNode as any,
  'vnet-peering-node': VnetPeeringNode as any,
  'compute-node': ComputeNode as any,
  'storage-node': StorageNode as any,
  'identity-node': IdentityNode as any,
  'network-ic-node': NetworkICNode as any,
}

const edgeTypes: EdgeTypesObject = {
  'network-edge': NetworkEdge as any,
}

function onNodeClick({ node }: any) {
  diagramStore.setSelectedNode(node.id)
}

function onNodeDblClick({ node }: any) {
  diagramStore.openEditComponentModal(node.data)
}

function onEdgeClick(_payload: any) {
  // Reserved for future edge property panel
}

function onPaneClick() {
  diagramStore.setSelectedNode(null)
}

function onConnect(params: any) {
  const edgeId = `edge-${params.source}-${params.target}-${Date.now()}`
  diagramStore.addEdge({
    id: edgeId,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    type: 'network-edge',
    label: '',
    data: { color: '#0078d4' },
  } as DiagramEdge)
}

function onNodesChange(_changes: any[]) {
  // Position/selection changes handled by Vue Flow internally
}

function onEdgesChange(_changes: any[]) {
  // Edge changes handled by Vue Flow internally
}

function onViewportChange(viewport: any) {
  diagramStore.setViewport(viewport)
}

function onAutoLayout() {
  diagramStore.autoLayout()
}

function getNodeColor(node: any): string {
  return (getComponentColor(node.data?.type) || '#0078d4') + '40'
}

function getNodeStrokeColor(node: any): string {
  return getComponentColor(node.data?.type) || '#0078d4'
}
</script>
