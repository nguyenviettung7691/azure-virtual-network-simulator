<template>
    <div
      class="diagram-canvas-wrapper"
      :class="{ 'is-interactive': isInteractive, 'is-animation-mode': isAnimationMode }"
      ref="canvasWrapper"
    >
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :nodes-draggable="nodesDraggable"
      :elements-selectable="elementsSelectable"
      :nodes-connectable="false"
      :edges-updatable="false"
      :connect-on-click="false"
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
            @click="toggleInteractive()"
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
        pannable
        zoomable
      />
    </VueFlow>

    <!-- Empty state — lives outside VueFlow so it never inherits the pane grab cursor -->
    <div v-if="diagramStore.nodes.length === 0" class="canvas-empty-state">
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
          label="Quick Sample"
          severity="secondary"
          class="empty-btn-quick"
          @click="loadQuickSampleDiagram()"
        >
          <template #icon>
            <Icon icon="mdi:lightning-bolt" class="p-button-icon p-button-icon-left" />
          </template>
        </Button>
        <Button
          label="Full Sample"
          severity="secondary"
          class="empty-btn-full"
          @click="loadFullSampleDiagram()"
        >
          <template #icon>
            <Icon icon="mdi:flask-outline" class="p-button-icon p-button-icon-left" />
          </template>
        </Button>
      </div>
    </div>

    <div v-if="isAnimationMode" class="animation-mode-banner">
      <Button
        label="Exit animation"
        severity="danger"
        class="animation-exit-btn"
        @click="exitAnimation"
      >
        <template #icon>
          <Icon icon="mdi:close-circle-outline" class="p-button-icon p-button-icon-left" />
        </template>
      </Button>
    </div>

    <!-- Canvas toolbar overlay -->
    <div class="canvas-toolbar">
      <Button
        v-tooltip.bottom="'Auto Layout'"
        severity="secondary"
        class="canvas-toolbar-btn"
        :disabled="isAnimationMode"
        @click="onAutoLayout"
      >
        <template #icon>
          <Icon
            icon="mdi:auto-fix"
            :style="{ width: '20px', height: '20px', color: isAnimationMode ? 'var(--text-muted)' : 'var(--primary)' }"
          />
        </template>
      </Button>
      <Button
        v-tooltip.bottom="snapToGrid ? 'Disable snap' : 'Snap to grid'"
        :severity="snapToGrid ? 'primary' : 'secondary'"
        class="canvas-toolbar-btn"
        :disabled="isAnimationMode"
        @click="snapToGrid = !snapToGrid"
      >
        <template #icon>
          <Icon icon="mdi:grid" style="width:20px;height:20px" />
        </template>
      </Button>
      <Button
        v-tooltip.bottom="'Fit View (reset to 1:1)'"
        severity="secondary"
        class="canvas-toolbar-btn"
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
import InternetNode from './nodes/InternetNode.vue'
import NetworkICNode from './nodes/NetworkICNode.vue'
import NetworkEdge from './edges/NetworkEdge.vue'
import AnimationEdge from './edges/AnimationEdge.vue'

const diagramStore = useDiagramStore()
const testsStore = useTestsStore()
const { fitView, zoomIn, zoomOut, setNodes, setEdges, setViewport, nodesDraggable, elementsSelectable } = useVueFlow()
const isInteractive = computed(() => nodesDraggable.value || elementsSelectable.value)
const isAnimationMode = computed(() => diagramStore.viewMode === 'animation')

const canvasWrapper = ref<HTMLElement | null>(null)
const snapToGrid = ref(false)
const restoreInteractiveAfterAnimation = ref(false)

nodesDraggable.value = false
elementsSelectable.value = false

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
        syncRenderedGraph()
        nextTick(() => fitView())
      }))
    }
    if (name === 'loadDiagram') {
      after(() => nextTick(() => {
        syncRenderedGraph()
        nextTick(async () => {
          await fitView()
          await nextTick()
          diagramStore.notifyLoadRenderComplete()
        })
      }))
    }
  })
  onUnmounted(unsub)
})

import type { DiagramAnimationSession, DiagramEdge, DiagramNode } from '~/types/diagram'

// ─── Memoization for summary identify decoration ─────────────────────────────
const summaryDecorateCache = ref<{ nodes: DiagramNode[]; highlightKey: string } | null>(null)

function getSummaryDecorationCacheKey(highlightIds: string[]): string {
  return highlightIds.length === 0 ? '' : highlightIds.join(',')
}

function computeSummaryDecoratedNodes(srcNodes: DiagramNode[], highlightedNodeIds: Set<string>): DiagramNode[] {
  const cacheKey = getSummaryDecorationCacheKey(Array.from(highlightedNodeIds))
  const cache = summaryDecorateCache.value

  // Return cached result if nodes array reference and highlight key match
  if (cache && cache.nodes === srcNodes && cache.highlightKey === cacheKey) {
    return cache.nodes
  }

  const decorated = srcNodes.map(node => decorateSummaryIdentifyNode(node, highlightedNodeIds))
  summaryDecorateCache.value = { nodes: decorated, highlightKey: cacheKey }
  return decorated
}

const nodes = computed({
  get: () => {
    if (!diagramStore.animationSession || !isAnimationMode.value) {
      const highlightedNodeIds = new Set(diagramStore.summaryHighlightNodeIds)
      return computeSummaryDecoratedNodes(diagramStore.nodes, highlightedNodeIds)
    }
    return diagramStore.nodes.map(node => decorateAnimationNode(node, diagramStore.animationSession))
  },
  set: (val) => {
    if (isAnimationMode.value) return
    diagramStore.nodes = val as any
  },
})

const edges = computed({
  get: () => (isAnimationMode.value && diagramStore.animationSession
    ? diagramStore.animationSession.overlayEdges as any[]
    : diagramStore.edges as any[]),
  set: (val) => {
    if (isAnimationMode.value) return
    diagramStore.edges = val as any
  },
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
  'internet-node': markRaw(InternetNode) as any,
  'network-ic-node': markRaw(NetworkICNode) as any,
}

const edgeTypes: EdgeTypesObject = {
  'network-edge': markRaw(NetworkEdge) as any,
  'animation-edge': markRaw(AnimationEdge) as any,
}

watch(isAnimationMode, (next, prev) => {
  if (next) {
    restoreInteractiveAfterAnimation.value = isInteractive.value
    nodesDraggable.value = false
    elementsSelectable.value = false
  } else if (prev) {
    nodesDraggable.value = restoreInteractiveAfterAnimation.value
    elementsSelectable.value = restoreInteractiveAfterAnimation.value
  }

  // Clear summary decoration cache when entering/exiting animation mode
  summaryDecorateCache.value = null
  nextTick(() => syncRenderedGraph())
})

watch(
  () => diagramStore.nodes.length,
  () => {
    // Invalidate cache when node count changes
    summaryDecorateCache.value = null
  }
)

watch(
  () => diagramStore.animationSession,
  () => nextTick(() => syncRenderedGraph()),
  { deep: true },
)

watch(
  () => diagramStore.focusRequestId,
  async () => {
    if (isAnimationMode.value) return
    const targetIds = new Set(diagramStore.focusNodeIds)
    if (targetIds.size === 0) return

    const targetNodes = (diagramStore.nodes as any[]).filter(n => targetIds.has(n.id))
    if (targetNodes.length === 0) return

    await nextTick()
    fitView({ nodes: targetNodes as any, padding: 0.32, duration: 280 })
  },
)

function onNodeClick({ node }: any) {
  if (!isInteractive.value) return  // Locked — ignore all node interactions
  diagramStore.setSelectedNode(node.id)
  if (node.data?.type === NetworkComponentType.INTERNET) return
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

function toggleInteractive() {
  if (isAnimationMode.value) return
  const next = !isInteractive.value
  nodesDraggable.value = next
  elementsSelectable.value = next
}

function exitAnimation() {
  diagramStore.stopAnimation()
}

function getNodeColor(node: any): string {
  return (getComponentColor(node.data?.type) || '#0078d4') + '40'
}

function getNodeStrokeColor(node: any): string {
  return getComponentColor(node.data?.type) || '#0078d4'
}

function loadQuickSampleDiagram() {
  const now = new Date().toISOString()

  const vnetId = 'sample-vnet-1'
  const publicIpId = 'sample-public-ip-1'
  const loadBalancerId = 'sample-lb-1'
  const dnsZoneId = 'sample-dns-1'
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

  const makeDefaultDenyAllRule = (id: string) => ({
    id,
    name: 'DenyAllInbound',
    priority: 4096,
    direction: 'Inbound' as const,
    access: 'Deny' as const,
    protocol: '*' as const,
    sourceAddressPrefix: '*',
    sourcePortRange: '*',
    destinationAddressPrefix: '*',
    destinationPortRange: '*',
  })

  // NSGs
  diagramStore.addNode({
    id: nsg1Id,
    type: NetworkComponentType.NSG,
    name: 'NSG 1',
    securityRules: [makeAllowHttp80Rule('r-nsg1-1'), makeDefaultDenyAllRule('r-nsg1-2')],
    subnetIds: [subnet1Id],
    createdAt: now,
  } as any, { x: 100, y: 250 })

  diagramStore.addNode({
    id: nsg2Id,
    type: NetworkComponentType.NSG,
    name: 'NSG 2',
    securityRules: [makeAllowHttp80Rule('r-nsg2-1'), makeDefaultDenyAllRule('r-nsg2-2')],
    nicIds: [nic1Id],
    createdAt: now,
  } as any, { x: 360, y: 250 })

  diagramStore.addNode({
    id: nsg3Id,
    type: NetworkComponentType.NSG,
    name: 'NSG 3',
    securityRules: [makeDenyHttp80Rule('r-nsg3-1'), makeDefaultDenyAllRule('r-nsg3-2')],
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
    privateIpAddress: '10.0.1.10',
    privateIpAllocationMethod: 'Static',
    nsgId: nsg2Id,
    subnetId: subnet1Id,
    createdAt: now,
  } as any, { x: 100, y: 640 })

  diagramStore.addNode({
    id: nic2Id,
    type: NetworkComponentType.NETWORK_IC,
    name: 'NIC 2',
    privateIpAddress: '10.0.1.20',
    privateIpAllocationMethod: 'Static',
    nsgId: nsg3Id,
    subnetId: subnet1Id,
    createdAt: now,
  } as any, { x: 360, y: 640 })

  diagramStore.addNode({
    id: nic3Id,
    type: NetworkComponentType.NETWORK_IC,
    name: 'NIC 3',
    privateIpAddress: '10.0.3.10',
    privateIpAllocationMethod: 'Static',
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

  // Public IP for the load balancer frontend
  diagramStore.addNode({
    id: publicIpId,
    type: NetworkComponentType.IP_ADDRESS,
    name: 'Web Public IP',
    ipAddress: '52.160.10.10',
    allocationMethod: 'Static',
    sku: 'Standard',
    ipVersion: 'IPv4',
    associatedTo: loadBalancerId,
    dnsLabel: 'sample-web',
    createdAt: now,
  } as any, { x: 100, y: 1030 })

  // Public load balancer for the sample web tier
  diagramStore.addNode({
    id: loadBalancerId,
    type: NetworkComponentType.LOAD_BALANCER,
    name: 'Web Load Balancer',
    sku: 'Standard',
    tier: 'Regional',
    loadBalancerType: 'Public',
    frontendIpConfigs: [{
      id: 'sample-lb-frontend-1',
      name: 'public-frontend',
      publicIpId,
    }],
    backendPools: [{
      id: 'sample-lb-backend-1',
      name: 'web-backend-pool',
      nicIds: [nic1Id, nic2Id, nic3Id],
    }],
    loadBalancingRules: [{
      id: 'sample-lb-rule-1',
      name: 'http-80',
      protocol: 'Tcp',
      frontendPort: 80,
      backendPort: 80,
      frontendIpId: 'sample-lb-frontend-1',
      backendPoolId: 'sample-lb-backend-1',
      probeId: 'sample-lb-probe-1',
      idleTimeoutInMinutes: 4,
    }],
    healthProbes: [{
      id: 'sample-lb-probe-1',
      name: 'http-probe',
      protocol: 'Http',
      port: 80,
      intervalInSeconds: 5,
      numberOfProbes: 2,
      requestPath: '/healthz',
    }],
    createdAt: now,
  } as any, { x: 360, y: 1030 })

  // Private DNS zone for the sample VMs
  diagramStore.addNode({
    id: dnsZoneId,
    type: NetworkComponentType.DNS_ZONE,
    name: 'Sample Private DNS',
    zoneName: 'sample.internal',
    zoneType: 'Private',
    vnetLinks: [vnetId],
    recordSets: [
      { name: 'vm1', type: 'A', ttl: 300, values: ['10.0.1.10'] },
      { name: 'vm2', type: 'A', ttl: 300, values: ['10.0.1.20'] },
      { name: 'vm3', type: 'A', ttl: 300, values: ['10.0.3.10'] },
      { name: 'vm4', type: 'A', ttl: 300, values: ['10.0.2.10'] },
    ],
    createdAt: now,
  } as any, { x: 620, y: 1030 })

  // Edges (containment is expressed by parentNode after auto-layout; only attachment edges are drawn)
  const makeEdge = (source: string, target: string): DiagramEdge => ({
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'network-edge',
    label: '',
    data: {},
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
  // Public IP → Load Balancer
  diagramStore.addEdge(makeEdge(publicIpId, loadBalancerId))
  // Load Balancer → backend NICs
  diagramStore.addEdge(makeEdge(loadBalancerId, nic1Id))
  diagramStore.addEdge(makeEdge(loadBalancerId, nic2Id))
  diagramStore.addEdge(makeEdge(loadBalancerId, nic3Id))
  // DNS Zone → VNet link
  diagramStore.addEdge(makeEdge(dnsZoneId, vnetId))
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
  testsStore.addTest({
    name: 'Internet → Web Load Balancer',
    type: 'loadbalance',
    description: 'Validate the sample public load balancer frontend, backend pool, and probe configuration.',
    condition: {
      sourceId: INTERNET_SOURCE_ID,
      targetId: loadBalancerId,
      expectedBackendCount: 3,
    },
  })
  testsStore.addTest({
    name: 'Resolve vm1.sample.internal',
    type: 'dns',
    description: 'Resolve the private DNS record for VM 1 through the sample private DNS zone.',
    condition: {
      sourceId: '',
      targetId: dnsZoneId,
      hostname: 'vm1.sample.internal',
    },
  })
  // Apply auto-layout so containers visually wrap their children;
  // the $onAction handler for autoLayout will sync Vue Flow and call fitView().
    nextTick(() => {
      diagramStore.autoLayout()
      nextTick(() => diagramStore.notifyDiagramLoaded())
    })
}

function loadFullSampleDiagram() {
  // Build on the existing quick sample so baseline behavior and tests stay aligned.
  loadQuickSampleDiagram()

  const now = new Date().toISOString()

  const vnet1Id = 'sample-vnet-1'
  const subnet2Id = 'sample-subnet-2'
  const subnet3Id = 'sample-subnet-3'
  const nic1Id = 'sample-nic-1'
  const nic2Id = 'sample-nic-2'
  const vm2Id = 'sample-vm-2'

  const vnet2Id = 'sample-vnet-2'
  const subnet4Id = 'sample-subnet-4'
  const asg1Id = 'sample-asg-1'
  const udr1Id = 'sample-udr-1'
  const vpnGatewayIpId = 'sample-vpn-pip-1'
  const vpnGatewayId = 'sample-vpn-gw-1'
  const appGatewayIpId = 'sample-appgw-pip-1'
  const appGatewayId = 'sample-appgw-1'
  const nva1Id = 'sample-nva-1'
  const vmss1Id = 'sample-vmss-1'
  const aks1Id = 'sample-aks-1'
  const appService1Id = 'sample-appsvc-1'
  const functions1Id = 'sample-func-1'
  const storage1Id = 'sample-storage-1'
  const blob1Id = 'sample-blob-1'
  const disk1Id = 'sample-disk-1'
  const keyVault1Id = 'sample-kv-1'
  const identity1Id = 'sample-mi-1'
  const serviceEndpoint1Id = 'sample-se-1'
  const privateEndpoint1Id = 'sample-pe-1'
  const firewallIpId = 'sample-fw-pip-1'
  const firewall1Id = 'sample-fw-1'
  const bastionIpId = 'sample-bastion-pip-1'
  const bastion1Id = 'sample-bastion-1'
  const peering1Id = 'sample-peering-1'
  const platformDnsId = 'sample-dns-platform-1'

  diagramStore.addNode({
    id: vnet2Id,
    type: NetworkComponentType.VNET,
    name: 'VNet 2',
    addressSpace: ['10.1.0.0/16'],
    region: 'southeastasia',
    resourceGroup: 'rg-sample',
    createdAt: now,
  } as any, { x: 1320, y: 50 })

  diagramStore.addNode({
    id: subnet4Id,
    type: NetworkComponentType.SUBNET,
    name: 'Subnet 4',
    addressPrefix: '10.1.1.0/24',
    vnetId: vnet2Id,
    createdAt: now,
  } as any, { x: 1320, y: 260 })

  diagramStore.addNode({
    id: asg1Id,
    type: NetworkComponentType.ASG,
    name: 'ASG Web Tier',
    nicIds: [nic1Id, nic2Id],
    createdAt: now,
  } as any, { x: 980, y: 220 })

  diagramStore.addNode({
    id: udr1Id,
    type: NetworkComponentType.UDR,
    name: 'UDR East',
    routes: [{
      id: 'sample-udr-route-1',
      name: 'to-nva',
      addressPrefix: '0.0.0.0/0',
      nextHopType: 'VirtualAppliance',
      nextHopIpAddress: '10.0.3.4',
    }],
    subnetIds: [subnet2Id],
    createdAt: now,
  } as any, { x: 1120, y: 220 })

  diagramStore.addNode({
    id: vpnGatewayIpId,
    type: NetworkComponentType.IP_ADDRESS,
    name: 'VPN Public IP',
    ipAddress: '20.10.10.10',
    allocationMethod: 'Static',
    sku: 'Standard',
    ipVersion: 'IPv4',
    associatedTo: vpnGatewayId,
    createdAt: now,
  } as any, { x: 980, y: 1040 })

  diagramStore.addNode({
    id: vpnGatewayId,
    type: NetworkComponentType.VPN_GATEWAY,
    name: 'VPN Gateway',
    sku: 'VpnGw1',
    vpnType: 'RouteBased',
    gatewayIpId: vpnGatewayIpId,
    subnetId: subnet3Id,
    createdAt: now,
  } as any, { x: 1120, y: 1040 })

  diagramStore.addNode({
    id: appGatewayIpId,
    type: NetworkComponentType.IP_ADDRESS,
    name: 'App Gateway Public IP',
    ipAddress: '20.20.20.20',
    allocationMethod: 'Static',
    sku: 'Standard',
    ipVersion: 'IPv4',
    associatedTo: appGatewayId,
    createdAt: now,
  } as any, { x: 1260, y: 1040 })

  diagramStore.addNode({
    id: appGatewayId,
    type: NetworkComponentType.APP_GATEWAY,
    name: 'Application Gateway',
    sku: 'WAF_v2',
    tier: 'WAF_v2',
    capacity: 2,
    enableHttp2: true,
    enableWaf: true,
    wafMode: 'Prevention',
    frontendType: 'Public',
    frontendIpId: appGatewayIpId,
    subnetId: subnet2Id,
    backendPools: [nic1Id, nic2Id],
    healthProbes: [{
      id: 'sample-appgw-probe-1',
      name: 'appgw-probe-https',
      protocol: 'Https',
      port: 443,
      intervalInSeconds: 10,
      numberOfProbes: 2,
      requestPath: '/healthz',
    }],
    loadBalancingRules: [{
      id: 'sample-appgw-rule-1',
      name: 'https-443',
      protocol: 'Tcp',
      frontendPort: 443,
      backendPort: 443,
      frontendIpId: appGatewayIpId,
      backendPoolId: nic1Id,
      probeId: 'sample-appgw-probe-1',
    }],
    createdAt: now,
  } as any, { x: 1400, y: 1040 })

  diagramStore.addNode({
    id: nva1Id,
    type: NetworkComponentType.NVA,
    name: 'Edge NVA',
    vmSize: 'Standard_B2ms',
    publisher: 'fortinet',
    offer: 'fortinet_fortigate-vm_v5',
    sku: 'fortinet_fg-vm_payg_2022',
    version: 'latest',
    subnetId: subnet3Id,
    enableIpForwarding: true,
    createdAt: now,
  } as any, { x: 1540, y: 1040 })

  diagramStore.addNode({
    id: vmss1Id,
    type: NetworkComponentType.VMSS,
    name: 'VMSS API',
    sku: 'Standard_B2s',
    capacity: 2,
    os: 'Linux',
    imagePublisher: 'Canonical',
    imageOffer: '0001-com-ubuntu-server-jammy',
    imageSku: '22_04-lts-gen2',
    subnetId: subnet3Id,
    autoscaleEnabled: true,
    minCapacity: 2,
    maxCapacity: 5,
    createdAt: now,
  } as any, { x: 1680, y: 1040 })

  diagramStore.addNode({
    id: aks1Id,
    type: NetworkComponentType.AKS,
    name: 'AKS Cluster',
    kubernetesVersion: '1.31.0',
    nodeCount: 3,
    nodeVmSize: 'Standard_D4s_v5',
    networkPlugin: 'azure',
    subnetId: subnet2Id,
    enableRbac: true,
    enablePrivateCluster: true,
    apiServerAccess: 'Private',
    createdAt: now,
  } as any, { x: 980, y: 1160 })

  diagramStore.addNode({
    id: appService1Id,
    type: NetworkComponentType.APP_SERVICE,
    name: 'App Service API',
    sku: 'P1v3',
    tier: 'Premium',
    os: 'Linux',
    runtimeStack: 'node|20-lts',
    vnetIntegrationSubnetId: subnet2Id,
    subnetId: subnet2Id,
    enableHttps: true,
    createdAt: now,
  } as any, { x: 1120, y: 1160 })

  diagramStore.addNode({
    id: storage1Id,
    type: NetworkComponentType.STORAGE_ACCOUNT,
    name: 'Storage Account',
    accountKind: 'StorageV2',
    replication: 'ZRS',
    accessTier: 'Hot',
    enableHttpsOnly: true,
    networkDefaultAction: 'Deny',
    virtualNetworkRules: [subnet2Id, subnet3Id],
    createdAt: now,
  } as any, { x: 1260, y: 1160 })

  diagramStore.addNode({
    id: functions1Id,
    type: NetworkComponentType.FUNCTIONS,
    name: 'Functions Worker',
    storageAccountId: storage1Id,
    runtimeStack: 'node',
    runtimeVersion: '20',
    hostingPlanSku: 'EP1',
    vnetIntegrationSubnetId: subnet3Id,
    subnetId: subnet3Id,
    enablePrivateEndpoint: true,
    createdAt: now,
  } as any, { x: 1400, y: 1160 })

  diagramStore.addNode({
    id: blob1Id,
    type: NetworkComponentType.BLOB_STORAGE,
    name: 'Blob Container',
    accountKind: 'BlobStorage',
    replication: 'LRS',
    accessTier: 'Cool',
    enableHttpsOnly: true,
    createdAt: now,
  } as any, { x: 1540, y: 1160 })

  diagramStore.addNode({
    id: disk1Id,
    type: NetworkComponentType.MANAGED_DISK,
    name: 'OS Disk VM 4',
    diskSizeGb: 128,
    sku: 'Premium_LRS',
    osType: 'Linux',
    attachedToVmId: 'sample-vm-4',
    createdAt: now,
  } as any, { x: 1680, y: 1160 })

  diagramStore.addNode({
    id: identity1Id,
    type: NetworkComponentType.MANAGED_IDENTITY,
    name: 'Managed Identity API',
    identityType: 'UserAssigned',
    clientId: 'sample-client-id',
    principalId: 'sample-principal-id',
    assignedToId: appService1Id,
    createdAt: now,
  } as any, { x: 980, y: 1280 })

  diagramStore.addNode({
    id: keyVault1Id,
    type: NetworkComponentType.KEY_VAULT,
    name: 'Key Vault',
    sku: 'Standard',
    enableSoftDelete: true,
    softDeleteRetentionDays: 30,
    enablePurgeProtection: true,
    networkDefaultAction: 'Deny',
    virtualNetworkRules: [subnet2Id],
    createdAt: now,
  } as any, { x: 1120, y: 1280 })

  diagramStore.addNode({
    id: serviceEndpoint1Id,
    type: NetworkComponentType.SERVICE_ENDPOINT,
    name: 'Storage Service Endpoint',
    service: 'Microsoft.Storage',
    subnetId: subnet3Id,
    locations: ['southeastasia'],
    createdAt: now,
  } as any, { x: 1260, y: 1280 })

  diagramStore.addNode({
    id: privateEndpoint1Id,
    type: NetworkComponentType.PRIVATE_ENDPOINT,
    name: 'Storage Private Endpoint',
    connectionName: 'storage-pe-conn',
    privateLinkServiceId: storage1Id,
    groupIds: ['blob'],
    subnetId: subnet2Id,
    privateIpAddress: '10.0.2.50',
    createdAt: now,
  } as any, { x: 1400, y: 1280 })

  diagramStore.addNode({
    id: firewallIpId,
    type: NetworkComponentType.IP_ADDRESS,
    name: 'Firewall Public IP',
    ipAddress: '52.10.10.10',
    allocationMethod: 'Static',
    sku: 'Standard',
    ipVersion: 'IPv4',
    associatedTo: firewall1Id,
    createdAt: now,
  } as any, { x: 1540, y: 1280 })

  diagramStore.addNode({
    id: firewall1Id,
    type: NetworkComponentType.FIREWALL,
    name: 'Azure Firewall',
    sku: 'Standard',
    tier: 'Standard',
    vnetId: vnet1Id,
    publicIpIds: [firewallIpId],
    threatIntelMode: 'Alert',
    createdAt: now,
  } as any, { x: 1680, y: 1280 })

  diagramStore.addNode({
    id: bastionIpId,
    type: NetworkComponentType.IP_ADDRESS,
    name: 'Bastion Public IP',
    ipAddress: '20.30.30.30',
    allocationMethod: 'Static',
    sku: 'Standard',
    ipVersion: 'IPv4',
    associatedTo: bastion1Id,
    createdAt: now,
  } as any, { x: 980, y: 1400 })

  diagramStore.addNode({
    id: bastion1Id,
    type: NetworkComponentType.BASTION,
    name: 'Azure Bastion',
    sku: 'Standard',
    subnetId: subnet3Id,
    publicIpId: bastionIpId,
    scaleUnits: 2,
    enableTunneling: true,
    enableIpConnect: true,
    createdAt: now,
  } as any, { x: 1120, y: 1400 })

  const internalLbId = 'sample-intlb-1'
  const internalLbIpId = 'sample-intlb-ip-1'
  const internalAppGatewayId = 'sample-intappgw-1'
  const internalAppGatewayIpId = 'sample-intappgw-ip-1'
  const publicDnsId = 'sample-dns-public-1'
  const publicAppServiceId = 'sample-appsvc-public-1'

  diagramStore.addNode({
    id: internalLbIpId,
    type: NetworkComponentType.IP_ADDRESS,
    name: 'Internal LB IP',
    ipAddress: '10.0.2.100',
    allocationMethod: 'Static',
    sku: 'Standard',
    ipVersion: 'IPv4',
    associatedTo: internalLbId,
    createdAt: now,
  } as any, { x: 1, y: 1200 })

  diagramStore.addNode({
    id: internalLbId,
    type: NetworkComponentType.LOAD_BALANCER,
    name: 'Internal Load Balancer',
    sku: 'Standard',
    tier: 'Regional',
    loadBalancerType: 'Internal',
    frontendIpConfigs: [{
      id: 'sample-intlb-frontend-1',
      name: 'intlb-frontend',
      subnetId: subnet2Id,
      privateIpAddress: '10.0.2.100',
    }],
    backendPools: [{
      id: 'sample-intlb-pool-1',
      name: 'backend-pool-apps',
      nicIds: [nic1Id, nic2Id],
    }],
    loadBalancingRules: [{
      id: 'sample-intlb-rule-1',
      name: 'tcp-8080',
      protocol: 'Tcp',
      frontendPort: 8080,
      backendPort: 8080,
      frontendIpId: 'sample-intlb-frontend-1',
      backendPoolId: 'sample-intlb-pool-1',
    }],
    healthProbes: [{
      id: 'sample-intlb-probe-1',
      name: 'tcp-8080-probe',
      protocol: 'Tcp',
      port: 8080,
      intervalInSeconds: 15,
      numberOfProbes: 3,
    }],
    createdAt: now,
  } as any, { x: 100, y: 1200 })

  diagramStore.addNode({
    id: internalAppGatewayIpId,
    type: NetworkComponentType.IP_ADDRESS,
    name: 'Internal App Gateway IP',
    ipAddress: '10.0.3.100',
    allocationMethod: 'Static',
    sku: 'Standard',
    ipVersion: 'IPv4',
    associatedTo: internalAppGatewayId,
    createdAt: now,
  } as any, { x: 200, y: 1200 })

  diagramStore.addNode({
    id: internalAppGatewayId,
    type: NetworkComponentType.APP_GATEWAY,
    name: 'Internal App Gateway',
    sku: 'Standard_v2',
    tier: 'Standard_v2',
    capacity: 1,
    enableHttp2: true,
    enableWaf: false,
    frontendType: 'Internal',
    frontendIpId: internalAppGatewayIpId,
    subnetId: subnet3Id,
    backendPools: [nic1Id],
    createdAt: now,
  } as any, { x: 300, y: 1200 })

  diagramStore.addNode({
    id: publicDnsId,
    type: NetworkComponentType.DNS_ZONE,
    name: 'Public DNS Zone',
    zoneName: 'api.example.com',
    zoneType: 'Public',
    recordSets: [
      { name: 'api', type: 'A', ttl: 60, values: ['20.20.20.20'] },
      { name: 'portal', type: 'A', ttl: 60, values: ['20.10.10.10'] },
    ],
    createdAt: now,
  } as any, { x: 400, y: 1200 })

  diagramStore.addNode({
    id: publicAppServiceId,
    type: NetworkComponentType.APP_SERVICE,
    name: 'Public App Service Portal',
    sku: 'S1',
    tier: 'Standard',
    os: 'Windows',
    runtimeStack: 'dotnet|net8.0',
    customDomain: 'portal.example.com',
    enableHttps: true,
    createdAt: now,
  } as any, { x: 500, y: 1200 })

  diagramStore.addNode({
    id: peering1Id,
    type: NetworkComponentType.VNET_PEERING,
    name: 'VNet 1 ↔ VNet 2',
    localVnetId: vnet1Id,
    remoteVnetId: vnet2Id,
    allowVirtualNetworkAccess: true,
    allowForwardedTraffic: true,
    allowGatewayTransit: false,
    useRemoteGateways: false,
    peeringState: 'Connected',
    createdAt: now,
  } as any, { x: 1260, y: 1400 })

  diagramStore.addNode({
    id: platformDnsId,
    type: NetworkComponentType.DNS_ZONE,
    name: 'Platform Private DNS',
    zoneName: 'platform.internal',
    zoneType: 'Private',
    vnetLinks: [vnet1Id, vnet2Id],
    recordSets: [
      { name: 'storage', type: 'A', ttl: 300, values: ['10.0.2.50'] },
      { name: 'app', type: 'A', ttl: 300, values: ['10.0.1.20'] },
    ],
    createdAt: now,
  } as any, { x: 1400, y: 1400 })

  const makeEdge = (source: string, target: string): DiagramEdge => ({
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'network-edge',
    label: '',
    data: {},
  } as DiagramEdge)

  diagramStore.addEdge(makeEdge(asg1Id, nic1Id))
  diagramStore.addEdge(makeEdge(asg1Id, nic2Id))
  diagramStore.addEdge(makeEdge(udr1Id, subnet2Id))
  diagramStore.addEdge(makeEdge(vpnGatewayIpId, vpnGatewayId))
  diagramStore.addEdge(makeEdge(vpnGatewayId, subnet3Id))
  diagramStore.addEdge(makeEdge(appGatewayIpId, appGatewayId))
  diagramStore.addEdge(makeEdge(appGatewayId, nic1Id))
  diagramStore.addEdge(makeEdge(appGatewayId, nic2Id))
  diagramStore.addEdge(makeEdge(nva1Id, subnet3Id))
  diagramStore.addEdge(makeEdge(storage1Id, blob1Id))
  diagramStore.addEdge(makeEdge(storage1Id, functions1Id))
  diagramStore.addEdge(makeEdge(identity1Id, appService1Id))
  diagramStore.addEdge(makeEdge(keyVault1Id, appService1Id))
  diagramStore.addEdge(makeEdge(serviceEndpoint1Id, subnet3Id))
  diagramStore.addEdge(makeEdge(privateEndpoint1Id, storage1Id))
  diagramStore.addEdge(makeEdge(vm2Id, privateEndpoint1Id))
  diagramStore.addEdge(makeEdge(firewallIpId, firewall1Id))
  diagramStore.addEdge(makeEdge(firewall1Id, vnet1Id))
  diagramStore.addEdge(makeEdge(bastionIpId, bastion1Id))
  diagramStore.addEdge(makeEdge(bastion1Id, subnet3Id))
  diagramStore.addEdge(makeEdge(peering1Id, vnet1Id))
  diagramStore.addEdge(makeEdge(peering1Id, vnet2Id))
  diagramStore.addEdge(makeEdge(platformDnsId, vnet1Id))
  diagramStore.addEdge(makeEdge(platformDnsId, vnet2Id))
  diagramStore.addEdge(makeEdge(disk1Id, 'sample-vm-4'))

  testsStore.addTest({
    name: 'Internet → Application Gateway',
    type: 'loadbalance',
    description: 'Validate Application Gateway frontend and backend wiring in the full sample.',
    condition: {
      sourceId: INTERNET_SOURCE_ID,
      targetId: appGatewayId,
      expectedBackendCount: 2,
    },
  })

  testsStore.addTest({
    name: 'VM 2 → Storage Private Endpoint (443)',
    type: 'connection',
    description: 'Verify workload access path from VM 2 to the storage private endpoint.',
    condition: {
      sourceId: vm2Id,
      targetId: privateEndpoint1Id,
      port: 443,
    },
  })

  testsStore.addTest({
    name: 'Internet → Azure Bastion (443)',
    type: 'connection',
    description: 'Validate the inbound Bastion access path from Public Internet.',
    condition: {
      sourceId: INTERNET_SOURCE_ID,
      targetId: bastion1Id,
      port: 443,
    },
  })

  testsStore.addTest({
    name: 'Resolve storage.platform.internal',
    type: 'dns',
    description: 'Resolve the private DNS record used by the storage private endpoint.',
    condition: {
      sourceId: '',
      targetId: platformDnsId,
      hostname: 'storage.platform.internal',
    },
  })

  testsStore.addTest({
    name: 'Internet → Azure Firewall (80)',
    type: 'connection',
    description: 'Validate that inbound internet traffic reaches the Azure Firewall on port 80.',
    condition: {
      sourceId: INTERNET_SOURCE_ID,
      targetId: firewall1Id,
      port: 80,
    },
  })

  testsStore.addTest({
    name: 'VM 1 → Internal Load Balancer (8080)',
    type: 'loadbalance',
    description: 'Validate east-west traffic from VM 1 through the Internal Load Balancer to its backend pool.',
    condition: {
      sourceId: nic1Id,
      targetId: internalLbId,
      expectedBackendCount: 2,
    },
  })

  testsStore.addTest({
    name: 'VM 4 → Internal App Gateway (80)',
    type: 'loadbalance',
    description: 'Validate internal traffic from VM 4 through the Internal Application Gateway to its backend pool.',
    condition: {
      sourceId: vm2Id,
      targetId: internalAppGatewayId,
      expectedBackendCount: 1,
    },
  })

  testsStore.addTest({
    name: 'Resolve api.example.com',
    type: 'dns',
    description: 'Resolve the public DNS A record for the Application Gateway frontend via the Public DNS Zone.',
    condition: {
      sourceId: '',
      targetId: publicDnsId,
      hostname: 'api.example.com',
    },
  })

  testsStore.addTest({
    name: 'VM 4 → AKS Cluster (443)',
    type: 'connection',
    description: 'Validate private connectivity from a workload VM to the AKS API server endpoint on port 443.',
    condition: {
      sourceId: vm2Id,
      targetId: aks1Id,
      port: 443,
    },
  })

  testsStore.addTest({
    name: 'App Service API → Key Vault (443)',
    type: 'connection',
    description: 'Validate that the App Service API can reach Key Vault over HTTPS for secret retrieval.',
    condition: {
      sourceId: appService1Id,
      targetId: keyVault1Id,
      port: 443,
    },
  })

  testsStore.addTest({
    name: 'Internet → VMSS API (80)',
    type: 'connection',
    description: 'Validate inbound internet connectivity to the VMSS API scale set on port 80.',
    condition: {
      sourceId: INTERNET_SOURCE_ID,
      targetId: vmss1Id,
      port: 80,
    },
  })

  testsStore.addTest({
    name: 'Functions Worker → Storage Account (443)',
    type: 'connection',
    description: 'Validate that the Functions Worker can reach the Storage Account over HTTPS via VNet integration.',
    condition: {
      sourceId: functions1Id,
      targetId: storage1Id,
      port: 443,
    },
  })

  testsStore.addTest({
    name: 'VM 3 → VPN Gateway (443)',
    type: 'connection',
    description: 'Validate connectivity from a subnet-3 workload to the VPN Gateway for on-premises tunnel access.',
    condition: {
      sourceId: 'sample-vm-3',
      targetId: vpnGatewayId,
      port: 443,
    },
  })

  testsStore.addTest({
    name: 'Internet → Public App Service Portal (443)',
    type: 'connection',
    description: 'Validate that the public-facing App Service Portal is reachable from the internet over HTTPS.',
    condition: {
      sourceId: INTERNET_SOURCE_ID,
      targetId: publicAppServiceId,
      port: 443,
    },
  })
}

function syncRenderedGraph() {
  setNodes([...nodes.value] as any)
  setEdges([...edges.value] as any)
}

function decorateAnimationNode(node: DiagramNode, session: DiagramAnimationSession): DiagramNode {
  const isInPath = session.path.includes(node.id)
  const state = isInPath ? (session.nodeStates[node.id] || 'pending') : 'idle'
  const stateClass = `animation-node animation-node--${state}`

  return {
    ...node,
    class: mergeNodeClass((node as any).class, stateClass),
    selected: false,
  }
}

function decorateSummaryIdentifyNode(node: DiagramNode, highlightedNodeIds: Set<string>): DiagramNode {
  const identifyClass = highlightedNodeIds.has(node.id) ? 'summary-identify' : ''
  return {
    ...node,
    class: mergeNodeClass((node as any).class, identifyClass),
  }
}

function mergeNodeClass(currentClass: unknown, nextClass: string): string {
  const sanitizedCurrentClass = typeof currentClass === 'string'
    ? currentClass
      .split(/\s+/)
      .filter(token => token
        && token !== 'animation-node'
        && !token.startsWith('animation-node--')
        && token !== 'summary-identify')
      .join(' ')
    : ''

  return [sanitizedCurrentClass, nextClass]
    .filter(Boolean)
    .join(' ')
}
</script>
