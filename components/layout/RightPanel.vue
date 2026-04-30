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
              Components ({{ diagramStore.nodes.length }})
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div v-if="diagramStore.nodes.length === 0" class="empty-section">No components added yet</div>
            <div v-else class="component-groups">
              <div v-for="group in groupedComponents" :key="group.type" class="component-group">
                <div class="group-header">
                  <Icon :icon="getIcon(group.type)" :style="{ color: getColor(group.type) }" class="group-type-icon" />
                  <span class="group-label">{{ getLabel(group.type) }}</span>
                  <span class="group-count">{{ group.nodes.length }}</span>
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
                  <template v-for="group in groupedConnections" :key="group.targetId">
                    <tr v-for="(edge, i) in group.edges" :key="edge.id">
                      <td class="conn-source-cell">{{ getNodeName(edge.source) }}</td>
                      <td :rowspan="i === 0 ? group.edges.length : undefined" v-if="i === 0" class="conn-target-cell">{{ group.targetName }}</td>
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
              <div class="security-row" v-else-if="diagramStore.nodes.length > 0">
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

const groupedComponents = computed(() => {
  const map = new Map<string, typeof diagramStore.nodes>()
  for (const node of diagramStore.nodes) {
    const type = node.data.type as string
    if (!map.has(type)) map.set(type, [])
    map.get(type)!.push(node)
  }
  return [...map.entries()].map(([type, nodes]) => ({ type: type as NetworkComponentType, nodes }))
})

const groupedConnections = computed(() => {
  const map = new Map<string, any[]>()
  for (const edge of diagramStore.edges as any[]) {
    const target = edge.target as string
    if (!map.has(target)) map.set(target, [])
    map.get(target)!.push(edge)
  }
  return [...map.entries()].map(([targetId, edges]) => ({
    targetId,
    targetName: getNodeName(targetId),
    edges,
  }))
})

const nsgCount = computed(() => diagramStore.nodes.filter(n => n.data?.type === NetworkComponentType.NSG).length)
const firewallCount = computed(() => diagramStore.nodes.filter(n => n.data?.type === NetworkComponentType.FIREWALL).length)
const asgCount = computed(() => diagramStore.nodes.filter(n => n.data?.type === NetworkComponentType.ASG).length)
const lbCount = computed(() => diagramStore.nodes.filter(n => n.data?.type === NetworkComponentType.LOAD_BALANCER).length)
const vpnCount = computed(() => diagramStore.nodes.filter(n => n.data?.type === NetworkComponentType.VPN_GATEWAY).length)
const agCount = computed(() => diagramStore.nodes.filter(n => n.data?.type === NetworkComponentType.APP_GATEWAY).length)
const computeCount = computed(() => diagramStore.nodes.filter(n =>
  [NetworkComponentType.VM, NetworkComponentType.VMSS, NetworkComponentType.AKS, NetworkComponentType.APP_SERVICE, NetworkComponentType.FUNCTIONS].includes(n.data?.type)
).length)
const storageCount = computed(() => diagramStore.nodes.filter(n =>
  [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE, NetworkComponentType.MANAGED_DISK].includes(n.data?.type)
).length)

const unsecuredSubnets = computed(() => {
  const subnets = diagramStore.nodes.filter(n => n.data?.type === NetworkComponentType.SUBNET)
  return subnets.filter(s => {
    const hasEdgeToNsg = (diagramStore.edges as any[]).some(e =>
      (e.source === s.id || e.target === s.id) &&
      diagramStore.nodes.find(n => n.id === (e.source === s.id ? e.target : e.source))?.data?.type === NetworkComponentType.NSG
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
  background: var(--surface-card);
  border-left: 1px solid var(--surface-border);
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
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
  background: var(--surface-section);
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
  color: var(--text-color-secondary);
}

.panel-icon { font-size: 1.1rem; color: var(--primary-color); }

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
  color: var(--text-color-secondary);
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
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  background: var(--surface-section);
  border-bottom: 1px solid var(--surface-border);
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
  background: var(--primary-color);
  color: #fff;
}

.source-badge {
  background: var(--surface-border);
  color: var(--text-color-secondary);
}

.conn-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  overflow: hidden;
}

.conn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.conn-table thead tr {
  background: var(--surface-section);
}

.conn-table th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-color-secondary);
  padding: 0.35rem 0.5rem;
  border-bottom: 2px solid var(--surface-border);
}

.conn-table td {
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--surface-border);
  vertical-align: top;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 0;
  white-space: nowrap;
}

.conn-table tbody tr:last-child td {
  border-bottom: none;
}

.conn-table tbody tr:nth-child(even) .conn-source-cell {
  background: var(--surface-hover);
}

.conn-target-cell {
  font-weight: 600;
  color: var(--text-color) !important;
  border-left: 2px solid var(--primary-color);
  background: var(--surface-ground);
  vertical-align: top;
}

.conn-source-cell {
  color: var(--text-color-secondary);
}

.group-label {
  flex: 1;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  background: var(--surface-border);
  border-radius: 10px;
  padding: 0.05rem 0.4rem;
  flex-shrink: 0;
}

.component-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--surface-border);
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
  color: var(--text-color-secondary);
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

.sec-icon { font-size: 1.1rem; color: var(--text-color-secondary); flex-shrink: 0; }
.sec-icon.warn { color: var(--yellow-500); }
.sec-icon.ok { color: var(--green-500); }

.sec-label { flex: 1; color: var(--text-color-secondary); }

.warn-text { color: var(--yellow-600); }
.ok-text { color: var(--green-600); }

.perf-label { flex: 1; color: var(--text-color-secondary); }
</style>
