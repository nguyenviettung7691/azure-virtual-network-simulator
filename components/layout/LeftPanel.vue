<template>
  <aside class="left-panel" :class="{ collapsed: isCollapsed }">
    <div class="panel-header" @click="toggle">
      <div class="panel-title">
        <Icon icon="mdi:test-tube" class="panel-icon" />
        <span v-if="!isCollapsed">Network Tests</span>
      </div>
      <Button :icon="isCollapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-left'" text size="small" class="collapse-btn" />
    </div>

    <div v-if="!isCollapsed" class="panel-body">
      <div class="panel-actions">
        <Button icon="pi pi-plus" label="Add Test" size="small" @click="testsStore.openAddTestModal()" />
        <Button
          icon="pi pi-play"
          label="Run All"
          size="small"
          severity="secondary"
          :loading="testsStore.isRunning"
          :disabled="testsStore.tests.length === 0"
          @click="runAll"
        />
      </div>

      <div class="test-summary" v-if="testsStore.tests.length > 0">
        <Tag :value="`${testsStore.testSummary.passed} Pass`" severity="success" />
        <Tag :value="`${testsStore.testSummary.failed} Fail`" severity="danger" />
        <Tag :value="`${testsStore.testSummary.pending} Pending`" severity="secondary" />
      </div>

      <div v-if="testsStore.tests.length === 0" class="empty-state">
        <Icon icon="mdi:test-tube-empty" class="empty-icon" />
        <p>No tests yet</p>
        <small>Add connection, load balance, security, or DNS tests</small>
      </div>

      <div class="test-list">
        <div v-for="test in testsStore.tests" :key="test.id" class="test-item">
          <div class="test-header-row">
            <div class="test-info">
              <Icon :icon="getTestIcon(test.type)" class="test-type-icon" />
              <span class="test-name">{{ test.name }}</span>
            </div>
            <div class="test-actions">
              <Button
                :icon="test.result?.status === 'running' ? 'pi pi-spinner pi-spin' : 'pi pi-play'"
                text
                size="small"
                v-tooltip="'Run test'"
                @click="runTest(test.id)"
              />
              <Button icon="pi pi-pencil" text size="small" v-tooltip="'Edit'" @click="testsStore.openEditTestModal(test)" />
              <Button icon="pi pi-trash" text size="small" severity="danger" v-tooltip="'Delete'" @click="removeTest(test.id)" />
            </div>
          </div>
          <div class="test-result" v-if="test.result">
            <Tag
              :value="test.result.status"
              :severity="getResultSeverity(test.result.status)"
              class="result-tag"
            />
            <span class="result-message">{{ test.result.message }}</span>
          </div>
          <div class="test-meta" v-if="test.result?.latencyMs">
            <small>Latency: {{ test.result.latencyMs }}ms</small>
            <small v-if="test.result.hopCount">Hops: {{ test.result.hopCount }}</small>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const testsStore = useTestsStore()
const diagramStore = useDiagramStore()

const isCollapsed = computed({
  get: () => useSettingsStore().sidebarCollapsed,
  set: (v) => useSettingsStore().updateSettings({ sidebarCollapsed: v }),
})

function toggle() { isCollapsed.value = !isCollapsed.value }

function getTestIcon(type: string) {
  const icons: Record<string, string> = {
    connection: 'mdi:connection',
    loadbalance: 'mdi:scale-balance',
    security: 'mdi:shield-check',
    dns: 'mdi:dns',
  }
  return icons[type] || 'mdi:test-tube'
}

function getResultSeverity(status: string) {
  if (status === 'pass') return 'success'
  if (status === 'fail') return 'danger'
  if (status === 'warning') return 'warn'
  if (status === 'running') return 'info'
  return 'secondary'
}

async function runTest(id: string) {
  await testsStore.runTest(id, diagramStore.nodes, diagramStore.edges)
}

async function runAll() {
  await testsStore.runAllTests(diagramStore.nodes, diagramStore.edges)
}

function removeTest(id: string) {
  diagramStore.confirmAction('Remove this test?', () => testsStore.removeTest(id))
}

// Auto-run tests on diagram changes
watch(
  () => [diagramStore.nodes.length, diagramStore.edges.length],
  () => {
    if (testsStore.autoRunEnabled && testsStore.tests.length > 0) {
      testsStore.runAllTests(diagramStore.nodes, diagramStore.edges)
    }
  }
)
</script>

<style scoped>
.left-panel {
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  transition: width 0.25s ease, min-width 0.25s ease;
  overflow: hidden;
  z-index: 10;
}

.left-panel.collapsed {
  width: 40px;
  min-width: 40px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.5rem;
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
  background: var(--surface-section);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-color-secondary);
}

.panel-icon { font-size: 1rem; color: var(--primary-color); }

.collapse-btn { flex-shrink: 0; }

.panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0.5rem;
  gap: 0.5rem;
}

.panel-actions {
  display: flex;
  gap: 0.4rem;
}

.test-summary {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 0.5rem;
  text-align: center;
  color: var(--text-color-secondary);
  gap: 0.3rem;
}

.empty-icon { font-size: 2rem; opacity: 0.4; }

.test-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.test-item {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.test-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.test-info {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  overflow: hidden;
}

.test-type-icon { font-size: 0.9rem; color: var(--primary-color); flex-shrink: 0; }

.test-name {
  font-size: 0.8rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.test-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
}

.test-result {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
}

.result-tag { font-size: 0.65rem; }

.result-message {
  font-size: 0.72rem;
  color: var(--text-color-secondary);
  line-height: 1.3;
}

.test-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}
</style>
