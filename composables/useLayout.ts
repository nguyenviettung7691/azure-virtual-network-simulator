import { applyDagreLayout } from '~/lib/dagre'
import type { DiagramNode, DiagramEdge } from '~/types/diagram'

export const useLayout = () => {
  const diagramStore = useDiagramStore()

  function applyAutoLayout() {
    diagramStore.autoLayout()
  }

  return {
    applyAutoLayout,
  }
}
