import { defineStore } from 'pinia'
import type { DiagramNode, DiagramEdge, DiagramState } from '~/types/diagram'
import type { AnyNetworkComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import { applyDagreLayout } from '~/lib/dagre'

// DiagramEdge extends a union type (Edge from @vue-flow/core), so we use this
// minimal intersection type to safely access common edge properties.
type EdgeBase = { id: string; source: string; target: string }

interface DiagramStoreState {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  selectedNodeId: string | null
  isDirty: boolean
  viewport: { x: number; y: number; zoom: number }
  showComponentModal: boolean
  editingComponent: AnyNetworkComponent | null
  addingComponentType: NetworkComponentType | null
  showConfirmDialog: boolean
  confirmDialogMessage: string
  confirmDialogAction: (() => void) | null
}

export const useDiagramStore = defineStore('diagram', {
  state: (): DiagramStoreState => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    isDirty: false,
    viewport: { x: 0, y: 0, zoom: 1 },
    showComponentModal: false,
    editingComponent: null,
    addingComponentType: null,
    showConfirmDialog: false,
    confirmDialogMessage: '',
    confirmDialogAction: null,
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
      const node: DiagramNode = {
        id: component.id,
        type: getNodeType(component.type),
        position: position || getDefaultPosition(this.nodes.length),
        data: component,
        width: getNodeWidth(component.type),
        height: getNodeHeight(component.type),
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – DiagramNode extends a deeply generic vue-flow type; TS depth limit hit
      this.nodes = [...this.nodes, node]
      this.isDirty = true
      this.autoLayout()
    },

    updateNode(id: string, updates: Partial<AnyNetworkComponent>) {
      const idx = this.nodes.findIndex(n => n.id === id)
      if (idx === -1) return
      const updatedComponent = { ...this.nodes[idx].data, ...updates } as AnyNetworkComponent
      this.nodes[idx] = { ...this.nodes[idx], data: updatedComponent }
      this.nodes = [...this.nodes]
      this.isDirty = true
    },

    removeNode(id: string) {
      this.nodes = this.nodes.filter(n => n.id !== id)
      this.edges = (this.edges as unknown as EdgeBase[]).filter(
        e => e.source !== id && e.target !== id
      ) as unknown as DiagramEdge[]
      if (this.selectedNodeId === id) this.selectedNodeId = null
      this.isDirty = true
    },

    addEdge(edge: DiagramEdge) {
      const e = edge as unknown as EdgeBase
      const exists = (this.edges as unknown as EdgeBase[]).some(
        ex => ex.source === e.source && ex.target === e.target
      )
      if (!exists) {
        this.edges = [...this.edges, edge]
        this.isDirty = true
      }
    },

    updateEdge(id: string, updates: Partial<DiagramEdge>) {
      const idx = (this.edges as unknown as EdgeBase[]).findIndex(e => e.id === id)
      if (idx === -1) return
      this.edges[idx] = { ...this.edges[idx], ...updates }
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
      this.nodes = state.nodes
      this.edges = state.edges
      this.viewport = state.viewport
      this.isDirty = false
      this.selectedNodeId = null
    },

    resetDiagram() {
      this.nodes = []
      this.edges = []
      this.selectedNodeId = null
      this.isDirty = false
      this.viewport = { x: 0, y: 0, zoom: 1 }
    },

    autoLayout() {
      if (this.nodes.length === 0) return
      this.nodes = applyDagreLayout([...this.nodes], [...this.edges])
    },

    openAddComponentModal(type: NetworkComponentType) {
      this.addingComponentType = type
      this.editingComponent = null
      this.showComponentModal = true
    },

    openEditComponentModal(component: AnyNetworkComponent) {
      this.editingComponent = { ...component } as AnyNetworkComponent
      this.addingComponentType = null
      this.showComponentModal = true
    },

    closeComponentModal() {
      this.showComponentModal = false
      this.editingComponent = null
      this.addingComponentType = null
    },

    confirmAction(message: string, action: () => void) {
      this.confirmDialogMessage = message
      this.confirmDialogAction = action
      this.showConfirmDialog = true
    },

    executeConfirmedAction() {
      if (this.confirmDialogAction) this.confirmDialogAction()
      this.showConfirmDialog = false
      this.confirmDialogAction = null
    },

    cancelConfirmDialog() {
      this.showConfirmDialog = false
      this.confirmDialogAction = null
    },

    setViewport(viewport: { x: number; y: number; zoom: number }) {
      this.viewport = viewport
    },
  },
})

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
  }
  return typeMap[componentType] || 'compute-node'
}

function getNodeWidth(type: NetworkComponentType): number {
  if (type === NetworkComponentType.VNET) return 400
  if (type === NetworkComponentType.SUBNET) return 300
  return 180
}

function getNodeHeight(type: NetworkComponentType): number {
  if (type === NetworkComponentType.VNET) return 300
  if (type === NetworkComponentType.SUBNET) return 200
  return 80
}

function getDefaultPosition(index: number): { x: number; y: number } {
  const cols = 4
  const col = index % cols
  const row = Math.floor(index / cols)
  return { x: 100 + col * 220, y: 100 + row * 120 }
}
