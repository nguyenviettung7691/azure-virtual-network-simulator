export const useAppLayout = () => {
  const diagramStore = useDiagramStore()

  function applyAutoLayout() {
    diagramStore.autoLayout()
  }

  return {
    applyAutoLayout,
  }
}
