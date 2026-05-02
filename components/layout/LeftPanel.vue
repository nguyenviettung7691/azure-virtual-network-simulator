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
        <Button icon="pi pi-plus" label="Add Test" size="small" class="add-test-btn" @click="testsStore.openAddTestModal()" />
        <div class="action-row">
          <Button
            icon="pi pi-play"
            label="Run All"
            size="small"
            severity="success"
            class="half-btn"
            :loading="testsStore.isRunning"
            :disabled="testsStore.tests.length === 0"
            @click="runAll"
          />
          <Button
            icon="pi pi-trash"
            label="Delete All"
            size="small"
            severity="danger"
            class="half-btn"
            :disabled="testsStore.tests.length === 0"
            @click="deleteAllTests"
          />
        </div>
      </div>

      <div class="test-summary" v-if="testsStore.tests.length > 0">
        <div class="test-summary-row">
          <Tag :value="`${testsStore.testSummary.passed} Pass`" severity="success" />
          <Tag :value="`${testsStore.testSummary.failed} Fail`" severity="danger" />
          <Tag :value="`${testsStore.testSummary.warning} Warning`" severity="warn" />
        </div>
        <div class="test-summary-row total-row">
          <Tag :value="`${testsStore.testSummary.total} Total`" severity="secondary" />
        </div>
      </div>

      <div v-if="testsStore.tests.length === 0" class="empty-state">
        <Icon icon="mdi:test-tube-empty" class="empty-icon" />
        <p>No tests yet</p>
        <small>Add connection, load balance, or DNS tests</small>
      </div>

      <div v-else class="test-groups">
        <Accordion v-model:value="expandedTestGroups" multiple>
          <AccordionPanel v-for="group in groupedTests" :key="group.type" :value="group.type">
            <AccordionHeader>
              <div class="test-group-title">
                <Icon :icon="getTestIcon(group.type)" class="test-type-icon" />
                <span class="test-group-label">{{ getTestTypeLabel(group.type) }} [{{ group.tests.length }}]</span>
              </div>
            </AccordionHeader>
            <AccordionContent>
              <div class="test-list">
                <div v-for="test in group.tests" :key="test.id" class="test-item">
                  <div class="test-header-row">
                    <div class="test-info">
                      <span class="test-name">{{ test.name }}</span>
                    </div>
                  </div>
                  <div class="test-footer-row">
                    <div class="test-status">
                      <Tag
                        v-if="test.result"
                        :value="test.result.status.toUpperCase()"
                        :severity="getResultSeverity(test.result.status)"
                        class="result-tag"
                      />
                      <span v-else class="result-pending">Pending</span>
                    </div>
                    <div class="test-actions">
                      <Button
                        :icon="test.result?.status === 'running' ? 'pi pi-spinner pi-spin' : 'pi pi-play'"
                        text
                        size="small"
                        class="run-test-btn"
                        v-tooltip="'Run test'"
                        @click="runTest(test.id)"
                      />
                      <Button
                        v-if="test.type === 'connection' || test.type === 'loadbalance' || test.type === 'dns'"
                        text
                        size="small"
                        class="run-animation-btn"
                        :disabled="isRunAnimationDisabled(test)"
                        v-tooltip="'Run animation'"
                        @click="runAnimation(test)"
                      >
                        <template #icon>
                          <Icon icon="mdi:paper-plane-outline" />
                        </template>
                      </Button>
                      <Button icon="pi pi-pencil" text size="small" v-tooltip="'Edit'" @click="testsStore.openEditTestModal(test)" />
                      <Button icon="pi pi-trash" text size="small" severity="danger" v-tooltip="'Delete'" @click="removeTest(test.id)" />
                    </div>
                  </div>
                  <div class="result-message-wrap" v-if="test.result?.message">
                    <span class="result-message">{{ test.result.message }}</span>
                  </div>
                  <ul v-if="getResultDetails(test).length > 0" class="result-details">
                    <li v-for="detail in getResultDetails(test)" :key="detail" class="result-detail">{{ detail }}</li>
                  </ul>
                  <div class="test-flowchart" v-if="getFlowPath(test).length > 0">
                    <template v-for="(fnode, ni) in getFlowPath(test)" :key="ni">
                      <div class="flow-node">
                        <div class="flow-node-icon-wrap">
                          <Icon :icon="fnode.icon" :class="['flow-node-icon', { 'fni-blocked': fnode.blocked, 'fni-success': fnode.success, 'fni-warning': fnode.warning }]" />
                          <Icon v-if="fnode.blocked" icon="mdi:close-circle" class="flow-blocked-badge" />
                          <Icon v-if="fnode.success" icon="mdi:check-circle" class="flow-success-badge" />
                          <Icon v-if="fnode.warning" icon="mdi:alert-circle" class="flow-warning-badge" />
                        </div>
                        <span class="flow-node-label">{{ fnode.label }}</span>
                      </div>
                      <Icon v-if="ni < getFlowPath(test).length - 1" icon="mdi:arrow-right-thin" class="flow-arrow" />
                    </template>
                  </div>
                  <div class="test-meta" v-if="test.result?.latencyMs">
                    <small>Latency: {{ test.result.latencyMs }}ms</small>
                    <small v-if="test.result.hopCount">Hops: {{ test.result.hopCount }}</small>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NetworkComponentType, getComponentIcon } from '~/types/network'
import { INTERNET_SOURCE_ID } from '~/types/test'
import type { NetworkTest, TestType } from '~/types/test'

const testsStore = useTestsStore()
const diagramStore = useDiagramStore()

const TEST_TYPE_ORDER: TestType[] = ['connection', 'loadbalance', 'dns']

const isCollapsed = computed({
  get: () => useSettingsStore().sidebarCollapsed,
  set: (v) => useSettingsStore().updateSettings({ sidebarCollapsed: v }),
})

const expandedTestGroups = ref<TestType[]>([...TEST_TYPE_ORDER])

const groupedTests = computed(() =>
  TEST_TYPE_ORDER
    .map(type => ({
      type,
      tests: testsStore.tests.filter(test => test.type === type),
    }))
    .filter(group => group.tests.length > 0)
)

function toggle() { isCollapsed.value = !isCollapsed.value }

function getTestIcon(type: TestType) {
  const icons: Record<TestType, string> = {
    connection: 'mdi:connection',
    loadbalance: 'mdi:scale-balance',
    dns: 'mdi:dns',
  }
  return icons[type]
}

function getTestTypeLabel(type: TestType) {
  const labels: Record<TestType, string> = {
    connection: 'Connection',
    loadbalance: 'Load Balance',
    dns: 'DNS',
  }
  return labels[type]
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

async function runAnimation(test: NetworkTest) {
  if (isRunAnimationDisabled(test)) return

  const result = await testsStore.runTest(test.id, diagramStore.nodes, diagramStore.edges)
  if (!result?.path || result.path.length < 2) return

  // Load-balance: animate source → LB first, then fan out to all backend VMs simultaneously
  if (test.type === 'loadbalance') {
    const path = result.path  // [sourceId, lbId, vm1Id, vm2Id, ...]
    const sourceId = path[0]
    const lbId = path[1]
    const backendIds: string[] = path.slice(2)

    // Phase 1: source → LB
    const phase1ok = await diagramStore.playConnectionAnimation({
      testId: test.id,
      path: [sourceId, lbId],
      resultState: toAnimationResultState(result.status),
    })
    if (!phase1ok || diagramStore.viewMode !== 'animation') return

    // Short pause between phases so the LB landing is visible
    await new Promise(r => setTimeout(r, 200))
    if (diagramStore.viewMode !== 'animation') return

    // Phase 2: LB → all backend VMs simultaneously
    if (backendIds.length > 0) {
      await diagramStore.playParallelSegments({
        testId: test.id,
        segments: backendIds.map(vmId => [lbId, vmId] as [string, string]),
        resultState: toAnimationResultState(result.status),
      })
    }
    return
  }

  // DNS: resolve IP addresses in path to actual node IDs, drop unresolvable entries
  if (test.type === 'dns') {
    const resolvedPath = result.path.map((idOrIp: string) => {
      if (idOrIp === 'Internet' || idOrIp === 'DNS Client') return idOrIp
      if (diagramStore.nodes.some(n => n.id === idOrIp)) return idOrIp
      const nodeByIp = diagramStore.nodes.find(n =>
        (n.data as any)?.privateIpAddress === idOrIp || (n.data as any)?.ipAddress === idOrIp
      )
      return nodeByIp?.id ?? null
    }).filter((id): id is string => id !== null)
    if (resolvedPath.length < 2) return
    await diagramStore.playConnectionAnimation({
      testId: test.id,
      path: resolvedPath,
      resultState: toAnimationResultState(result.status),
    })
    return
  }

  // Default (connection test)
  await diagramStore.playConnectionAnimation({
    testId: test.id,
    path: result.path,
    resultState: toAnimationResultState(result.status),
  })
}

async function runAll() {
  await testsStore.runAllTests(diagramStore.nodes, diagramStore.edges)
}

function isRunAnimationDisabled(test: NetworkTest) {
  return diagramStore.viewMode === 'animation'
    || testsStore.isRunning
    || test.result?.status === 'running'
}

function toAnimationResultState(status: string): 'pass' | 'fail' | 'warning' {
  if (status === 'fail') return 'fail'
  if (status === 'warning') return 'warning'
  return 'pass'
}

function removeTest(id: string) {
  diagramStore.confirmAction('Remove this test?', () => testsStore.removeTest(id))
}

interface FlowNode {
  label: string
  icon: string
  blocked?: boolean
  success?: boolean
  warning?: boolean
}

function resolveFlowItem(idOrLabel: string): FlowNode {
  const node = diagramStore.nodes.find(n => n.id === idOrLabel)
  if (node) return { label: node.data.name, icon: getComponentIcon(node.data.type) }
  if (idOrLabel === 'Internet') return { label: 'Internet', icon: 'mdi:web' }
  if (idOrLabel === 'DNS Client') return { label: 'DNS Client', icon: 'mdi:dns' }
  if (idOrLabel.startsWith('Backends:')) return { label: idOrLabel.slice('Backends:'.length).trim(), icon: 'mdi:server-network' }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(idOrLabel) || /^[0-9a-f:]+$/i.test(idOrLabel)) {
    return { label: idOrLabel, icon: 'mdi:ip-network' }
  }
  if (idOrLabel.startsWith('NSG:')) return { label: idOrLabel, icon: 'mdi:shield-check' }
  return { label: idOrLabel, icon: 'mdi:server' }
}

function getResultDetails(test: NetworkTest) {
  return test.result?.details?.filter(Boolean) || []
}

function getFlowPath(test: NetworkTest): FlowNode[] {
  const result = test.result
  if (!result || result.status === 'running' || result.status === 'pending') return []

  if (test.type === 'connection') {
    if (result.path && result.path.length >= 2) {
      const flowNodes = result.path.map(resolveFlowItem)
      if (result.status === 'fail') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], blocked: true }
      } else if (result.status === 'pass') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], success: true }
      } else if (result.status === 'warning') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], warning: true }
      }
      return flowNodes
    }
    const srcIsInternet = test.condition.sourceId === INTERNET_SOURCE_ID
    const srcName = srcIsInternet
      ? 'Internet'
      : (diagramStore.nodes.find(n => n.id === test.condition.sourceId)?.data?.name ?? test.condition.sourceId.substring(0, 8))
    const tgtName = diagramStore.nodes.find(n => n.id === test.condition.targetId)?.data?.name
      ?? test.condition.targetId.substring(0, 8)
    return [
      { label: srcName, icon: srcIsInternet ? 'mdi:web' : 'mdi:laptop' },
      { label: tgtName, icon: 'mdi:server' },
    ]
  }

  if (test.type === 'loadbalance') {
    if (result.path && result.path.length >= 2) {
      const flowNodes = result.path.map(resolveFlowItem)
      if (result.status === 'fail') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], blocked: true }
      } else if (result.status === 'pass') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], success: true }
      } else if (result.status === 'warning') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], warning: true }
      }
      return flowNodes
    }

    const lbId = test.condition.targetId
    const lbNode = diagramStore.nodes.find(n => n.id === lbId)
    const backends = (diagramStore.edges as any[])
      .filter((e: any) => e.source === lbId || e.target === lbId)
      .map((e: any) => diagramStore.nodes.find(n => n.id === (e.source === lbId ? e.target : e.source)))
      .filter((n: any) => n?.data?.type === NetworkComponentType.VM || n?.data?.type === NetworkComponentType.VMSS)
    const flowNodes: FlowNode[] = []
    if (test.condition.sourceId === INTERNET_SOURCE_ID) {
      flowNodes.push({ label: 'Internet', icon: 'mdi:web' })
    } else if (test.condition.sourceId) {
      flowNodes.push({ label: diagramStore.nodes.find(n => n.id === test.condition.sourceId)?.data?.name ?? 'Client', icon: 'mdi:laptop' })
    }
    if (lbNode) flowNodes.push({ label: lbNode.data.name, icon: 'mdi:scale-balance' })
    if (backends.length > 0) {
      const names = backends.slice(0, 2).map((n: any) => n.data.name).join(', ')
      const lastNode: FlowNode = { label: names + (backends.length > 2 ? ` +${backends.length - 2}` : ''), icon: 'mdi:server-network' }
      if (result.status === 'fail') flowNodes.push({ ...lastNode, blocked: true })
      else if (result.status === 'pass') flowNodes.push({ ...lastNode, success: true })
      else if (result.status === 'warning') flowNodes.push({ ...lastNode, warning: true })
      else flowNodes.push(lastNode)
    }
    return flowNodes
  }

  if (test.type === 'dns') {
    if (result.path && result.path.length >= 2) {
      const flowNodes = result.path.map(resolveFlowItem)
      if (result.status === 'fail') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], blocked: true }
      } else if (result.status === 'pass') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], success: true }
      } else if (result.status === 'warning') {
        flowNodes[flowNodes.length - 1] = { ...flowNodes[flowNodes.length - 1], warning: true }
      }
      return flowNodes
    }

    const dnsNode = test.condition.targetId
      ? diagramStore.nodes.find(n => n.id === test.condition.targetId)
      : diagramStore.nodes.find(n => n.data?.type === NetworkComponentType.DNS_ZONE)
    const flowNodes: FlowNode[] = [{ label: 'DNS Client', icon: 'mdi:dns' }]
    if (dnsNode) flowNodes.push({ label: (dnsNode.data as any).zoneName || dnsNode.data.name, icon: 'mdi:domain' })
    const ipMatch = result.message?.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
    const lastDnsNode: FlowNode = ipMatch ? { label: ipMatch[0], icon: 'mdi:ip-network' } : { label: 'Resolved', icon: 'mdi:check-circle' }
    if (result.status === 'fail') flowNodes.push({ ...lastDnsNode, blocked: true })
    else if (result.status === 'pass') flowNodes.push({ ...lastDnsNode, success: true })
    else if (result.status === 'warning') flowNodes.push({ ...lastDnsNode, warning: true })
    else flowNodes.push(lastDnsNode)
    return flowNodes
  }

  return []
}

function deleteAllTests() {
  diagramStore.confirmAction(
    'This will permanently delete all network tests. Are you sure?',
    () => testsStore.clearAllTests()
  )
}

</script>

<style scoped>
.left-panel {
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
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
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  background: var(--surface-alt);
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
  color: var(--text-muted);
}

.panel-icon { font-size: 1rem; color: var(--primary); }

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
  flex-direction: column;
  gap: 0.4rem;
}

.add-test-btn {
  width: 100%;
  justify-content: center;
}

.action-row {
  display: flex;
  gap: 0.4rem;
}

.half-btn {
  flex: 1;
  justify-content: center;
}

.test-summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.test-summary-row {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  justify-content: center;
}

.total-row {
  justify-content: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 0.5rem;
  text-align: center;
  color: var(--text-muted);
  gap: 0.3rem;
}

.empty-icon { font-size: 2rem; opacity: 0.4; }

.test-groups {
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;
  min-width: 0;
}

.test-groups :deep(.p-accordion) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
}

.test-groups :deep(.p-accordionpanel) {
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.test-groups :deep(.p-accordionheader) {
  background: var(--surface-alt);
  min-width: 0;
}

.test-groups :deep(.p-accordionheader-link) {
  width: 100%;
  min-width: 0;
}

/* PrimeVue uses display:grid on p-accordioncontent for its open/close animation
   (grid-template-rows: 0fr → 1fr). Without an explicit column constraint the single
   grid column defaults to auto (= content width), which blows the wrapper out to the
   natural width of the test cards. Force the column to be bounded instead. */
.test-groups :deep(.p-accordioncontent) {
  overflow: hidden;
  min-width: 0;
  /* bind the implicit grid column so it never exceeds the parent */
  grid-template-columns: minmax(0, 1fr);
}

.test-groups :deep(.p-accordioncontent-wrapper) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.test-groups :deep(.p-accordioncontent-content) {
  padding: 0.5rem;
  background: transparent;
  min-width: 0;
  overflow-x: hidden;
  box-sizing: border-box;
  width: 100%;
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.test-group-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  min-width: 0;
}

.test-group-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.test-item {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-left: 3px solid var(--primary);
  border-radius: 6px;
  padding: 0.5rem 0.5rem 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition: box-shadow 0.15s ease, border-left-color 0.15s ease;
  min-width: 0;
  box-sizing: border-box;
}

.test-item:hover {
  box-shadow: 0 2px 8px var(--shadow-md);
}

.test-header-row {
  display: flex;
  align-items: center;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--border);
  min-width: 0;
}

.test-info {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.test-type-icon { font-size: 0.9rem; color: var(--primary); flex-shrink: 0; }

.test-name {
  font-size: 0.8rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.test-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  padding-top: 0.15rem;
  min-width: 0;
}

.test-status {
  display: flex;
  align-items: center;
}

.result-pending {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  opacity: 0.7;
}

.result-tag {
  font-size: 0.7rem;
  font-weight: 700;
}

.test-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
}

.run-test-btn:hover {
  color: var(--success) !important;
  background-color: rgba(16, 124, 16, 0.1) !important;
}

.run-animation-btn:hover {
  color: var(--primary) !important;
  background-color: rgba(15, 108, 189, 0.1) !important;
}

.result-message-wrap {
  padding: 0.15rem 0.1rem 0;
  min-width: 0;
}

.result-message {
  font-size: 0.72rem;
  color: var(--text-muted);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.result-details {
  margin: 0;
  padding: 0 0 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.result-detail {
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.35;
}

.test-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.7rem;
  color: var(--text-muted);
  padding-top: 0.1rem;
  min-width: 0;
  flex-wrap: wrap;
}

.test-flowchart {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0.3rem 0.4rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 40px;
  max-width: 68px;
  flex-shrink: 0;
}

.flow-node-icon {
  font-size: 1.05rem;
  color: var(--primary);
}

.flow-node-icon-wrap {
  position: relative;
  display: inline-flex;
  justify-content: center;
}

.fni-blocked {
  color: var(--danger) !important;
}

.fni-success {
  color: var(--success) !important;
}

.fni-warning {
  color: var(--yellow-500) !important;
}

.flow-blocked-badge {
  position: absolute;
  bottom: -3px;
  right: -6px;
  font-size: 0.65rem;
  color: var(--danger);
  line-height: 1;
}

.flow-success-badge {
  position: absolute;
  bottom: -3px;
  right: -6px;
  font-size: 0.65rem;
  color: var(--success);
  line-height: 1;
}

.flow-warning-badge {
  position: absolute;
  bottom: -3px;
  right: -6px;
  font-size: 0.65rem;
  color: var(--yellow-500);
  line-height: 1;
}

.flow-node-label {
  font-size: 0.58rem;
  font-weight: 500;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 68px;
}

.flow-arrow {
  font-size: 1rem;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.6;
}
</style>
