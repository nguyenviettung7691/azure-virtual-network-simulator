import type { AnyNetworkComponent } from '~/types/network'
import { NetworkComponentType } from '~/types/network'
import type { DiagramEdge } from '~/types/diagram'

export const useDiagram = () => {
  const diagramStore = useDiagramStore()

  const nodes = computed(() => diagramStore.nodes)
  const edges = computed(() => diagramStore.edges)
  const selectedNode = computed(() => diagramStore.selectedNode)
  const isDirty = computed(() => diagramStore.isDirty)

  function createComponent(type: NetworkComponentType, formData: Record<string, any>) {
    const id = `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const component = {
      id,
      type,
      name: formData.name || `New ${type}`,
      description: formData.description || '',
      tags: formData.tags || {},
      createdAt: new Date().toISOString(),
      ...formData,
    }
    diagramStore.addNode(component as AnyNetworkComponent)
    return id
  }

  function connectNodes(sourceId: string, targetId: string, label?: string) {
    const edgeId = `edge-${sourceId}-${targetId}-${Date.now()}`
    const edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: 'network-edge',
      label: label || '',
    } as unknown as DiagramEdge
    diagramStore.addEdge(edge)
  }

  return {
    nodes,
    edges,
    selectedNode,
    isDirty,
    createComponent,
    connectNodes,
    addNode: diagramStore.addNode.bind(diagramStore),
    updateNode: diagramStore.updateNode.bind(diagramStore),
    removeNode: diagramStore.removeNode.bind(diagramStore),
    addEdge: diagramStore.addEdge.bind(diagramStore),
    removeEdge: diagramStore.removeEdge.bind(diagramStore),
    setSelectedNode: diagramStore.setSelectedNode.bind(diagramStore),
    loadDiagram: diagramStore.loadDiagram.bind(diagramStore),
    resetDiagram: diagramStore.resetDiagram.bind(diagramStore),
    openAddComponentModal: diagramStore.openAddComponentModal.bind(diagramStore),
    openEditComponentModal: diagramStore.openEditComponentModal.bind(diagramStore),
    confirmAction: diagramStore.confirmAction.bind(diagramStore),
    autoLayout: diagramStore.autoLayout.bind(diagramStore),
  }
}
