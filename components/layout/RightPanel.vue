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
      <Accordion :multiple="true" :value="['components']">
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
                <div class="group-header group-header-clickable" @click="toggleComponentGroup(group.type)">
                  <Icon :icon="getIcon(group.type)" :style="{ color: getColor(group.type) }" class="group-type-icon" />
                  <span class="group-label">{{ getLabel(group.type) }}</span>
                  <Tag :value="String(group.nodes.length)" severity="info" />
                  <Icon :icon="collapsedComponentTypes.has(group.type) ? 'mdi:chevron-right' : 'mdi:chevron-down'" class="group-chevron" />
                </div>
                <div class="component-list" v-show="!collapsedComponentTypes.has(group.type)">
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
            <div v-if="groupedConnections.length === 0" class="empty-section">No connections defined</div>
            <div v-else class="conn-groups">
              <div v-for="(group, gi) in groupedConnections" :key="group.targetId"
                   :class="['conn-group', gi % 2 === 1 ? 'conn-group-alt' : '', gi > 0 ? 'conn-group-sep' : '']">
                <div class="conn-group-header" @click="toggleConnTarget(group.targetId)">
                  <Icon :icon="collapsedConnTargets.has(group.targetId) ? 'mdi:chevron-right' : 'mdi:chevron-down'" class="conn-chevron" />
                  <div class="conn-cell-content" style="flex: 1">
                    <Icon v-if="getNodeType(group.targetId)" :icon="getNodeIcon(group.targetId)" :style="{ color: getNodeColor(group.targetId) }" class="conn-cell-icon" v-tooltip="getNodeTypeLabel(group.targetId)" />
                    <span class="conn-target-label">{{ group.targetName }}</span>
                  </div>
                  <span class="conn-source-count">{{ group.edges.length }}</span>
                </div>
                <div v-show="!collapsedConnTargets.has(group.targetId)" class="conn-sources">
                  <div v-for="edge in group.edges" :key="edge.id" class="conn-source-row">
                    <div class="conn-cell-content">
                      <Icon v-if="getNodeType(edge.source)" :icon="getNodeIcon(edge.source)" :style="{ color: getNodeColor(edge.source) }" class="conn-cell-icon" v-tooltip="getNodeTypeLabel(edge.source)" />
                      <span>{{ getNodeName(edge.source) }}</span>
                    </div>
                  </div>
                </div>
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
            <div class="audit-summary">
              <div class="audit-counts">
                <div class="security-row">
                  <span class="sec-label">NSGs</span>
                  <Tag :value="String(nsgCount)" :severity="getCountSeverity([NetworkComponentType.NSG], securityFindings)" />
                </div>
                <div class="security-row">
                  <span class="sec-label">Firewalls</span>
                  <Tag :value="String(firewallCount)" :severity="getCountSeverity([NetworkComponentType.FIREWALL], securityFindings)" />
                </div>
                <div class="security-row">
                  <span class="sec-label">ASGs</span>
                  <Tag :value="String(asgCount)" :severity="getCountSeverity([NetworkComponentType.ASG], securityFindings)" />
                </div>
              </div>
              <div v-if="summaryNodes.length === 0" class="empty-section">No components to audit</div>
              <div v-else-if="securityFindings.length === 0" class="audit-ok">
                <Icon icon="mdi:check-circle" class="sec-icon ok" />
                <span class="ok-text">No security issues found</span>
              </div>
              <div v-else class="audit-findings">
                <div v-for="(finding, i) in securityFindings" :key="i" class="finding-row">
                  <Tag :value="finding.severity === 'critical' ? 'CRITICAL' : 'WARNING'" :severity="finding.severity === 'critical' ? 'danger' : 'warn'" class="finding-tag" />
                  <span class="finding-msg">{{ finding.message }}</span>
                </div>
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
            <div class="audit-summary">
              <div class="audit-counts">
                <div class="perf-row">
                  <span class="perf-label">Load Balancers</span>
                  <Tag :value="String(lbCount)" :severity="getCountSeverity([NetworkComponentType.LOAD_BALANCER], performanceFindings)" />
                </div>
                <div class="perf-row">
                  <span class="perf-label">VPN Gateways</span>
                  <Tag :value="String(vpnCount)" :severity="getCountSeverity([NetworkComponentType.VPN_GATEWAY], performanceFindings)" />
                </div>
                <div class="perf-row">
                  <span class="perf-label">App Gateways</span>
                  <Tag :value="String(agCount)" :severity="getCountSeverity([NetworkComponentType.APP_GATEWAY], performanceFindings)" />
                </div>
                <div class="perf-row">
                  <span class="perf-label">Compute Nodes</span>
                  <Tag :value="String(computeCount)" :severity="getCountSeverity([NetworkComponentType.VM, NetworkComponentType.VMSS, NetworkComponentType.AKS, NetworkComponentType.APP_SERVICE, NetworkComponentType.FUNCTIONS], performanceFindings)" />
                </div>
                <div class="perf-row">
                  <span class="perf-label">Storage Resources</span>
                  <Tag :value="String(storageCount)" :severity="getCountSeverity([NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE, NetworkComponentType.MANAGED_DISK], performanceFindings)" />
                </div>
              </div>
              <div v-if="summaryNodes.length === 0" class="empty-section">No components to audit</div>
              <div v-else-if="performanceFindings.length === 0" class="audit-ok">
                <Icon icon="mdi:check-circle" class="sec-icon ok" />
                <span class="ok-text">No performance issues found</span>
              </div>
              <div v-else class="audit-findings">
                <div v-for="(finding, i) in performanceFindings" :key="i" class="finding-row">
                  <Tag :value="finding.severity === 'critical' ? 'CRITICAL' : 'WARNING'" :severity="finding.severity === 'critical' ? 'danger' : 'warn'" class="finding-tag" />
                  <span class="finding-msg">{{ finding.message }}</span>
                </div>
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

// ─── Collapsible group state ─────────────────────────────────────────────────
const collapsedComponentTypes = ref(new Set<string>())
const collapsedConnTargets = ref(new Set<string>())

function toggleComponentGroup(type: string) {
  const s = new Set(collapsedComponentTypes.value)
  if (s.has(type)) s.delete(type)
  else s.add(type)
  collapsedComponentTypes.value = s
}

function toggleConnTarget(targetId: string) {
  const s = new Set(collapsedConnTargets.value)
  if (s.has(targetId)) s.delete(targetId)
  else s.add(targetId)
  collapsedConnTargets.value = s
}

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

const initializedComponentCollapse = ref(false)
const initializedConnectivityCollapse = ref(false)
const previousComponentGroupKeys = ref(new Set<string>())
const previousConnectivityGroupKeys = ref(new Set<string>())

watch(groupedComponents, (groups) => {
  const groupKeys = new Set(groups.map(group => group.type))

  if (!initializedComponentCollapse.value) {
    collapsedComponentTypes.value = new Set(groupKeys)
    previousComponentGroupKeys.value = new Set(groupKeys)
    initializedComponentCollapse.value = true
    return
  }

  const next = new Set<string>()
  groups.forEach(group => {
    if (collapsedComponentTypes.value.has(group.type) || !previousComponentGroupKeys.value.has(group.type)) {
      next.add(group.type)
    }
  })
  collapsedComponentTypes.value = next
  previousComponentGroupKeys.value = new Set(groupKeys)
}, { immediate: true })

watch(groupedConnections, (groups) => {
  const groupKeys = new Set(groups.map(group => group.targetId))

  if (!initializedConnectivityCollapse.value) {
    collapsedConnTargets.value = new Set(groupKeys)
    previousConnectivityGroupKeys.value = new Set(groupKeys)
    initializedConnectivityCollapse.value = true
    return
  }

  const next = new Set<string>()
  groups.forEach(group => {
    if (collapsedConnTargets.value.has(group.targetId) || !previousConnectivityGroupKeys.value.has(group.targetId)) {
      next.add(group.targetId)
    }
  })
  collapsedConnTargets.value = next
  previousConnectivityGroupKeys.value = new Set(groupKeys)
}, { immediate: true })

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

// ─── Security audit helpers ─────────────────────────────────────────────────

const PERMISSIVE_SOURCE_PREFIXES_SET = new Set(['*', 'internet', '0.0.0.0/0', 'any', '::/0'])
const SENSITIVE_INBOUND_PORTS_LIST = [21, 22, 23, 25, 135, 445, 1433, 3306, 3389, 5432, 5985, 5986, 6379, 27017]

function auditIsPermissiveSourcePrefix(prefix?: string) {
  return PERMISSIVE_SOURCE_PREFIXES_SET.has(String(prefix || '').trim().toLowerCase())
}
function auditIsWildcardPortRange(range?: string) {
  return String(range || '').trim() === '*'
}
function auditParsePortSegments(range?: string): Array<[number, number]> {
  const value = String(range || '').trim()
  if (!value) return []
  if (value === '*') return [[0, 65535]]
  return value.split(',').map(p => p.trim()).flatMap((part) => {
    if (/^\d+$/.test(part)) { const p = Number(part); return Number.isInteger(p) ? [[p, p] as [number, number]] : [] }
    const m = part.match(/^(\d+)-(\d+)$/)
    if (!m) return []
    const s = Number(m[1]), e = Number(m[2])
    return Number.isInteger(s) && Number.isInteger(e) ? [[Math.min(s, e), Math.max(s, e)] as [number, number]] : []
  })
}
function auditPortRangeIncludesPort(range: string | undefined, port: number) {
  return auditParsePortSegments(range).some(([s, e]) => port >= s && port <= e)
}
function auditPortRangeCovers(allow?: string, deny?: string) {
  const as = auditParsePortSegments(allow), ds = auditParsePortSegments(deny)
  if (!as.length || !ds.length) return String(allow || '').trim() === String(deny || '').trim()
  return ds.every(([ds_, de]) => as.some(([as_, ae]) => as_ <= ds_ && ae >= de))
}
function auditSourcePrefixCovers(allow?: string, deny?: string) {
  const a = String(allow || '').trim().toLowerCase(), d = String(deny || '').trim().toLowerCase()
  return a === d || auditIsPermissiveSourcePrefix(a)
}
function auditProtocolsOverlap(l?: string, r?: string) {
  const a = String(l || '*').trim().toLowerCase(), b = String(r || '*').trim().toLowerCase()
  return a === '*' || b === '*' || a === b
}
function auditGetNsgIdsForSubnet(subnet: any, nodes: any[], edges: any[]): string[] {
  const ids = new Set<string>()
  if (subnet.data?.nsgId) ids.add(subnet.data.nsgId)
  edges.filter((e: any) => e.source === subnet.id || e.target === subnet.id)
    .forEach((e: any) => {
      const otherId = e.source === subnet.id ? e.target : e.source
      const other = nodes.find((n: any) => n.id === otherId)
      if (other?.data?.type === NetworkComponentType.NSG) ids.add(otherId)
    })
  nodes.filter((n: any) => n.data?.type === NetworkComponentType.NSG && Array.isArray(n.data?.subnetIds) && n.data.subnetIds.includes(subnet.id))
    .forEach((n: any) => ids.add(n.id))
  return [...ids]
}
function auditGetNsgIdsForNic(nic: any, nodes: any[], edges: any[]): string[] {
  const ids = new Set<string>()
  if (nic.data?.nsgId) ids.add(nic.data.nsgId)
  edges.filter((e: any) => e.source === nic.id || e.target === nic.id)
    .forEach((e: any) => {
      const otherId = e.source === nic.id ? e.target : e.source
      const other = nodes.find((n: any) => n.id === otherId)
      if (other?.data?.type === NetworkComponentType.NSG) ids.add(otherId)
    })
  nodes.filter((n: any) => n.data?.type === NetworkComponentType.NSG && Array.isArray(n.data?.nicIds) && n.data.nicIds.includes(nic.id))
    .forEach((n: any) => ids.add(n.id))
  return [...ids]
}
function auditHasExplicitDenyAllInbound(rules: any[]) {
  return rules.some((r: any) =>
    r.access === 'Deny' && r.direction === 'Inbound' && auditIsWildcardPortRange(r.destinationPortRange)
    && typeof r.priority === 'number' && r.priority >= 4090 && r.priority <= 4096
  )
}

type AuditFinding = { severity: 'critical' | 'warning'; message: string; relatedTypes?: NetworkComponentType[] }

/**
 * Returns the PrimeVue Tag severity for a component-type count badge based on audit findings.
 * - 'secondary' when no nodes of these types exist in the diagram
 * - 'danger'    when at least one critical finding targets these types
 * - 'warn'      when at least one warning finding targets these types (and no critical)
 * - 'success'   when nodes exist and no relevant findings
 */
function getCountSeverity(types: NetworkComponentType[], findings: AuditFinding[]): 'success' | 'warn' | 'danger' | 'secondary' {
  const count = summaryNodes.value.filter(n => types.includes(n.data?.type as NetworkComponentType)).length
  if (count === 0) return 'secondary'
  const relevant = findings.filter(f => f.relatedTypes?.some(t => types.includes(t)))
  if (relevant.some(f => f.severity === 'critical')) return 'danger'
  if (relevant.some(f => f.severity === 'warning')) return 'warn'
  return 'success'
}

const securityFindings = computed((): AuditFinding[] => {
  const nodes = diagramStore.nodes as any[]
  const edges = diagramStore.edges as any[]
  const nsgNodes = nodes.filter(n => n.data?.type === NetworkComponentType.NSG)
  const subnetNodes = nodes.filter(n => n.data?.type === NetworkComponentType.SUBNET)
  const nicNodes = nodes.filter(n => n.data?.type === NetworkComponentType.NETWORK_IC)
  const findings: AuditFinding[] = []

  if (summaryNodes.value.length === 0) return findings

  if (nsgNodes.length === 0) {
    findings.push({ severity: 'warning', message: 'No NSGs found in the diagram. All traffic is unrestricted.', relatedTypes: [NetworkComponentType.NSG] })
  }

  subnetNodes.forEach((subnet: any) => {
    if (auditGetNsgIdsForSubnet(subnet, nodes, edges).length === 0) {
      findings.push({ severity: 'warning', message: `Subnet "${subnet.data.name}" has no NSG protection.`, relatedTypes: [NetworkComponentType.NSG] })
    }
  })

  nicNodes.forEach((nic: any) => {
    if (auditGetNsgIdsForNic(nic, nodes, edges).length === 0) {
      findings.push({ severity: 'warning', message: `NIC "${nic.data.name}" has no NSG association.`, relatedTypes: [NetworkComponentType.NSG] })
    }
  })

  nsgNodes.forEach((nsg: any) => {
    const rules = (nsg.data?.securityRules || []).slice().sort((a: any, b: any) => a.priority - b.priority)

    if (!auditHasExplicitDenyAllInbound(rules)) {
      findings.push({ severity: 'warning', message: `NSG "${nsg.data.name}" is missing an explicit Deny-All inbound rule near the default Azure priority range.`, relatedTypes: [NetworkComponentType.NSG] })
    }

    rules.forEach((rule: any) => {
      if (rule.direction !== 'Inbound' || rule.access !== 'Allow' || !auditIsPermissiveSourcePrefix(rule.sourceAddressPrefix)) return
      if (auditIsWildcardPortRange(rule.destinationPortRange)) {
        findings.push({ severity: 'critical', message: `NSG "${nsg.data.name}" rule "${rule.name}" allows inbound traffic from anywhere on all ports.`, relatedTypes: [NetworkComponentType.NSG] })
        return
      }
      const exposed = SENSITIVE_INBOUND_PORTS_LIST.filter(p => auditPortRangeIncludesPort(rule.destinationPortRange, p))
      if (exposed.length > 0) {
        findings.push({ severity: 'critical', message: `NSG "${nsg.data.name}" rule "${rule.name}" exposes sensitive inbound port(s) ${exposed.join(', ')} to unrestricted sources.`, relatedTypes: [NetworkComponentType.NSG] })
      }
    })

    rules.filter((r: any) => r.access === 'Deny' && r.direction === 'Inbound')
      .forEach((denyRule: any) => {
        const shadowing = rules.find((r: any) =>
          r.access === 'Allow' && r.direction === 'Inbound' && r.priority < denyRule.priority
          && auditProtocolsOverlap(r.protocol, denyRule.protocol)
          && auditPortRangeCovers(r.destinationPortRange, denyRule.destinationPortRange)
          && auditSourcePrefixCovers(r.sourceAddressPrefix, denyRule.sourceAddressPrefix)
        )
        if (shadowing) {
          findings.push({ severity: 'warning', message: `NSG "${nsg.data.name}" deny rule "${denyRule.name}" is shadowed by higher-priority allow rule "${shadowing.name}".`, relatedTypes: [NetworkComponentType.NSG] })
        }
      })
  })

  // dedupe
  const seen = new Set<string>()
  return findings.filter(f => { const k = `${f.severity}:${f.message}`; if (seen.has(k)) return false; seen.add(k); return true })
})

// ─── Performance audit ───────────────────────────────────────────────────────

const performanceFindings = computed((): AuditFinding[] => {
  const nodes = diagramStore.nodes as any[]
  const edges = diagramStore.edges as any[]
  const findings: AuditFinding[] = []

  if (summaryNodes.value.length === 0) return findings

  const lbNodes = nodes.filter(n => n.data?.type === NetworkComponentType.LOAD_BALANCER)
  const agNodes = nodes.filter(n => n.data?.type === NetworkComponentType.APP_GATEWAY)
  const subnetNodes = nodes.filter(n => n.data?.type === NetworkComponentType.SUBNET)
  const vmNodes = nodes.filter(n => n.data?.type === NetworkComponentType.VM)
  const vmssNodes = nodes.filter(n => n.data?.type === NetworkComponentType.VMSS)
  const nicNodes = nodes.filter(n => n.data?.type === NetworkComponentType.NETWORK_IC)
  const vpnNodes = nodes.filter(n => n.data?.type === NetworkComponentType.VPN_GATEWAY)

  // LB checks
  lbNodes.forEach((lb: any) => {
    const backendNicIds = new Set<string>()
    ;(lb.data?.backendPools || []).forEach((pool: any) => {
      ;(pool?.nicIds || []).forEach((nicId: string) => { if (nodes.find(n => n.id === nicId)) backendNicIds.add(nicId) })
    })
    // Also check edges for connected NICs
    edges.filter((e: any) => e.source === lb.id || e.target === lb.id)
      .forEach((e: any) => {
        const otherId = e.source === lb.id ? e.target : e.source
        const other = nodes.find(n => n.id === otherId)
        if (other?.data?.type === NetworkComponentType.NETWORK_IC) backendNicIds.add(otherId)
      })

    if (backendNicIds.size === 0) {
      findings.push({ severity: 'critical', message: `Load Balancer "${lb.data.name}" has no backend pool members configured.`, relatedTypes: [NetworkComponentType.LOAD_BALANCER] })
    }
    if (!Array.isArray(lb.data?.healthProbes) || lb.data.healthProbes.length === 0) {
      findings.push({ severity: 'warning', message: `Load Balancer "${lb.data.name}" has no health probe configured.`, relatedTypes: [NetworkComponentType.LOAD_BALANCER] })
    }
    if (!Array.isArray(lb.data?.loadBalancingRules) || lb.data.loadBalancingRules.length === 0) {
      findings.push({ severity: 'warning', message: `Load Balancer "${lb.data.name}" has no load-balancing rule configured.`, relatedTypes: [NetworkComponentType.LOAD_BALANCER] })
    }
    if (lb.data?.sku === 'Standard') {
      const frontendIpIds = new Set<string>()
      ;(lb.data?.frontendIpConfigs || []).forEach((f: any) => { if (f?.publicIpId) frontendIpIds.add(f.publicIpId) })
      edges.filter((e: any) => e.source === lb.id || e.target === lb.id)
        .forEach((e: any) => {
          const otherId = e.source === lb.id ? e.target : e.source
          const other = nodes.find(n => n.id === otherId)
          if (other?.data?.type === NetworkComponentType.IP_ADDRESS) frontendIpIds.add(otherId)
        })
      ;[...frontendIpIds].forEach((ipId: string) => {
        const ipNode = nodes.find(n => n.id === ipId)
        if (ipNode?.data?.sku && ipNode.data.sku !== 'Standard') {
          findings.push({ severity: 'critical', message: `Standard Load Balancer "${lb.data.name}" is attached to non-Standard Public IP "${ipNode.data.name}".`, relatedTypes: [NetworkComponentType.LOAD_BALANCER] })
        }
      })
    }
  })

  // App Gateway checks
  agNodes.forEach((ag: any) => {
    const sku = String(ag.data?.sku || '')
    if (sku.includes('WAF') && !ag.data?.enableWaf) {
      findings.push({ severity: 'warning', message: `Application Gateway "${ag.data.name}" uses a WAF SKU but WAF is disabled.`, relatedTypes: [NetworkComponentType.APP_GATEWAY] })
    }
    if (ag.data?.enableWaf && ag.data?.wafMode === 'Detection') {
      findings.push({ severity: 'warning', message: `Application Gateway "${ag.data.name}" has WAF in Detection mode instead of Prevention mode.`, relatedTypes: [NetworkComponentType.APP_GATEWAY] })
    }
  })

  // Subnets without compute resources
  subnetNodes.forEach((subnet: any) => {
    const hasCompute = nodes.some(n => {
      const computeTypes = [NetworkComponentType.VM, NetworkComponentType.VMSS, NetworkComponentType.AKS, NetworkComponentType.APP_SERVICE, NetworkComponentType.FUNCTIONS, NetworkComponentType.NVA, NetworkComponentType.APP_GATEWAY, NetworkComponentType.VPN_GATEWAY, NetworkComponentType.BASTION]
      if (!computeTypes.includes(n.data?.type)) return false
      if (n.data?.subnetId === subnet.id) return true
      if (n.parentNode === subnet.id) return true
      const nicId = Array.isArray(n.data?.nicIds) ? n.data.nicIds[0] : undefined
      if (nicId) {
        const nic = nodes.find(ni => ni.id === nicId)
        return nic?.data?.subnetId === subnet.id
      }
      return false
    })
    if (!hasCompute) {
      findings.push({ severity: 'warning', message: `Subnet "${subnet.data.name}" has no compute resources (isolated subnet).`, relatedTypes: [NetworkComponentType.SUBNET] })
    }
  })

  // VMs without accelerated networking
  vmNodes.forEach((vm: any) => {
    ;(vm.data?.nicIds || []).forEach((nicId: string) => {
      const nic = nicNodes.find(n => n.id === nicId)
      if (nic && !nic.data?.enableAcceleratedNetworking) {
        findings.push({ severity: 'warning', message: `VM "${vm.data.name}" NIC "${nic.data.name}" does not have accelerated networking enabled.`, relatedTypes: [NetworkComponentType.VM] })
      }
    })
  })

  // VMSS with capacity <= 1
  vmssNodes.forEach((vmss: any) => {
    if (typeof vmss.data?.capacity === 'number' && vmss.data.capacity <= 1) {
      findings.push({ severity: 'warning', message: `VMSS "${vmss.data.name}" has capacity ${vmss.data.capacity} (no redundancy).`, relatedTypes: [NetworkComponentType.VMSS] })
    }
  })

  // VPN Gateways on Basic SKU
  vpnNodes.forEach((vpn: any) => {
    if (String(vpn.data?.sku || '').toLowerCase() === 'basic') {
      findings.push({ severity: 'warning', message: `VPN Gateway "${vpn.data.name}" uses the Basic SKU which has no SLA.`, relatedTypes: [NetworkComponentType.VPN_GATEWAY] })
    }
  })

  // dedupe
  const seen = new Set<string>()
  return findings.filter(f => { const k = `${f.severity}:${f.message}`; if (seen.has(k)) return false; seen.add(k); return true })
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
  overflow-x: hidden;
}

:deep(.p-accordioncontent-content) {
  padding: 0.5rem 0.45rem;
}

:deep(.p-tag) {
  flex-shrink: 0;
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
  padding: 0.28rem 0.4rem;
  background: var(--surface-alt);
  border-bottom: 1px solid var(--border);
}

.group-header-clickable {
  cursor: pointer;
  user-select: none;
}

.group-header-clickable:hover {
  background: var(--surface-hover);
}

.group-chevron {
  font-size: 0.85rem;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: auto;
}

.group-type-icon { font-size: 1rem; flex-shrink: 0; }

.conn-groups {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.conn-group {
  border-bottom: 1px solid var(--border);
}

.conn-group:last-child {
  border-bottom: none;
}

.conn-group-alt {
  background: var(--surface-hover);
}

.conn-group-sep {
  border-top: 2px solid var(--border);
}

.conn-group-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.4rem;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--border-subtle, var(--border));
  font-weight: 600;
  font-size: 0.82rem;
}

.conn-group-header:hover {
  background: var(--surface-hover);
}

.conn-chevron {
  font-size: 0.85rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.conn-target-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.conn-source-count {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--primary-color-text, #ffffff);
  flex-shrink: 0;
  background: var(--primary);
  border: 1px solid color-mix(in srgb, var(--primary) 70%, #000000 30%);
  padding: 0.08rem 0.34rem;
  border-radius: 10px;
}

.conn-sources {
  display: flex;
  flex-direction: column;
}

.conn-source-row {
  padding: 0.22rem 0.4rem 0.22rem 1.3rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.conn-source-row:last-child {
  border-bottom: none;
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
  padding: 0.28rem 0.4rem;
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

.audit-summary { display: flex; flex-direction: column; gap: 0.6rem; }

.audit-counts { display: flex; flex-direction: column; gap: 0.4rem; }

.audit-ok {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  padding: 0.3rem 0;
}

.audit-findings {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.finding-row {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.82rem;
  line-height: 1.4;
}

.finding-tag { flex-shrink: 0; font-size: 0.68rem !important; }

.finding-msg { color: var(--text); flex: 1; }
</style>
