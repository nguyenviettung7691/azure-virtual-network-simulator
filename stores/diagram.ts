import { defineStore } from 'pinia'
import {
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  INTERNET_NODE_HEIGHT,
  INTERNET_NODE_WIDTH,
  SUBNET_MIN_HEIGHT,
  SUBNET_MIN_WIDTH,
  VNET_MIN_HEIGHT,
  VNET_MIN_WIDTH,
} from '~/lib/layout'
import type {
  AnimationTerminalState,
  AnimationVisualState,
  DiagramAnimationSession,
  DiagramNode,
  DiagramEdge,
  DiagramState,
  DiagramViewMode,
} from '~/types/diagram'
import type { AnyNetworkComponent, InternetComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { applyDagreLayout } from '~/lib/dagre'
import { INTERNET_SOURCE_ID } from '~/types/test'

// DiagramEdge extends a union type (Edge from @vue-flow/core), so we use this
// minimal intersection type to safely access common edge properties.
type EdgeBase = { id: string; source: string; target: string }

const PUBLIC_INTERNET_NAME = 'Public Internet'
const DEFAULT_ANIMATION_SEGMENT_MS = 1600

interface DiagramStoreState {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  viewMode: DiagramViewMode
  animationSession: DiagramAnimationSession | null
  animationRunId: number
  selectedNodeId: string | null
  isDirty: boolean
  viewport: { x: number; y: number; zoom: number }
  showComponentModal: boolean
  editingComponent: AnyNetworkComponent | null
  addingComponentType: NetworkComponentType | null
  showConfirmDialog: boolean
  confirmDialogMessage: string
  confirmDialogAction: ((checkboxChecked?: boolean) => void) | null
  confirmDialogCheckboxLabel: string | null
  confirmDialogCheckboxChecked: boolean
}

export const useDiagramStore = defineStore('diagram', {
  state: (): DiagramStoreState => ({
    nodes: [],
    edges: [],
    viewMode: 'infrastructure',
    animationSession: null,
    animationRunId: 0,
    selectedNodeId: null,
    isDirty: false,
    viewport: { x: 0, y: 0, zoom: 1 },
    showComponentModal: false,
    editingComponent: null,
    addingComponentType: null,
    showConfirmDialog: false,
    confirmDialogMessage: '',
    confirmDialogAction: null,
    confirmDialogCheckboxLabel: null,
    confirmDialogCheckboxChecked: false,
  }),

  getters: {
    selectedNode: (state): DiagramNode | null => {
      const found = (state.nodes as DiagramNode[]).find(n => n.id === state.selectedNodeId)
      return found || null
    },
    diagramState: (state): DiagramState => ({
      nodes: state.nodes as DiagramNode[],
      edges: state.edges as DiagramEdge[],
      viewport: state.viewport,
    }),
    vnets: (state): DiagramNode[] => (state.nodes as any[]).filter((n: any) => n.data?.type === NetworkComponentType.VNET) as DiagramNode[],
    subnets: (state): DiagramNode[] => (state.nodes as any[]).filter((n: any) => n.data?.type === NetworkComponentType.SUBNET) as DiagramNode[],
    nodeCount: (state) => state.nodes.length,
    edgeCount: (state) => state.edges.length,
  },

  actions: {
    addNode(component: AnyNetworkComponent, position?: { x: number; y: number }) {
      const node = createDiagramNode(
        component,
        position || getInitialNodePosition(component.type, this.nodes)
      )
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – DiagramNode extends a deeply generic vue-flow type; TS depth limit hit
      this.nodes = syncSystemManagedNodes([...this.nodes, node])
      this.isDirty = true
    },

    updateNode(id: string, updates: Partial<AnyNetworkComponent>) {
      const idx = this.nodes.findIndex(n => n.id === id)
      if (idx === -1) return
      if (isPublicInternetComponent(this.nodes[idx].data)) return
      const updatedComponent = { ...this.nodes[idx].data, ...updates } as AnyNetworkComponent
      this.nodes[idx] = { ...this.nodes[idx], data: updatedComponent }
      this.nodes = [...this.nodes]
      this.isDirty = true
    },

    removeNode(id: string) {
      if (id === INTERNET_SOURCE_ID) return
      this.nodes = syncSystemManagedNodes(this.nodes.filter(n => n.id !== id))
      this.edges = (this.edges as unknown as EdgeBase[]).filter(
        e => e.source !== id && e.target !== id
      ) as unknown as DiagramEdge[]
      if (this.selectedNodeId === id) this.selectedNodeId = null
      if (this.selectedNodeId && !this.nodes.some(n => n.id === this.selectedNodeId)) this.selectedNodeId = null
      this.isDirty = true
    },

    addEdge(edge: DiagramEdge) {
      const normalizedEdge = normalizeDiagramEdge(edge)
      const e = normalizedEdge as unknown as EdgeBase
      const exists = (this.edges as unknown as EdgeBase[]).some(
        ex => ex.source === e.source && ex.target === e.target
      )
      if (!exists) {
        this.edges = [...this.edges, normalizedEdge]
        this.isDirty = true
      }
    },

    updateEdge(id: string, updates: Partial<DiagramEdge>) {
      const idx = (this.edges as unknown as EdgeBase[]).findIndex(e => e.id === id)
      if (idx === -1) return
      this.edges[idx] = normalizeDiagramEdge({ ...this.edges[idx], ...updates } as DiagramEdge)
      this.edges = [...this.edges]
      this.isDirty = true
    },

    removeEdge(id: string) {
      this.edges = (this.edges as unknown as EdgeBase[]).filter(e => e.id !== id) as unknown as DiagramEdge[]
      this.isDirty = true
    },

    setSelectedNode(id: string | null) {
      this.selectedNodeId = id
    },

    loadDiagram(state: DiagramState) {
      this.stopAnimation()
      this.nodes = syncSystemManagedNodes(state.nodes)
      this.edges = state.edges.map(edge => normalizeDiagramEdge(edge as DiagramEdge))
      this.viewport = state.viewport
      this.isDirty = false
      this.selectedNodeId = null
    },

    resetDiagram() {
      this.stopAnimation()
      this.nodes = []
      this.edges = []
      this.selectedNodeId = null
      this.isDirty = false
      this.viewport = { x: 0, y: 0, zoom: 1 }
    },

    autoLayout() {
      if (this.viewMode === 'animation') return
      if (this.nodes.length === 0) return
      try {
        const newNodes = applyDagreLayout([...this.nodes], [...this.edges])
        // Build a parent map from the newly laid-out nodes
        const parentMap = new Map<string, string>()
        newNodes.forEach(n => {
          const p = (n as any).parentNode
          if (p) parentMap.set(n.id, p)
        })
        // Remove edges that only express containment (child → parent or parent → child)
        const currentEdges = this.edges as unknown as EdgeBase[]
        const filteredEdges = currentEdges.filter(e => {
          return parentMap.get(e.source) !== e.target && parentMap.get(e.target) !== e.source
        })
        this.nodes = newNodes
        this.edges = filteredEdges as unknown as DiagramEdge[]
      } catch (err) {
        console.error('[autoLayout] dagre layout failed:', err)
      }
    },

    openAddComponentModal(type: NetworkComponentType) {
      if (type === NetworkComponentType.INTERNET) return
      this.addingComponentType = type
      this.editingComponent = null
      this.showComponentModal = true
    },

    openEditComponentModal(component: AnyNetworkComponent) {
      if (isPublicInternetComponent(component)) return
      this.editingComponent = { ...component } as AnyNetworkComponent
      this.addingComponentType = null
      this.showComponentModal = true
    },

    closeComponentModal() {
      this.showComponentModal = false
      this.editingComponent = null
      this.addingComponentType = null
    },

    confirmAction(message: string, action: ((checkboxChecked?: boolean) => void), checkboxLabel?: string) {
      this.confirmDialogMessage = message
      this.confirmDialogAction = action
      this.confirmDialogCheckboxLabel = checkboxLabel ?? null
      this.confirmDialogCheckboxChecked = false
      this.showConfirmDialog = true
    },

    executeConfirmedAction() {
      if (this.confirmDialogAction) this.confirmDialogAction(this.confirmDialogCheckboxChecked)
      this.showConfirmDialog = false
      this.confirmDialogAction = null
      this.confirmDialogCheckboxLabel = null
      this.confirmDialogCheckboxChecked = false
    },

    cancelConfirmDialog() {
      this.showConfirmDialog = false
      this.confirmDialogAction = null
      this.confirmDialogCheckboxLabel = null
      this.confirmDialogCheckboxChecked = false
    },

    setViewport(viewport: { x: number; y: number; zoom: number }) {
      this.viewport = viewport
    },

    async playConnectionAnimation(payload: {
      testId: string
      path: string[]
      resultState: AnimationTerminalState
      segmentDurationMs?: number
    }) {
      const path = payload.path
        .filter(Boolean)
        .map(resolveAnimationPathNodeId)
      if (path.length < 2) {
        this.stopAnimation()
        return false
      }

      const runId = this.animationRunId + 1
      const segmentDurationMs = payload.segmentDurationMs ?? DEFAULT_ANIMATION_SEGMENT_MS
      const session = createAnimationSession(payload.testId, path, payload.resultState, segmentDurationMs)

      this.animationRunId = runId
      this.viewMode = 'animation'
      this.animationSession = cloneAnimationSession(session)

      for (let index = 0; index < path.length - 1; index += 1) {
        if (this.animationRunId !== runId || !this.animationSession) return false

        const sourceId = path[index]
        const targetId = path[index + 1]
        const edgeId = createAnimationEdgeId(sourceId, targetId, index)

        session.activeEdgeId = edgeId
        session.travelerVisible = true
        session.nodeStates[sourceId] = index === 0 ? 'active' : session.terminalState
        session.nodeStates[targetId] = 'active'
        session.edgeStates[edgeId] = 'active'
        session.overlayEdges = buildAnimationOverlayEdges(session)
        this.animationSession = cloneAnimationSession(session)

        await wait(segmentDurationMs)

        if (this.animationRunId !== runId || !this.animationSession) return false

        session.activeEdgeId = null
        session.travelerVisible = false
        session.nodeStates[sourceId] = session.terminalState
        session.nodeStates[targetId] = session.terminalState
        session.edgeStates[edgeId] = session.terminalState
        session.overlayEdges = buildAnimationOverlayEdges(session)
        this.animationSession = cloneAnimationSession(session)
      }

      if (this.animationRunId !== runId || !this.animationSession) return false

      session.isRunning = false
      session.travelerVisible = false
      session.activeEdgeId = null
      session.overlayEdges = buildAnimationOverlayEdges(session)
      this.animationSession = cloneAnimationSession(session)

      return true
    },

    stopAnimation() {
      this.animationRunId += 1
      this.viewMode = 'infrastructure'
      this.animationSession = null
    },
  },
})

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createAnimationSession(
  testId: string,
  path: string[],
  terminalState: AnimationTerminalState,
  segmentDurationMs: number,
): DiagramAnimationSession {
  const nodeStates: Record<string, AnimationVisualState> = {}
  const edgeStates: Record<string, AnimationVisualState> = {}

  path.forEach((nodeId, index) => {
    nodeStates[nodeId] = index === 0 ? 'active' : 'pending'
    if (index < path.length - 1) {
      const edgeId = createAnimationEdgeId(nodeId, path[index + 1], index)
      edgeStates[edgeId] = 'pending'
    }
  })

  const session: DiagramAnimationSession = {
    activeTestId: testId,
    path,
    overlayEdges: [],
    nodeStates,
    edgeStates,
    activeEdgeId: null,
    travelerVisible: false,
    segmentDurationMs,
    terminalState,
    isRunning: true,
  }

  session.overlayEdges = buildAnimationOverlayEdges(session)
  return session
}

function buildAnimationOverlayEdges(session: DiagramAnimationSession): DiagramEdge[] {
  return session.path.slice(0, -1).map((sourceId, index) => {
    const targetId = session.path[index + 1]
    const edgeId = createAnimationEdgeId(sourceId, targetId, index)
    const state = session.edgeStates[edgeId] || 'pending'

    return {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: 'animation-edge',
      selectable: false,
      updatable: false,
      data: {
        state,
        isActive: session.activeEdgeId === edgeId,
        travelerVisible: session.travelerVisible && session.activeEdgeId === edgeId,
        durationMs: session.segmentDurationMs,
      },
    } as DiagramEdge
  })
}

function cloneAnimationSession(session: DiagramAnimationSession): DiagramAnimationSession {
  return {
    ...session,
    overlayEdges: session.overlayEdges.map(edge => ({ ...edge })),
    nodeStates: { ...session.nodeStates },
    edgeStates: { ...session.edgeStates },
  }
}

function createAnimationEdgeId(sourceId: string, targetId: string, index: number): string {
  return `animation-edge-${index}-${sourceId}-${targetId}`
}

function resolveAnimationPathNodeId(nodeId: string): string {
  return nodeId === 'Internet' ? INTERNET_SOURCE_ID : nodeId
}

function getNodeType(componentType: NetworkComponentType): string {
  const typeMap: Partial<Record<NetworkComponentType, string>> = {
    [NetworkComponentType.VNET]: 'vnet-node',
    [NetworkComponentType.SUBNET]: 'subnet-node',
    [NetworkComponentType.NSG]: 'nsg-node',
    [NetworkComponentType.ASG]: 'asg-node',
    [NetworkComponentType.IP_ADDRESS]: 'ip-address-node',
    [NetworkComponentType.DNS_ZONE]: 'dns-zone-node',
    [NetworkComponentType.VPN_GATEWAY]: 'vpn-gateway-node',
    [NetworkComponentType.APP_GATEWAY]: 'app-gateway-node',
    [NetworkComponentType.NVA]: 'nva-node',
    [NetworkComponentType.LOAD_BALANCER]: 'load-balancer-node',
    [NetworkComponentType.UDR]: 'udr-node',
    [NetworkComponentType.VNET_PEERING]: 'vnet-peering-node',
    [NetworkComponentType.VM]: 'compute-node',
    [NetworkComponentType.VMSS]: 'compute-node',
    [NetworkComponentType.AKS]: 'compute-node',
    [NetworkComponentType.APP_SERVICE]: 'compute-node',
    [NetworkComponentType.FUNCTIONS]: 'compute-node',
    [NetworkComponentType.STORAGE_ACCOUNT]: 'storage-node',
    [NetworkComponentType.BLOB_STORAGE]: 'storage-node',
    [NetworkComponentType.MANAGED_DISK]: 'storage-node',
    [NetworkComponentType.MANAGED_IDENTITY]: 'identity-node',
    [NetworkComponentType.KEY_VAULT]: 'identity-node',
    [NetworkComponentType.NETWORK_IC]: 'network-ic-node',
    [NetworkComponentType.FIREWALL]: 'nsg-node',
    [NetworkComponentType.BASTION]: 'vpn-gateway-node',
    [NetworkComponentType.PRIVATE_ENDPOINT]: 'network-ic-node',
    [NetworkComponentType.SERVICE_ENDPOINT]: 'network-ic-node',
    [NetworkComponentType.INTERNET]: 'internet-node',
  }
  return typeMap[componentType] || 'compute-node'
}

function normalizeDiagramEdge(edge: DiagramEdge): DiagramEdge {
  return {
    ...edge,
    selectable: false,
    updatable: false,
  } as DiagramEdge
}

function getNodeWidth(type: NetworkComponentType): number {
  if (type === NetworkComponentType.VNET) return VNET_MIN_WIDTH
  if (type === NetworkComponentType.SUBNET) return SUBNET_MIN_WIDTH
  if (type === NetworkComponentType.INTERNET) return INTERNET_NODE_WIDTH
  return BASE_NODE_WIDTH
}

function getNodeHeight(type: NetworkComponentType): number {
  if (type === NetworkComponentType.VNET) return VNET_MIN_HEIGHT
  if (type === NetworkComponentType.SUBNET) return SUBNET_MIN_HEIGHT
  if (type === NetworkComponentType.INTERNET) return INTERNET_NODE_HEIGHT
  return BASE_NODE_HEIGHT
}

function getDefaultPosition(index: number): { x: number; y: number } {
  const cols = 4
  const col = index % cols
  const row = Math.floor(index / cols)
  return { x: 100 + col * 220, y: 180 + row * 120 }
}

function getInitialNodePosition(type: NetworkComponentType, nodes: DiagramNode[]): { x: number; y: number } {
  if (type === NetworkComponentType.INTERNET) return getPublicInternetDefaultPosition()
  return getDefaultPosition(getUserManagedNodeCount(nodes))
}

function getPublicInternetDefaultPosition(): { x: number; y: number } {
  return { x: 100, y: 40 }
}

function getUserManagedNodeCount(nodes: DiagramNode[]): number {
  return nodes.filter(node => !isPublicInternetComponent(node.data)).length
}

function isPublicInternetComponent(component: AnyNetworkComponent | Partial<AnyNetworkComponent> | null | undefined): component is InternetComponent {
  return component?.type === NetworkComponentType.INTERNET
}

function createPublicInternetComponent(existing?: Partial<InternetComponent>): InternetComponent {
  return {
    id: INTERNET_SOURCE_ID,
    name: PUBLIC_INTERNET_NAME,
    type: NetworkComponentType.INTERNET,
    createdAt: existing?.createdAt || new Date().toISOString(),
    description: existing?.description,
    tags: existing?.tags,
    systemManaged: true,
  }
}

function createDiagramNode(component: AnyNetworkComponent, position: { x: number; y: number }): DiagramNode {
  return {
    id: component.id,
    type: getNodeType(component.type),
    position,
    data: component,
    width: getNodeWidth(component.type),
    height: getNodeHeight(component.type),
  }
}

function normalizePublicInternetNode(node?: DiagramNode): DiagramNode {
  const internetData = isPublicInternetComponent(node?.data)
    ? createPublicInternetComponent(node.data)
    : createPublicInternetComponent()

  return {
    ...node,
    id: INTERNET_SOURCE_ID,
    type: getNodeType(NetworkComponentType.INTERNET),
    position: node?.position || getPublicInternetDefaultPosition(),
    data: internetData,
    width: getNodeWidth(NetworkComponentType.INTERNET),
    height: getNodeHeight(NetworkComponentType.INTERNET),
    parentNode: undefined,
    extent: undefined,
  } as DiagramNode
}

function syncSystemManagedNodes(nodes: DiagramNode[]): DiagramNode[] {
  const userNodes = nodes.filter(node => !isPublicInternetComponent(node.data))
  if (userNodes.length === 0) return userNodes

  const existingInternet = nodes.find(node => isPublicInternetComponent(node.data))
  return [normalizePublicInternetNode(existingInternet), ...userNodes]
}
