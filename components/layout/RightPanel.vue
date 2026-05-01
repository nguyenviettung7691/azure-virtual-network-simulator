<template>
  <aside class="right-panel" :class="{ collapsed: isCollapsed }">
    <div class="panel-header" @click="toggle">
      <Button :icon="isCollapsed ? 'pi pi-chevron-left' : 'pi pi-chevron-right'" text size="small" class="collapse-btn" />
      <div class="panel-title" v-if="!isCollapsed">
        <Icon icon="mdi:information-outline" class="panel-icon" />
        <span>Network Summary</span>
      </div>
    </div>

    <div v-if="!isCollapsed" class="panel-body">
      <Accordion :multiple="true" :value="['components', 'connectivity']">
        <AccordionPanel value="components">
          <AccordionHeader>
            <div class="section-title">
              <Icon icon="mdi:vector-polygon" />
              Components ({{ summaryNodes.length }})
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div v-if="summaryNodes.length === 0" class="empty-section">No components added yet</div>
            <div v-else class="component-groups">
              <div v-for="group in groupedComponents" :key="group.type" class="component-group">
                <div class="group-header">
                  <Icon :icon="getIcon(group.type)" :style="{ color: getColor(group.type) }" class="group-type-icon" />
                  <span class="group-label">{{ getLabel(group.type) }}</span>
                  <Tag :value="String(group.nodes.length)" severity="info" />
                </div>
                <div class="component-list">
                  <div v-for="node in group.nodes" :key="node.id" class="component-row">
                    <span class="comp-name">{{ node.data.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="connectivity">
          <AccordionHeader>
            <div class="section-title">
              <Icon icon="mdi:transit-connection" />
              Connectivity ({{ diagramStore.edges.length }})
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div v-if="diagramStore.edges.length === 0" class="empty-section">No connections defined</div>
            <div v-else class="conn-table-wrap">
              <table class="conn-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="(group, gi) in groupedConnections" :key="group.targetId">
                    <tr v-for="(edge, i) in group.edges" :key="edge.id"
                        :class="[gi % 2 === 1 ? 'conn-group-alt' : '', i === 0 && gi > 0 ? 'conn-group-first' : '']">
                      <td class="conn-source-cell">
                        <div class="conn-cell-content">
                          <Icon v-if="getNodeType(edge.source)" :icon="getNodeIcon(edge.source)" :style="{ color: getNodeColor(edge.source) }" class="conn-cell-icon" v-tooltip="getNodeTypeLabel(edge.source)" />
                          <span>{{ getNodeName(edge.source) }}</span>
                        </div>
                      </td>
                      <td :rowspan="i === 0 ? group.edges.length : undefined" v-if="i === 0" class="conn-target-cell">
                        <div class="conn-cell-content">
                          <Icon v-if="getNodeType(group.targetId)" :icon="getNodeIcon(group.targetId)" :style="{ color: getNodeColor(group.targetId) }" class="conn-cell-icon" v-tooltip="getNodeTypeLabel(group.targetId)" />
                          <span>{{ group.targetName }}</span>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="security">
          <AccordionHeader>
            <div class="section-title">
              <Icon icon="mdi:shield-check" />
              Security
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="security-summary">
              <div class="security-row">
                <span class="sec-label">NSGs</span>
                <Tag :value="String(nsgCount)" severity="info" />
              </div>
              <div class="security-row">
                <span class="sec-label">Firewalls</span>
                <Tag :value="String(firewallCount)" severity="info" />
              </div>
              <div class="security-row">
                <span class="sec-label">ASGs</span>
                <Tag :value="String(asgCount)" severity="info" />
              </div>
              <div class="security-row" v-if="unsecuredSubnets.length > 0">
                <Icon icon="mdi:alert" class="sec-icon warn" />
                <span class="sec-label warn-text">{{ unsecuredSubnets.length }} subnet(s) without NSG</span>
              </div>
              <div class="security-row" v-else-if="summaryNodes.length > 0">
                <Icon icon="mdi:check-circle" class="sec-icon ok" />
                <span class="sec-label ok-text">All subnets protected</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="performance">
          <AccordionHeader>
            <div class="section-title">
              <Icon icon="mdi:speedometer" />
              Performance
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="perf-summary">
              <div class="perf-row">
                <span class="perf-label">Load Balancers</span>
                <Tag :value="String(lbCount)" severity="info" />
              </div>
              <div class="perf-row">
                <span class="perf-label">VPN Gateways</span>
                <Tag :value="String(vpnCount)" severity="info" />
              </div>
              <div class="perf-row">
                <span class="perf-label">App Gateways</span>
                <Tag :value="String(agCount)" severity="info" />
              </div>
              <div class="perf-row">
                <span class="perf-label">Compute Nodes</span>
                <Tag :value="String(computeCount)" severity="success" />
              </div>
              <div class="perf-row">
                <span class="perf-label">Storage Resources</span>
                <Tag :value="String(storageCount)" severity="secondary" />
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NetworkComponentType, getComponentIcon, getComponentLabel, getComponentColor } from '~/types/network'

const diagramStore = useDiagramStore()

const isCollapsed = computed({
  get: () => useSettingsStore().rightPanelCollapsed,
  set: (v) => useSettingsStore().updateSettings({ rightPanelCollapsed: v }),
})

function toggle() { isCollapsed.value = !isCollapsed.value }
function getIcon(type: NetworkComponentType) { return getComponentIcon(type) }
function getLabel(type: NetworkComponentType) { return getComponentLabel(type) }
function getColor(type: NetworkComponentType) { return getComponentColor(type) }

function getNodeName(id: string) {
  const node = diagramStore.nodes.find(n => n.id === id)
  return node?.data?.name || id.substring(0, 8)
}

function getNodeType(id: string): NetworkComponentType | null {
  return (diagramStore.nodes.find(n => n.id === id)?.data?.type as NetworkComponentType) ?? null
}

function getNodeIcon(id: string): string {
  const type = getNodeType(id)
  return type ? getIcon(type) : 'mdi:help-circle'
}

function getNodeColor(id: string): string {
  const type = getNodeType(id)
  return type ? getColor(type) : '#666666'
}

function getNodeTypeLabel(id: string): string {
  const type = getNodeType(id)
  return type ? getLabel(type) : ''
}

const summaryNodes = computed(() =>
  diagramStore.nodes.filter(node => node.data?.type !== NetworkComponentType.INTERNET)
)

const groupedComponents = computed(() => {
  const map = new Map<string, typeof diagramStore.nodes>()
  for (const node of summaryNodes.value) {
    const type = node.data.type as string
    if (!map.has(type)) map.set(type, [])
    map.get(type)!.push(node)
  }
  return [...map.entries()].map(([type, nodes]) => ({ type: type as NetworkComponentType, nodes }))
})

const groupedConnections = computed(() => {
  const map = new Map<string, any[]>()
  // Real edges from the store
  for (const edge of diagramStore.edges as any[]) {
    const target = edge.target as string
    if (!map.has(target)) map.set(target, [])
    map.get(target)!.push(edge)
  }
  // Also include containment relationships expressed via parentNode
  // (autoLayout removes those edges and sets parentNode instead)
  for (const node of diagramStore.nodes as any[]) {
    if (node.parentNode) {
      const virtualEdgeId = `containment-${node.id}`
      const target = node.parentNode as string
      const alreadyExists = (diagramStore.edges as any[]).some(
        (e: any) => e.source === node.id && e.target === target
      )
      if (!alreadyExists) {
        if (!map.has(target)) map.set(target, [])
        map.get(target)!.push({ id: virtualEdgeId, source: node.id, target })
      }
    }
  }
  return [...map.entries()].map(([targetId, edges]) => ({
    targetId,
    targetName: getNodeName(targetId),
    edges,
  }))
})

const nsgCount = computed(() => summaryNodes.value.filter(n => n.data?.type === NetworkComponentType.NSG).length)
const firewallCount = computed(() => summaryNodes.value.filter(n => n.data?.type === NetworkComponentType.FIREWALL).length)
const asgCount = computed(() => summaryNodes.value.filter(n => n.data?.type === NetworkComponentType.ASG).length)
const lbCount = computed(() => summaryNodes.value.filter(n => n.data?.type === NetworkComponentType.LOAD_BALANCER).length)
const vpnCount = computed(() => summaryNodes.value.filter(n => n.data?.type === NetworkComponentType.VPN_GATEWAY).length)
const agCount = computed(() => summaryNodes.value.filter(n => n.data?.type === NetworkComponentType.APP_GATEWAY).length)
const computeCount = computed(() => summaryNodes.value.filter(n =>
  [NetworkComponentType.VM, NetworkComponentType.VMSS, NetworkComponentType.AKS, NetworkComponentType.APP_SERVICE, NetworkComponentType.FUNCTIONS].includes(n.data?.type)
).length)
const storageCount = computed(() => summaryNodes.value.filter(n =>
  [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE, NetworkComponentType.MANAGED_DISK].includes(n.data?.type)
).length)

const unsecuredSubnets = computed(() => {
  const subnets = summaryNodes.value.filter(n => n.data?.type === NetworkComponentType.SUBNET)
  return subnets.filter(s => {
    const hasEdgeToNsg = (diagramStore.edges as any[]).some(e =>
      (e.source === s.id || e.target === s.id) &&
      summaryNodes.value.find(n => n.id === (e.source === s.id ? e.target : e.source))?.data?.type === NetworkComponentType.NSG
    )
    return !hasEdgeToNsg && !(s.data as any).nsgId
  })
})
</script>

<style scoped>
.right-panel {
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--border);
  transition: width 0.25s ease, min-width 0.25s ease;
  overflow: hidden;
  z-index: 10;
}

.right-panel.collapsed {
  width: 40px;
  min-width: 40px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
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
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.panel-icon { font-size: 1.1rem; color: var(--primary); }

.panel-body {
  flex: 1;
  overflow-y: auto;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.empty-section {
  font-size: 0.88rem;
  color: var(--text-muted);
  padding: 0.5rem 0;
  font-style: italic;
}

.edge-list {
  display: flex;
  flex-direction: column;
}

.component-groups {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.component-group {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  background: var(--surface-alt);
  border-bottom: 1px solid var(--border);
}

.group-type-icon { font-size: 1rem; flex-shrink: 0; }

.conn-role-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 3px;
  padding: 0.1rem 0.35rem;
  flex-shrink: 0;
}

.target-badge {
  background: var(--primary);
  color: #fff;
}

.source-badge {
  background: var(--border);
  color: var(--text-muted);
}

.conn-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.conn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.conn-table thead tr {
  background: var(--surface-alt);
}

.conn-table th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  padding: 0.35rem 0.5rem;
  border-bottom: 2px solid var(--border);
}

.conn-table td {
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 0;
  white-space: nowrap;
}

.conn-table tbody tr:last-child td {
  border-bottom: none;
}

/* Alternating group backgrounds — applied to ALL cells in a group */
.conn-table tr.conn-group-alt td {
  background: var(--surface-hover);
}

/* Separator line between groups */
.conn-table tr.conn-group-first td {
  border-top: 2px solid var(--border);
}

.conn-target-cell {
  font-weight: 600;
  color: var(--text) !important;
  border-left: 2px solid var(--primary);
  vertical-align: top;
}

.conn-source-cell {
  color: var(--text-muted);
}

.conn-cell-content {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  overflow: hidden;
  white-space: nowrap;
}

.conn-cell-content span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.conn-cell-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.group-label {
  flex: 1;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.component-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border);
}

.component-row:last-child {
  border-bottom: none;
}

.comp-name {
  font-size: 0.82rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
}

.security-summary, .perf-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.security-row, .perf-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
  font-size: 0.88rem;
}

.sec-icon { font-size: 1.1rem; color: var(--text-muted); flex-shrink: 0; }
.sec-icon.warn { color: var(--warning); }
.sec-icon.ok { color: var(--success); }

.sec-label { flex: 1; color: var(--text-muted); }

.warn-text { color: var(--warning); }
.ok-text { color: var(--success); }

.perf-label { flex: 1; color: var(--text-muted); }
</style>
