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
            <div v-else class="component-list">
              <div v-for="node in diagramStore.nodes" :key="node.id" class="component-row">
                <Icon :icon="getIcon(node.data.type)" :style="{ color: getColor(node.data.type) }" class="comp-icon" />
                <div class="comp-details">
                  <span class="comp-name">{{ node.data.name }}</span>
                  <span class="comp-type">{{ getLabel(node.data.type) }}</span>
                </div>
                <Tag :value="getRegion(node.data)" size="small" class="comp-tag" />
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
            <div v-else class="edge-list">
              <div v-for="edge in diagramStore.edges" :key="(edge as any).id" class="edge-row">
                <Icon icon="mdi:arrow-right-thin" class="edge-arrow" />
                <span class="edge-label">{{ getNodeName((edge as any).source) }} → {{ getNodeName((edge as any).target) }}</span>
              </div>
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
                <Icon icon="mdi:shield-lock" class="sec-icon" />
                <span>NSGs: {{ nsgCount }}</span>
              </div>
              <div class="security-row">
                <Icon icon="mdi:wall-fire" class="sec-icon" />
                <span>Firewalls: {{ firewallCount }}</span>
              </div>
              <div class="security-row">
                <Icon icon="mdi:account-group" class="sec-icon" />
                <span>ASGs: {{ asgCount }}</span>
              </div>
              <div class="security-row" v-if="unsecuredSubnets.length > 0">
                <Icon icon="mdi:alert" class="sec-icon warn" />
                <span class="warn-text">{{ unsecuredSubnets.length }} subnet(s) without NSG</span>
              </div>
              <div class="security-row" v-else-if="diagramStore.nodes.length > 0">
                <Icon icon="mdi:check-circle" class="sec-icon ok" />
                <span class="ok-text">All subnets protected</span>
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
function getRegion(data: any) { return data.region || data.defaultRegion || '' }

function getNodeName(id: string) {
  const node = diagramStore.nodes.find(n => n.id === id)
  return node?.data?.name || id.substring(0, 8)
}

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
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-color-secondary);
}

.panel-icon { font-size: 1rem; color: var(--primary-color); }

.panel-body {
  flex: 1;
  overflow-y: auto;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.empty-section {
  font-size: 0.78rem;
  color: var(--text-color-secondary);
  padding: 0.5rem 0;
  font-style: italic;
}

.component-list, .edge-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.component-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--surface-border);
}

.comp-icon { font-size: 1rem; flex-shrink: 0; }

.comp-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.comp-name {
  font-size: 0.78rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comp-type {
  font-size: 0.68rem;
  color: var(--text-color-secondary);
}

.comp-tag { font-size: 0.6rem; }

.edge-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  padding: 0.2rem 0;
}

.edge-arrow { color: var(--primary-color); }

.security-summary, .perf-summary {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.security-row, .perf-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
}

.sec-icon { font-size: 0.9rem; color: var(--text-color-secondary); }
.sec-icon.warn { color: var(--yellow-500); }
.sec-icon.ok { color: var(--green-500); }

.warn-text { color: var(--yellow-600); }
.ok-text { color: var(--green-600); }

.perf-label { color: var(--text-color-secondary); }
</style>
