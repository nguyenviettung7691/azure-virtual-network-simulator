export const useTests = () => {
  const testsStore = useTestsStore()
  const diagramStore = useDiagramStore()

  async function runAllTests() {
    await testsStore.runAllTests(diagramStore.nodes, diagramStore.edges)
  }

  async function runTest(testId: string) {
    await testsStore.runTest(testId, diagramStore.nodes, diagramStore.edges)
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // Auto-run tests only when the diagram is explicitly loaded or imported
  watch(
    () => diagramStore.diagramLoadId,
    async (newVal, oldVal) => {
      if (newVal === oldVal || newVal === 0) return
      if (testsStore.consumeNextDiagramLoadAutoRunSkip()) return
      if (testsStore.autoRunEnabled && testsStore.tests.length > 0 && !testsStore.isRunning) {
        await runAllTests()
      }
    }
  )

  // Challenge evaluation still reacts to structural diagram changes
  watch(
    () => [diagramStore.nodes.length, diagramStore.edges.length],
    () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        const challengesStore = useChallengesStore()
        if (challengesStore.currentChallenge) {
          challengesStore.evaluateCompletion(diagramStore.nodes, diagramStore.edges)
        }
      }, 500)
    }
  )

  onUnmounted(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  })

  return {
    tests: computed(() => testsStore.tests),
    isRunning: computed(() => testsStore.isRunning),
    testSummary: computed(() => testsStore.testSummary),
    passedTests: computed(() => testsStore.passedTests),
    failedTests: computed(() => testsStore.failedTests),
    runAllTests,
    runTest,
    addTest: testsStore.addTest.bind(testsStore),
    removeTest: testsStore.removeTest.bind(testsStore),
    openAddTestModal: testsStore.openAddTestModal.bind(testsStore),
    openEditTestModal: testsStore.openEditTestModal.bind(testsStore),
  }
}
