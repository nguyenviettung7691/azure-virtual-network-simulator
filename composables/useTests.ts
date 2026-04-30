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

  watch(
    () => [diagramStore.nodes.length, diagramStore.edges.length],
    async () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        debounceTimer = null
        if (testsStore.autoRunEnabled && testsStore.tests.length > 0 && !testsStore.isRunning) {
          await runAllTests()
        }
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
