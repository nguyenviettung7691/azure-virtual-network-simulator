<template>
  <NuxtPage />
</template>

<script setup lang="ts">
import { configureAWS } from '~/lib/aws'
import type { DiagramState } from '~/types/diagram'
import type { NetworkTest } from '~/types/test'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const diagramStore = useDiagramStore()
const testsStore = useTestsStore()
const awsReady = ref(false)
const currentUserQuery = useCurrentUserQuery(awsReady)

useSettingsSync(awsReady)

const LOCAL_WORKSPACE_KEY = 'vnet-workspace-v1'

interface LocalWorkspaceSnapshot {
  version: 1
  savedAt: string
  diagram: DiagramState
  tests: NetworkTest[]
}

const latestWorkspaceSnapshot = ref<string | null>(null)
let workspaceAutoSaveTimer: ReturnType<typeof setInterval> | null = null

watch(
  [() => currentUserQuery.data.value, () => currentUserQuery.isFetched.value],
  ([user, isFetched]) => {
    if (!isFetched) {
      return
    }

    if (user) {
      authStore.hydrateUser(user)
      settingsStore.setCurrentUser(user.userId)

      return
    }

    authStore.clearUser()
  },
  { immediate: true },
)

watch(
  () => currentUserQuery.isPending.value,
  (isPending) => {
    authStore.setLoading(awsReady.value && isPending)
  },
  { immediate: true },
)

watch(
  [() => settingsStore.autoSave, () => settingsStore.autoSaveInterval],
  () => {
    restartWorkspaceAutoSave()
  },
  { immediate: true },
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDiagramState(value: unknown): value is DiagramState {
  if (!isRecord(value)) return false
  const candidate = value as DiagramState
  return Array.isArray(candidate.nodes)
    && Array.isArray(candidate.edges)
    && isRecord(candidate.viewport)
    && typeof candidate.viewport.x === 'number'
    && typeof candidate.viewport.y === 'number'
    && typeof candidate.viewport.zoom === 'number'
}

function createWorkspaceSnapshot(): LocalWorkspaceSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    diagram: diagramStore.diagramState,
    tests: testsStore.tests.map(test => ({ ...test })),
  }
}

function persistWorkspaceSnapshot(force = false) {
  if (typeof localStorage === 'undefined') return

  settingsStore.setLastAutoSaveAttemptTime()

  const serialized = JSON.stringify(createWorkspaceSnapshot())
  if (!force && latestWorkspaceSnapshot.value === serialized) {
    return
  }

  localStorage.setItem(LOCAL_WORKSPACE_KEY, serialized)
  latestWorkspaceSnapshot.value = serialized
  settingsStore.setLastAutoSaveTime()
}

function restoreWorkspaceSnapshot() {
  if (typeof localStorage === 'undefined') return

  const raw = localStorage.getItem(LOCAL_WORKSPACE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as Partial<LocalWorkspaceSnapshot>
    if (!isDiagramState(parsed.diagram)) return

    diagramStore.loadDiagram(parsed.diagram)
    testsStore.replaceTests(Array.isArray(parsed.tests) ? parsed.tests : [])
    latestWorkspaceSnapshot.value = JSON.stringify({
      version: 1,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      diagram: parsed.diagram,
      tests: Array.isArray(parsed.tests) ? parsed.tests : [],
    } satisfies LocalWorkspaceSnapshot)
  } catch {
    // Ignore malformed local workspace snapshots.
  }
}

function clearWorkspaceAutoSaveTimer() {
  if (workspaceAutoSaveTimer !== null) {
    clearInterval(workspaceAutoSaveTimer)
    workspaceAutoSaveTimer = null
  }
}

function restartWorkspaceAutoSave() {
  clearWorkspaceAutoSaveTimer()
  if (!settingsStore.autoSave) return

  const intervalMs = Math.max(5000, Math.round(settingsStore.autoSaveInterval * 1000))
  workspaceAutoSaveTimer = setInterval(() => {
    persistWorkspaceSnapshot()
  }, intervalMs)
}

function handleBeforeUnload() {
  persistWorkspaceSnapshot(true)
}

onMounted(() => {
  configureAWS()
  settingsStore.loadFromLocalStorage()
  restoreWorkspaceSnapshot()
  restartWorkspaceAutoSave()
  window.addEventListener('beforeunload', handleBeforeUnload)
  awsReady.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  clearWorkspaceAutoSaveTimer()
})
</script>
