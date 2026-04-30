<template>
    <div class="diagram-canvas-wrapper" :class="{ 'is-interactive': isInteractive }" ref="canvasWrapper">
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
      <Controls>
        <template #control-zoom-in>
          <ControlButton v-tooltip.right="'Zoom In'" @click="zoomIn()">
            <Icon icon="mdi:magnify-plus-outline" style="width:22px;height:22px" />
          </ControlButton>
        </template>
        <template #control-zoom-out>
          <ControlButton v-tooltip.right="'Zoom Out'" @click="zoomOut()">
            <Icon icon="mdi:magnify-minus-outline" style="width:22px;height:22px" />
          </ControlButton>
        </template>
        <template #control-fit-view>
          <ControlButton v-tooltip.right="'Fit Content'" @click="fitView()">
            <Icon icon="mdi:fit-to-page-outline" style="width:22px;height:22px" />
          </ControlButton>
        </template>
        <template #control-interactive>
          <ControlButton
            v-tooltip.right="isInteractive ? 'Lock Interactions' : 'Unlock Interactions'"
            :class="{ 'control-locked': !isInteractive }"
            @click="setInteractive(!isInteractive)"
          >
            <Icon :icon="isInteractive ? 'mdi:lock-open-outline' : 'mdi:lock-outline'" style="width:22px;height:22px" />
          </ControlButton>
        </template>
      </Controls>
      <MiniMap
        :node-stroke-color="getNodeStrokeColor"
        :node-color="getNodeColor"
        :node-border-radius="4"
        mask-color="rgba(0,0,0,0.1)"
        :width="280"
        :height="210"
      />
    </VueFlow>

    <!-- Empty state — lives outside VueFlow so it never inherits the pane grab cursor -->
    <div v-if="nodes.length === 0" class="canvas-empty-state">
      <Icon icon="mdi:draw" class="empty-icon" />
      <p class="empty-title">Start building your Azure network</p>
      <p class="empty-subtitle">Click component icons in the toolbar above to add components</p>
      <div class="empty-quick-start">
        <Button
          label="Add VNet"
          @click="diagramStore.openAddComponentModal(NetworkComponentType.VNET)"
        >
          <template #icon>
            <Icon icon="mdi:network" class="p-button-icon p-button-icon-left" />
          </template>
        </Button>
        <Button
          label="Load sample"
          severity="secondary"
          @click="loadSampleDiagram()"
        >
          <template #icon>
            <Icon icon="mdi:lightning-bolt" class="p-button-icon p-button-icon-left" />
          </template>
        </Button>
      </div>
    </div>

    <!-- Canvas toolbar overlay -->
    <div class="canvas-toolbar">
      <Button
        v-tooltip.bottom="'Auto Layout'"
        severity="secondary"
        @click="onAutoLayout"
      >
        <template #icon>
          <Icon icon="mdi:auto-fix" style="width:20px;height:20px" />
        </template>
      </Button>
      <Button
        v-tooltip.bottom="snapToGrid ? 'Disable snap' : 'Snap to grid'"
        :severity="snapToGrid ? 'primary' : 'secondary'"
        @click="snapToGrid = !snapToGrid"
      >
        <template #icon>
          <Icon icon="mdi:grid" style="width:20px;height:20px" />
        </template>
      </Button>
      <Button
        v-tooltip.bottom="'Fit View (reset to 1:1)'"
        severity="secondary"
        @click="setViewport({ x: 0, y: 0, zoom: 1 }, { animation: true })"
      >
        <template #icon>
          <Icon icon="mdi:fit-to-page" style="width:20px;height:20px" />
        </template>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls, ControlButton } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { Icon } from '@iconify/vue'
import { Button } from 'primevue'
import { markRaw } from 'vue'
import { NetworkComponentType, getComponentColor } from '~/types/network'
import { INTERNET_SOURCE_ID } from '~/types/test'
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
const testsStore = useTestsStore()
const { fitView, zoomIn, zoomOut, setInteractive, setNodes, setEdges, setViewport, nodesDraggable, nodesConnectable, elementsSelectable } = useVueFlow()
const isInteractive = computed(() => nodesDraggable.value || nodesConnectable.value || elementsSelectable.value)

const canvasWrapper = ref<HTMLElement | null>(null)
const snapToGrid = ref(false)

// Sync Vue Flow's internal node/edge state whenever Pinia store actions that
// bypass Vue Flow's own v-model update path (reset, autoLayout, loadDiagram).
onMounted(() => {
  const unsub = diagramStore.$onAction(({ name, after }) => {
    if (name === 'resetDiagram') {
      after(() => {
        setNodes([])
        setEdges([])
        nextTick(() => setViewport({ x: 0, y: 0, zoom: 1 }))
      })
    }
    if (name === 'autoLayout') {
      after(() => nextTick(() => {
        setNodes([...diagramStore.nodes] as any)
        nextTick(() => fitView())
      }))
    }
    if (name === 'loadDiagram') {
      after(() => nextTick(() => {
        setNodes([...diagramStore.nodes] as any)
        setEdges([...diagramStore.edges] as any)
        nextTick(() => fitView())
      }))
    }
  })
  onUnmounted(unsub)
})

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
  'vnet-node': markRaw(VNetNode) as any,
  'subnet-node': markRaw(SubnetNode) as any,
  'nsg-node': markRaw(NsgNode) as any,
  'asg-node': markRaw(AsgNode) as any,
  'ip-address-node': markRaw(IpAddressNode) as any,
  'dns-zone-node': markRaw(DnsZoneNode) as any,
  'vpn-gateway-node': markRaw(VpnGatewayNode) as any,
  'app-gateway-node': markRaw(AppGatewayNode) as any,
  'nva-node': markRaw(NvaNode) as any,
  'load-balancer-node': markRaw(LoadBalancerNode) as any,
  'udr-node': markRaw(UdrNode) as any,
  'vnet-peering-node': markRaw(VnetPeeringNode) as any,
  'compute-node': markRaw(ComputeNode) as any,
  'storage-node': markRaw(StorageNode) as any,
  'identity-node': markRaw(IdentityNode) as any,
  'network-ic-node': markRaw(NetworkICNode) as any,
}

const edgeTypes: EdgeTypesObject = {
  'network-edge': markRaw(NetworkEdge) as any,
}

function onNodeClick({ node }: any) {
  if (!isInteractive.value) return  // Locked — ignore all node interactions
  diagramStore.setSelectedNode(node.id)
  diagramStore.openEditComponentModal(node.data)
}

function onNodeDblClick(_payload: any) {
  // Single-click already opens the edit form when unlocked
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

function loadSampleDiagram() {
  const now = new Date().toISOString()

  const vnetId = 'sample-vnet-1'
  const nsg1Id = 'sample-nsg-1'
  const nsg2Id = 'sample-nsg-2'
  const nsg3Id = 'sample-nsg-3'
  const subnet1Id = 'sample-subnet-1'
  const subnet2Id = 'sample-subnet-2'
  const subnet3Id = 'sample-subnet-3'
  const nic1Id = 'sample-nic-1'
  const nic2Id = 'sample-nic-2'
  const nic3Id = 'sample-nic-3'
  const vm1Id = 'sample-vm-1'
  const vm2Id = 'sample-vm-2'
  const vm3Id = 'sample-vm-3'
  const vm4Id = 'sample-vm-4'

  // VNet
  diagramStore.addNode({
    id: vnetId,
    type: NetworkComponentType.VNET,
    name: 'VNet 1',
    addressSpace: ['10.0.0.0/16'],
    region: 'southeastasia',
    resourceGroup: 'rg-sample',
    createdAt: now,
  } as any, { x: 100, y: 50 })

  const makeAllowHttp80Rule = (id: string) => ({
    id,
    name: 'AllowHTTP',
    priority: 100,
    direction: 'Inbound' as const,
    access: 'Allow' as const,
    protocol: 'Tcp' as const,
    sourceAddressPrefix: '*',
    sourcePortRange: '*',
    destinationAddressPrefix: '*',
    destinationPortRange: '80',
  })

  const makeDenyHttp80Rule = (id: string) => ({
    id,
    name: 'DenyHTTP',
    priority: 100,
    direction: 'Inbound' as const,
    access: 'Deny' as const,
    protocol: 'Tcp' as const,
    sourceAddressPrefix: '*',
    sourcePortRange: '*',
    destinationAddressPrefix: '*',
    destinationPortRange: '80',
  })

  // NSGs
  diagramStore.addNode({
    id: nsg1Id,
    type: NetworkComponentType.NSG,
    name: 'NSG 1',
    securityRules: [makeAllowHttp80Rule('r-nsg1-1')],
    subnetIds: [subnet1Id],
    createdAt: now,
  } as any, { x: 100, y: 250 })

  diagramStore.addNode({
    id: nsg2Id,
    type: NetworkComponentType.NSG,
    name: 'NSG 2',
    securityRules: [makeAllowHttp80Rule('r-nsg2-1')],
    nicIds: [nic1Id],
    createdAt: now,
  } as any, { x: 360, y: 250 })

  diagramStore.addNode({
    id: nsg3Id,
    type: NetworkComponentType.NSG,
    name: 'NSG 3',
    securityRules: [makeDenyHttp80Rule('r-nsg3-1')],
    subnetIds: [subnet2Id],
    nicIds: [nic2Id, nic3Id],
    createdAt: now,
  } as any, { x: 620, y: 250 })

  // Subnets
  diagramStore.addNode({
    id: subnet1Id,
    type: NetworkComponentType.SUBNET,
    name: 'Subnet 1',
    addressPrefix: '10.0.1.0/24',
    vnetId: vnetId,
    nsgId: nsg1Id,
    createdAt: now,
  } as any, { x: 100, y: 420 })

  diagramStore.addNode({
    id: subnet2Id,
    type: NetworkComponentType.SUBNET,
    name: 'Subnet 2',
    addressPrefix: '10.0.2.0/24',
    vnetId: vnetId,
    nsgId: nsg3Id,
    createdAt: now,
  } as any, { x: 480, y: 420 })

  diagramStore.addNode({
    id: subnet3Id,
    type: NetworkComponentType.SUBNET,
    name: 'Subnet 3',
    addressPrefix: '10.0.3.0/24',
    vnetId: vnetId,
    createdAt: now,
  } as any, { x: 860, y: 420 })

  // NICs
  diagramStore.addNode({
    id: nic1Id,
    type: NetworkComponentType.NETWORK_IC,
    name: 'NIC 1',
    privateIpAllocationMethod: 'Dynamic',
    nsgId: nsg2Id,
    subnetId: subnet1Id,
    createdAt: now,
  } as any, { x: 100, y: 640 })

  diagramStore.addNode({
    id: nic2Id,
    type: NetworkComponentType.NETWORK_IC,
    name: 'NIC 2',
    privateIpAllocationMethod: 'Dynamic',
    nsgId: nsg3Id,
    subnetId: subnet1Id,
    createdAt: now,
  } as any, { x: 360, y: 640 })

  diagramStore.addNode({
    id: nic3Id,
    type: NetworkComponentType.NETWORK_IC,
    name: 'NIC 3',
    privateIpAllocationMethod: 'Dynamic',
    nsgId: nsg3Id,
    subnetId: subnet3Id,
    createdAt: now,
  } as any, { x: 620, y: 640 })

  // VMs
  diagramStore.addNode({
    id: vm1Id,
    type: NetworkComponentType.VM,
    name: 'VM 1',
    size: 'Standard_B2s',
    os: 'Linux',
    imagePublisher: 'Canonical',
    imageOffer: 'UbuntuServer',
    imageSku: '20.04-LTS',
    adminUsername: 'azureuser',
    subnetId: subnet1Id,
    nicIds: [nic1Id],
    createdAt: now,
  } as any, { x: 100, y: 810 })

  diagramStore.addNode({
    id: vm2Id,
    type: NetworkComponentType.VM,
    name: 'VM 2',
    size: 'Standard_B2s',
    os: 'Linux',
    imagePublisher: 'Canonical',
    imageOffer: 'UbuntuServer',
    imageSku: '20.04-LTS',
    adminUsername: 'azureuser',
    subnetId: subnet1Id,
    nicIds: [nic2Id],
    createdAt: now,
  } as any, { x: 360, y: 810 })

  diagramStore.addNode({
    id: vm3Id,
    type: NetworkComponentType.VM,
    name: 'VM 3',
    size: 'Standard_B2s',
    os: 'Linux',
    imagePublisher: 'Canonical',
    imageOffer: 'UbuntuServer',
    imageSku: '20.04-LTS',
    adminUsername: 'azureuser',
    subnetId: subnet3Id,
    nicIds: [nic3Id],
    createdAt: now,
  } as any, { x: 620, y: 810 })

  diagramStore.addNode({
    id: vm4Id,
    type: NetworkComponentType.VM,
    name: 'VM 4',
    size: 'Standard_B2s',
    os: 'Linux',
    imagePublisher: 'Canonical',
    imageOffer: 'UbuntuServer',
    imageSku: '20.04-LTS',
    adminUsername: 'azureuser',
    subnetId: subnet2Id,
    createdAt: now,
  } as any, { x: 880, y: 810 })

  // Edges (containment edges Subnet→VNet are omitted — expressed via parentNode after auto-layout)
  const makeEdge = (source: string, target: string): DiagramEdge => ({
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'network-edge',
    label: '',
    data: { color: '#0078d4' },
  } as DiagramEdge)

  // NSGs → Subnets
  diagramStore.addEdge(makeEdge(nsg1Id, subnet1Id))
  diagramStore.addEdge(makeEdge(nsg3Id, subnet2Id))
  // NSGs → NICs
  diagramStore.addEdge(makeEdge(nsg2Id, nic1Id))
  diagramStore.addEdge(makeEdge(nsg3Id, nic2Id))
  diagramStore.addEdge(makeEdge(nsg3Id, nic3Id))
  // NICs → VMs
  diagramStore.addEdge(makeEdge(nic1Id, vm1Id))
  diagramStore.addEdge(makeEdge(nic2Id, vm2Id))
  diagramStore.addEdge(makeEdge(nic3Id, vm3Id))
  // VMs → Subnets
  diagramStore.addEdge(makeEdge(vm1Id, subnet1Id))
  diagramStore.addEdge(makeEdge(vm2Id, subnet1Id))
  diagramStore.addEdge(makeEdge(vm3Id, subnet3Id))
  diagramStore.addEdge(makeEdge(vm4Id, subnet2Id))

  // Pre-built connection tests: Public Internet → each VM on port 80
  // Replace any existing tests so the sample always starts fresh.
  testsStore.clearAllTests()
  const makeInternetTest = (vmName: string, vmId: string) => ({
    name: `Internet → ${vmName} (port 80)`,
    type: 'connection' as const,
    description: `Can Public Internet reach ${vmName} on port 80?`,
    condition: { sourceId: INTERNET_SOURCE_ID, targetId: vmId, port: 80 },
  })
  testsStore.addTest(makeInternetTest('VM 1', vm1Id))
  testsStore.addTest(makeInternetTest('VM 2', vm2Id))
  testsStore.addTest(makeInternetTest('VM 3', vm3Id))
  testsStore.addTest(makeInternetTest('VM 4', vm4Id))

  // Apply auto-layout so containers visually wrap their children;
  // the $onAction handler for autoLayout will sync Vue Flow and call fitView().
  nextTick(() => diagramStore.autoLayout())
}
</script>
