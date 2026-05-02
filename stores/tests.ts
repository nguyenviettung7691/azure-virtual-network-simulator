import { defineStore } from 'pinia'
import type { NetworkTest, TestResult, TestType, TestStatus, TestCondition } from '~/types/test'
import { INTERNET_SOURCE_ID } from '~/types/test'
import { NetworkComponentType } from '~/types/network'

type DiagramEntity = {
  id: string
  parentNode?: string
  data?: Record<string, any>
}

type RelationshipGraph = Map<string, Set<string>>
type TestFinding = { severity: 'critical' | 'warning'; message: string }

const PERMISSIVE_SOURCE_PREFIXES = new Set(['*', 'internet', '0.0.0.0/0', 'any', '::/0'])
const SENSITIVE_INBOUND_PORTS = [21, 22, 23, 25, 135, 445, 1433, 3306, 3389, 5432, 5985, 5986, 6379, 27017]

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

interface TestsState {
  tests: NetworkTest[]
  isRunning: boolean
  showTestFormModal: boolean
  editingTest: NetworkTest | null
  autoRunEnabled: boolean
}

export const useTestsStore = defineStore('tests', {
  state: (): TestsState => ({
    tests: [],
    isRunning: false,
    showTestFormModal: false,
    editingTest: null,
    autoRunEnabled: true,
  }),

  getters: {
    passedTests(): NetworkTest[] {
      return this.tests.filter(t => t.result?.status === 'pass')
    },
    failedTests(): NetworkTest[] {
      return this.tests.filter(t => t.result?.status === 'fail')
    },
    pendingTests(): NetworkTest[] {
      return this.tests.filter(t => !t.result || t.result.status === 'pending')
    },
    testSummary(): { total: number; passed: number; failed: number; warning: number; pending: number } {
      return {
        total: this.tests.length,
        passed: this.tests.filter(t => t.result?.status === 'pass').length,
        failed: this.tests.filter(t => t.result?.status === 'fail').length,
        warning: this.tests.filter(t => t.result?.status === 'warning').length,
        pending: this.tests.filter(t => !t.result || t.result.status === 'pending').length,
      }
    },
  },

  actions: {
    addTest(test: Omit<NetworkTest, 'id' | 'result' | 'status' | 'createdAt'>) {
      const newTest: NetworkTest = {
        ...test,
        id: generateId(),
        status: 'pending' as TestStatus,
        result: { status: 'pending', message: 'Not yet run', timestamp: new Date().toISOString() },
        createdAt: new Date().toISOString(),
      }
      this.tests = [...this.tests, newTest]
    },

    updateTest(id: string, updates: Partial<NetworkTest>) {
      const idx = this.tests.findIndex(t => t.id === id)
      if (idx !== -1) {
        this.tests[idx] = { ...this.tests[idx], ...updates }
        this.tests = [...this.tests]
      }
    },

    removeTest(id: string) {
      this.tests = this.tests.filter(t => t.id !== id)
    },

    async runTest(testId: string, nodes: any[], edges: any[]) {
      const test = this.tests.find(t => t.id === testId)
      if (!test) return null

      this.updateTest(testId, {
        status: 'running' as TestStatus,
        result: { status: 'running', message: 'Running...', timestamp: new Date().toISOString() },
      })

      await new Promise(resolve => setTimeout(resolve, 300))

      const result = simulateTest(test, nodes, edges)
      this.updateTest(testId, {
        status: result.status as TestStatus,
        result,
        runAt: new Date().toISOString(),
      })

      return result
    },

    async runAllTests(nodes: any[], edges: any[]) {
      this.isRunning = true
      try {
        for (const test of this.tests) {
          await this.runTest(test.id, nodes, edges)
        }
      } finally {
        this.isRunning = false
      }
    },

    openAddTestModal() {
      this.editingTest = null
      this.showTestFormModal = true
    },

    openEditTestModal(test: NetworkTest) {
      this.editingTest = { ...test }
      this.showTestFormModal = true
    },

    closeTestFormModal() {
      this.showTestFormModal = false
      this.editingTest = null
    },

    clearAllTests() {
      this.tests = []
    },
  },
})

function simulateTest(test: NetworkTest, nodes: any[], edges: any[]): TestResult {
  const timestamp = new Date().toISOString()

  try {
    if (test.type === 'connection') {
      return simulateConnectionTest(test, nodes, edges, timestamp)
    } else if (test.type === 'loadbalance') {
      return simulateLoadBalanceTest(test, nodes, edges, timestamp)
    } else if (test.type === 'dns') {
      return simulateDnsTest(test, nodes, edges, timestamp)
    }
    return { status: 'pass', message: 'Test passed', timestamp }
  } catch (err: any) {
    return { status: 'fail', message: `Test error: ${err.message}`, timestamp }
  }
}

function simulateConnectionTest(test: NetworkTest, nodes: any[], edges: any[], timestamp: string): TestResult {
  const { sourceId, targetId } = test.condition

  // Guard: require both source and target to be set before doing any lookups
  if (!sourceId) {
    return { status: 'fail', message: 'Connection test is missing a source component.', timestamp }
  }
  if (!targetId) {
    return { status: 'fail', message: 'Connection test is missing a target component.', timestamp }
  }

  // Public Internet is a virtual entity — always exists, no diagram node to look up
  if (sourceId === INTERNET_SOURCE_ID) {
    return simulateInternetConnectionTest(test, nodes, timestamp)
  }

  const sourceNode = nodes.find(n => n.id === sourceId)
  const targetNode = nodes.find(n => n.id === targetId)

  if (!sourceNode || !targetNode) {
    return {
      status: 'fail',
      message: `Connection test failed: ${!sourceNode ? 'Source' : 'Target'} component not found in diagram`,
      timestamp,
    }
  }

  const path = findConnectionPath(sourceNode.id, targetNode.id, nodes, edges)
  if (!path || path.length === 0) {
    return {
      status: 'warning',
      message: `No path found between ${sourceNode.data.name} and ${targetNode.data.name}. Components may be in different VNets.`,
      timestamp,
    }
  }

  const nsgBlocking = checkNsgBlocking(path, nodes, test.condition)
  if (nsgBlocking) {
    const blockingId = findBlockingNsgId(path, nodes, test.condition)
    const truncatedPath = blockingId !== null ? path.slice(0, path.indexOf(blockingId) + 1) : path
    return { status: 'fail', message: `Connection blocked by NSG: ${nsgBlocking}`, timestamp, path: truncatedPath }
  }

  return {
    status: 'pass',
    message: `Connection successful: ${sourceNode.data.name} → ${targetNode.data.name} (${path.length} hops)`,
    timestamp,
    path,
    hopCount: path.length,
    latencyMs: Math.floor(Math.random() * 5) + 1,
  }
}

/**
 * Build the physical inbound traversal path: Internet → VNet → Subnet → SubnetNSG? → NIC? → NICNSG? → VM?
 * Stops at blockingNsgId (inclusive) for failed connections; includes target VM for passing connections.
 */
function buildInternetTraversalPath(targetNode: any, blockingNsgId: string | null, nodes: any[]): string[] {
  const d = targetNode.data as any
  const path: string[] = ['Internet']

  // Resolve subnet: directly from component or via first NIC
  let subnetId: string | undefined = d.subnetId
  if (!subnetId && d.nicIds?.length) {
    const firstNic = nodes.find((n: any) => n.id === d.nicIds[0])
    subnetId = firstNic?.data?.subnetId
  }
  const subnetNode = subnetId ? nodes.find((n: any) => n.id === subnetId) : undefined

  // VNet
  if (subnetNode) {
    const vnetId: string | undefined = subnetNode.data?.vnetId || subnetNode.parentNode
    if (vnetId && nodes.find((n: any) => n.id === vnetId)) path.push(vnetId)
  }

  // Subnet
  if (subnetNode) {
    path.push(subnetNode.id)
    // Subnet NSG
    const subnetNsgId: string | undefined = subnetNode.data?.nsgId
    if (subnetNsgId) {
      path.push(subnetNsgId)
      if (subnetNsgId === blockingNsgId) return path
    }
  }

  // NICs and their NSGs (physical traversal order)
  if (d.nicIds?.length) {
    for (const nicId of d.nicIds as string[]) {
      const nicNode = nodes.find((n: any) => n.id === nicId)
      if (!nicNode) continue
      path.push(nicId)
      const nicNsgId: string | undefined = nicNode.data?.nsgId
      if (nicNsgId) {
        path.push(nicNsgId)
        if (nicNsgId === blockingNsgId) return path
      }
    }
  }

  // Direct component NSG (rare — handles components with nsgId on the node itself)
  const vmNsgId: string | undefined = d.nsgId
  if (vmNsgId) {
    path.push(vmNsgId)
    if (vmNsgId === blockingNsgId) return path
  }

  // Target component — only included when traffic was allowed
  if (blockingNsgId === null) path.push(targetNode.id)

  return path
}

function simulateInternetConnectionTest(test: NetworkTest, nodes: any[], timestamp: string): TestResult {
  const { targetId, port } = test.condition
  const targetNode = nodes.find((n: any) => n.id === targetId)

  if (!targetNode) {
    return { status: 'fail', message: 'Target component not found in diagram', timestamp }
  }

  const d = targetNode.data as any
  const portStr = port ? String(port) : undefined

  // Collect NSGs in evaluation order: NIC NSGs → component NSG → Subnet NSG
  const applicableNsgs: any[] = []

  if (d.nicIds?.length) {
    for (const nicId of d.nicIds) {
      const nicNode = nodes.find((n: any) => n.id === nicId)
      if (nicNode?.data?.nsgId) {
        const nsg = nodes.find((n: any) => n.id === nicNode.data.nsgId)
        if (nsg) applicableNsgs.push(nsg)
      }
    }
  }

  if (d.nsgId) {
    const nsg = nodes.find((n: any) => n.id === d.nsgId)
    if (nsg) applicableNsgs.push(nsg)
  }

  if (d.subnetId) {
    const subnet = nodes.find((n: any) => n.id === d.subnetId)
    if (subnet?.data?.nsgId) {
      const nsg = nodes.find((n: any) => n.id === subnet.data.nsgId)
      if (nsg) applicableNsgs.push(nsg)
    }
  }

  if (applicableNsgs.length === 0) {
    const traversalPath = buildInternetTraversalPath(targetNode, null, nodes)
    return {
      status: 'warning',
      message: `No NSGs found protecting ${d.name}. Inbound port ${port ?? 'any'} traffic from Internet is unrestricted.`,
      path: traversalPath,
      timestamp,
    }
  }

  // Find the first matching NSG rule (highest-priority = lowest number first)
  let matchedNsg: any = null
  let matchedRule: any = null

  for (const nsg of applicableNsgs) {
    const rules = (nsg.data?.securityRules || []).slice().sort((a: any, b: any) => a.priority - b.priority)
    for (const rule of rules) {
      if (rule.direction !== 'Inbound') continue
      const portMatches = !portStr || rule.destinationPortRange === '*' || rule.destinationPortRange === portStr
      if (!portMatches) continue
      if (rule.access === 'Deny' || rule.access === 'Allow') {
        matchedNsg = nsg
        matchedRule = rule
        break
      }
    }
    if (matchedNsg) break
  }

  if (!matchedNsg || !matchedRule) {
    // No matching rule — default Azure deny
    return {
      status: 'fail',
      message: `No matching Allow rule found on NSGs for ${d.name}:${port}. Traffic blocked by default deny.`,
      timestamp,
    }
  }

  const blockingNsgId = matchedRule.access === 'Deny' ? (matchedNsg.id as string) : null
  const traversalPath = buildInternetTraversalPath(targetNode, blockingNsgId, nodes)

  if (matchedRule.access === 'Deny') {
    return {
      status: 'fail',
      message: `Connection from Internet to ${d.name}:${port} blocked by NSG "${matchedNsg.data.name}" rule "${matchedRule.name}"`,
      path: traversalPath,
      timestamp,
    }
  }

  return {
    status: 'pass',
    message: `Connection from Internet to ${d.name}:${port} is allowed by NSG "${matchedNsg.data.name}" rule "${matchedRule.name}"`,
    path: traversalPath,
    hopCount: traversalPath.length,
    latencyMs: Math.floor(Math.random() * 20) + 5,
    timestamp,
  }
}

function simulateLoadBalanceTest(test: NetworkTest, nodes: any[], edges: any[], timestamp: string): TestResult {
  const targetNode = test.condition.targetId
    ? nodes.find((n: any) => n.id === test.condition.targetId)
    : nodes.find((n: any) =>
      n.data?.type === NetworkComponentType.LOAD_BALANCER || n.data?.type === NetworkComponentType.APP_GATEWAY
    )

  if (!targetNode) {
    return { status: 'fail', message: 'Target load-balancing component not found in the diagram.', timestamp }
  }

  if (targetNode.data?.type !== NetworkComponentType.LOAD_BALANCER && targetNode.data?.type !== NetworkComponentType.APP_GATEWAY) {
    return { status: 'fail', message: `Target component "${targetNode.data?.name || targetNode.id}" is not a load-balancing resource.`, timestamp }
  }

  const findings: TestFinding[] = []
  const backendState = resolveLoadBalancingBackends(targetNode, nodes, edges)
  const backendVmCount = backendState.backendVmNodes.length
  const backendNicCount = backendState.backendNicNodes.length

  if (backendVmCount === 0 && backendNicCount === 0) {
    findings.push({
      severity: 'critical',
      message: `${getLoadBalancingResourceLabel(targetNode)} "${targetNode.data.name}" has no backend pool members configured.`,
    })
  }

  if (typeof test.condition.expectedBackendCount === 'number' && backendVmCount !== test.condition.expectedBackendCount) {
    findings.push({
      severity: 'critical',
      message: `${getLoadBalancingResourceLabel(targetNode)} "${targetNode.data.name}" expected ${test.condition.expectedBackendCount} backend VM(s) but resolved ${backendVmCount}.`,
    })
  }

  if (targetNode.data?.type === NetworkComponentType.LOAD_BALANCER) {
    const publicIps = resolveFrontendPublicIps(targetNode, nodes, edges)

    if (targetNode.data?.loadBalancerType === 'Public' && publicIps.length === 0) {
      findings.push({
        severity: 'warning',
        message: `Public Load Balancer "${targetNode.data.name}" has no Public IP frontend attached.`,
      })
    }

    if (targetNode.data?.sku === 'Standard') {
      const incompatibleIps = publicIps.filter((ip: any) => ip.data?.sku && ip.data.sku !== 'Standard')
      incompatibleIps.forEach((ip: any) => {
        findings.push({
          severity: 'critical',
          message: `Standard Load Balancer "${targetNode.data.name}" is attached to non-Standard Public IP "${ip.data.name}".`,
        })
      })
    }

    if (!Array.isArray(targetNode.data?.healthProbes) || targetNode.data.healthProbes.length === 0) {
      findings.push({
        severity: 'warning',
        message: `Load Balancer "${targetNode.data.name}" has no health probe configured.`,
      })
    }

    if (!Array.isArray(targetNode.data?.loadBalancingRules) || targetNode.data.loadBalancingRules.length === 0) {
      findings.push({
        severity: 'warning',
        message: `Load Balancer "${targetNode.data.name}" has no load-balancing rule configured.`,
      })
    }

    if (targetNode.data?.loadBalancerType === 'Internal') {
      const frontendVnetIds = resolveInternalLoadBalancerVnetIds(targetNode, nodes)
      const backendVnetIds = Array.from(new Set(
        backendState.backendNicNodes
          .map((nic: any) => resolveNodeVnetId(nic, nodes))
          .filter(Boolean)
      ))

      if (frontendVnetIds.length === 0) {
        findings.push({
          severity: 'warning',
          message: `Internal Load Balancer "${targetNode.data.name}" has no subnet-based frontend configuration.`,
        })
      } else if (backendVnetIds.some(vnetId => !frontendVnetIds.includes(vnetId))) {
        findings.push({
          severity: 'warning',
          message: `Internal Load Balancer "${targetNode.data.name}" spans backend NICs outside its configured frontend VNet(s).`,
        })
      }
    }
  }

  if (targetNode.data?.type === NetworkComponentType.APP_GATEWAY) {
    const sku = String(targetNode.data?.sku || '')
    if (targetNode.data?.enableWaf && targetNode.data?.wafMode === 'Detection') {
      findings.push({
        severity: 'warning',
        message: `Application Gateway "${targetNode.data.name}" has WAF enabled in Detection mode instead of Prevention mode.`,
      })
    }
    if (sku.includes('WAF') && !targetNode.data?.enableWaf) {
      findings.push({
        severity: 'warning',
        message: `Application Gateway "${targetNode.data.name}" uses a WAF SKU but WAF is disabled.`,
      })
    }
  }

  const sourceId = test.condition.sourceId || INTERNET_SOURCE_ID
  const backendSummary = backendState.backendVmNodes.map((vm: any) => vm.data?.name || vm.id).join(', ')
  const summary = `${getLoadBalancingResourceLabel(targetNode)} "${targetNode.data.name}" validated with ${backendNicCount} backend NIC(s) serving ${backendVmCount} VM(s).${backendSummary ? ` Backends: ${backendSummary}.` : ''}`

  return buildFindingsResult(
    `${getLoadBalancingResourceLabel(targetNode)} validation`,
    dedupeFindings(findings),
    summary,
    timestamp,
    {
      path: buildLoadBalancingPath(sourceId, targetNode.id, backendState.backendVmNodes),
    }
  )
}

function simulateDnsTest(test: NetworkTest, nodes: any[], edges: any[], timestamp: string): TestResult {
  const dnsNodes = nodes.filter(n => n.data?.type === NetworkComponentType.DNS_ZONE)

  if (dnsNodes.length === 0) {
    return {
      status: 'warning',
      message: 'No DNS Zones configured. Using Azure default DNS.',
      timestamp,
    }
  }

  const targetZone = test.condition.targetId
    ? dnsNodes.find((n: any) => n.id === test.condition.targetId)
    : dnsNodes[0]

  if (!targetZone) {
    return { status: 'fail', message: 'Target DNS zone not found', timestamp }
  }

  const findings: TestFinding[] = []
  const zoneName = String(targetZone.data?.zoneName || '')
  const recordSets = Array.isArray(targetZone.data?.recordSets) ? targetZone.data.recordSets : []

  if (!isValidDnsZoneName(zoneName)) {
    findings.push({
      severity: 'critical',
      message: `DNS zone "${targetZone.data.name}" has an invalid zone name: "${zoneName}".`,
    })
  }

  if (targetZone.data?.zoneType === 'Private') {
    const vnetLinks = Array.isArray(targetZone.data?.vnetLinks) ? targetZone.data.vnetLinks : []
    if (vnetLinks.length === 0) {
      findings.push({
        severity: 'warning',
        message: `Private DNS zone "${zoneName}" is not linked to any VNet.`,
      })
    }

    vnetLinks
      .filter((vnetId: string) => !nodes.find((node: any) => node.id === vnetId && node.data?.type === NetworkComponentType.VNET))
      .forEach((missingVnetId: string) => {
        findings.push({
          severity: 'warning',
          message: `Private DNS zone "${zoneName}" references missing VNet link "${missingVnetId}".`,
        })
      })
  }

  findings.push(...validateDnsRecords(recordSets, zoneName))

  if (test.condition.hostname) {
    const resolution = resolveDnsHostname(test.condition.hostname, zoneName, recordSets)
    if (!resolution.success) {
      findings.push({ severity: 'critical', message: resolution.message })
      return buildFindingsResult(
        'DNS validation',
        dedupeFindings(findings),
        `Attempted to resolve ${test.condition.hostname} in zone "${zoneName}".`,
        timestamp,
      )
    }

    return buildFindingsResult(
      'DNS validation',
      dedupeFindings(findings),
      `Resolved ${test.condition.hostname} -> ${resolution.values.join(', ')} in zone "${zoneName}".`,
      timestamp,
      {
        path: ['DNS Client', targetZone.id, resolution.values[0]],
      }
    )
  }

  if (recordSets.length === 0) {
    findings.push({
      severity: 'warning',
      message: `DNS zone "${zoneName}" has no record sets configured.`,
    })
  }

  return buildFindingsResult(
    'DNS validation',
    dedupeFindings(findings),
    `Validated zone "${zoneName}" with ${recordSets.length} record set(s).`,
    timestamp,
  )
}

function buildFindingsResult(
  title: string,
  findings: TestFinding[],
  successMessage: string,
  timestamp: string,
  extras: Partial<TestResult> = {},
): TestResult {
  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const warningCount = findings.length - criticalCount
  const details = findings.map(f => f.message)

  if (criticalCount > 0) {
    return {
      ...extras,
      status: 'fail',
      message: `${title} found ${criticalCount} critical issue(s)${warningCount > 0 ? ` and ${warningCount} warning(s)` : ''}. ${successMessage}`,
      details,
      timestamp,
    }
  }

  if (warningCount > 0) {
    return {
      ...extras,
      status: 'warning',
      message: `${title} found ${warningCount} warning(s). ${successMessage}`,
      details,
      timestamp,
    }
  }

  return {
    ...extras,
    status: 'pass',
    message: successMessage,
    details: details.length > 0 ? details : undefined,
    timestamp,
  }
}

function dedupeFindings(findings: TestFinding[]): TestFinding[] {
  const seen = new Set<string>()
  return findings.filter((finding) => {
    const key = `${finding.severity}:${finding.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getAssociatedNsgIdsForSubnet(subnet: any, nodes: any[], edges: any[]): string[] {
  const ids = new Set<string>()

  if (subnet.data?.nsgId) ids.add(subnet.data.nsgId)

  edges
    .filter((edge: any) => edge.source === subnet.id || edge.target === subnet.id)
    .forEach((edge: any) => {
      const otherId = edge.source === subnet.id ? edge.target : edge.source
      const otherNode = nodes.find((node: any) => node.id === otherId)
      if (otherNode?.data?.type === NetworkComponentType.NSG) ids.add(otherId)
    })

  nodes
    .filter((node: any) => node.data?.type === NetworkComponentType.NSG && Array.isArray(node.data?.subnetIds) && node.data.subnetIds.includes(subnet.id))
    .forEach((node: any) => ids.add(node.id))

  return [...ids]
}

function getAssociatedNsgIdsForNic(nic: any, nodes: any[], edges: any[]): string[] {
  const ids = new Set<string>()

  if (nic.data?.nsgId) ids.add(nic.data.nsgId)

  edges
    .filter((edge: any) => edge.source === nic.id || edge.target === nic.id)
    .forEach((edge: any) => {
      const otherId = edge.source === nic.id ? edge.target : edge.source
      const otherNode = nodes.find((node: any) => node.id === otherId)
      if (otherNode?.data?.type === NetworkComponentType.NSG) ids.add(otherId)
    })

  nodes
    .filter((node: any) => node.data?.type === NetworkComponentType.NSG && Array.isArray(node.data?.nicIds) && node.data.nicIds.includes(nic.id))
    .forEach((node: any) => ids.add(node.id))

  return [...ids]
}

function hasExplicitDenyAllInbound(rules: any[]): boolean {
  return rules.some((rule: any) =>
    rule.access === 'Deny'
    && rule.direction === 'Inbound'
    && isWildcardPortRange(rule.destinationPortRange)
    && typeof rule.priority === 'number'
    && rule.priority >= 4090
    && rule.priority <= 4096
  )
}

function isPermissiveSourcePrefix(prefix?: string): boolean {
  return PERMISSIVE_SOURCE_PREFIXES.has(String(prefix || '').trim().toLowerCase())
}

function isWildcardPortRange(range?: string): boolean {
  return String(range || '').trim() === '*'
}

function parsePortSegments(range?: string): Array<[number, number]> {
  const value = String(range || '').trim()
  if (!value) return []
  if (value === '*') return [[0, 65535]]

  return value
    .split(',')
    .map(part => part.trim())
    .flatMap((part) => {
      if (/^\d+$/.test(part)) {
        const port = Number(part)
        return Number.isInteger(port) ? [[port, port] as [number, number]] : []
      }

      const rangeMatch = part.match(/^(\d+)-(\d+)$/)
      if (!rangeMatch) return []

      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      return Number.isInteger(start) && Number.isInteger(end) ? [[Math.min(start, end), Math.max(start, end)] as [number, number]] : []
    })
}

function portRangeIncludesPort(range: string | undefined, port: number): boolean {
  return parsePortSegments(range).some(([start, end]) => port >= start && port <= end)
}

function portRangesOverlap(left?: string, right?: string): boolean {
  const leftSegments = parsePortSegments(left)
  const rightSegments = parsePortSegments(right)
  if (leftSegments.length === 0 || rightSegments.length === 0) {
    return String(left || '').trim() === String(right || '').trim()
  }

  return leftSegments.some(([leftStart, leftEnd]) =>
    rightSegments.some(([rightStart, rightEnd]) => leftStart <= rightEnd && rightStart <= leftEnd)
  )
}

function portRangeCovers(allowRange?: string, denyRange?: string): boolean {
  const allowSegments = parsePortSegments(allowRange)
  const denySegments = parsePortSegments(denyRange)
  if (allowSegments.length === 0 || denySegments.length === 0) {
    return String(allowRange || '').trim() === String(denyRange || '').trim()
  }

  return denySegments.every(([denyStart, denyEnd]) =>
    allowSegments.some(([allowStart, allowEnd]) => allowStart <= denyStart && allowEnd >= denyEnd)
  )
}

function sourcePrefixCovers(allowPrefix?: string, denyPrefix?: string): boolean {
  const normalizedAllow = String(allowPrefix || '').trim().toLowerCase()
  const normalizedDeny = String(denyPrefix || '').trim().toLowerCase()
  return normalizedAllow === normalizedDeny || isPermissiveSourcePrefix(normalizedAllow)
}

function protocolsOverlap(left?: string, right?: string): boolean {
  const a = String(left || '*').trim().toLowerCase()
  const b = String(right || '*').trim().toLowerCase()
  return a === '*' || b === '*' || a === b
}

function resolveLoadBalancingBackends(targetNode: any, nodes: any[], edges: any[]) {
  const backendNicIds = new Set<string>()
  const backendVmIds = new Set<string>()

  if (targetNode.data?.type === NetworkComponentType.LOAD_BALANCER) {
    ;(targetNode.data?.backendPools || []).forEach((pool: any) => {
      ;(pool?.nicIds || []).forEach((nicId: string) => {
        if (nodes.find((node: any) => node.id === nicId)) backendNicIds.add(nicId)
      })
    })
  }

  if (targetNode.data?.type === NetworkComponentType.APP_GATEWAY) {
    ;(targetNode.data?.backendPools || []).forEach((backendId: string) => {
      const backendNode = nodes.find((node: any) => node.id === backendId)
      if (!backendNode) return
      if (backendNode.data?.type === NetworkComponentType.NETWORK_IC) backendNicIds.add(backendNode.id)
      if (isBackendVmNode(backendNode)) backendVmIds.add(backendNode.id)
    })
  }

  getConnectedNodes(targetNode.id, nodes, edges).forEach((node: any) => {
    if (node.data?.type === NetworkComponentType.NETWORK_IC) backendNicIds.add(node.id)
    if (isBackendVmNode(node)) backendVmIds.add(node.id)
  })

  backendNicIds.forEach((nicId: string) => {
    const vmNode = resolveVmForNic(nicId, nodes, edges)
    if (vmNode) backendVmIds.add(vmNode.id)
  })

  return {
    backendNicNodes: [...backendNicIds]
      .map((nicId) => nodes.find((node: any) => node.id === nicId))
      .filter(Boolean),
    backendVmNodes: [...backendVmIds]
      .map((vmId) => nodes.find((node: any) => node.id === vmId))
      .filter(Boolean),
  }
}

function resolveFrontendPublicIps(targetNode: any, nodes: any[], edges: any[]) {
  const ipIds = new Set<string>()

  if (targetNode.data?.type === NetworkComponentType.LOAD_BALANCER) {
    ;(targetNode.data?.frontendIpConfigs || []).forEach((frontend: any) => {
      if (frontend?.publicIpId) ipIds.add(frontend.publicIpId)
    })
  }

  if (targetNode.data?.type === NetworkComponentType.APP_GATEWAY && targetNode.data?.frontendIpId) {
    ipIds.add(targetNode.data.frontendIpId)
  }

  getConnectedNodes(targetNode.id, nodes, edges)
    .filter((node: any) => node.data?.type === NetworkComponentType.IP_ADDRESS)
    .forEach((node: any) => ipIds.add(node.id))

  return [...ipIds]
    .map((id) => nodes.find((node: any) => node.id === id))
    .filter(Boolean)
}

function resolveInternalLoadBalancerVnetIds(targetNode: any, nodes: any[]): string[] {
  const vnetIds = new Set<string>()

  ;(targetNode.data?.frontendIpConfigs || []).forEach((frontend: any) => {
    if (!frontend?.subnetId) return
    const subnet = nodes.find((node: any) => node.id === frontend.subnetId)
    const vnetId = subnet ? resolveNodeVnetId(subnet, nodes) : undefined
    if (vnetId) vnetIds.add(vnetId)
  })

  return [...vnetIds]
}

function resolveNodeVnetId(node: any, nodes: any[]): string | undefined {
  if (!node) return undefined
  if (node.data?.type === NetworkComponentType.VNET) return node.id
  if (node.data?.type === NetworkComponentType.SUBNET) return node.data?.vnetId || node.parentNode
  if (node.data?.vnetId) return node.data.vnetId

  if (node.data?.subnetId) {
    const subnetNode = nodes.find((candidate: any) => candidate.id === node.data.subnetId)
    return subnetNode ? resolveNodeVnetId(subnetNode, nodes) : undefined
  }

  if (Array.isArray(node.data?.nicIds) && node.data.nicIds.length > 0) {
    const firstNic = nodes.find((candidate: any) => candidate.id === node.data.nicIds[0])
    return firstNic ? resolveNodeVnetId(firstNic, nodes) : undefined
  }

  if (node.parentNode) {
    const parentNode = nodes.find((candidate: any) => candidate.id === node.parentNode)
    return parentNode ? resolveNodeVnetId(parentNode, nodes) : undefined
  }

  return undefined
}

function resolveVmForNic(nicId: string, nodes: any[], edges: any[]) {
  const vmFromNode = nodes.find((node: any) => isBackendVmNode(node) && Array.isArray(node.data?.nicIds) && node.data.nicIds.includes(nicId))
  if (vmFromNode) return vmFromNode

  const linkedEdge = edges.find((edge: any) =>
    (edge.source === nicId && isBackendVmNode(nodes.find((node: any) => node.id === edge.target)))
    || (edge.target === nicId && isBackendVmNode(nodes.find((node: any) => node.id === edge.source)))
  )

  if (!linkedEdge) return null
  const vmId = linkedEdge.source === nicId ? linkedEdge.target : linkedEdge.source
  return nodes.find((node: any) => node.id === vmId) || null
}

function isBackendVmNode(node: any): boolean {
  return node?.data?.type === NetworkComponentType.VM || node?.data?.type === NetworkComponentType.VMSS
}

function getConnectedNodes(nodeId: string, nodes: any[], edges: any[]) {
  return edges
    .filter((edge: any) => edge.source === nodeId || edge.target === nodeId)
    .map((edge: any) => {
      const otherId = edge.source === nodeId ? edge.target : edge.source
      return nodes.find((node: any) => node.id === otherId)
    })
    .filter(Boolean)
}

function getLoadBalancingResourceLabel(node: any): string {
  return node.data?.type === NetworkComponentType.APP_GATEWAY ? 'Application Gateway' : 'Load Balancer'
}

function resolveTestSourceLabel(sourceId: string | undefined, nodes: any[]): string {
  if (!sourceId) return 'Client'
  if (sourceId === INTERNET_SOURCE_ID) return 'Internet'
  return sourceId
}

function buildLoadBalancingPath(sourceId: string, targetId: string, backendVmNodes: any[]): string[] {
  // Include all backend VM IDs so the animation can traverse each one
  return [sourceId, targetId, ...backendVmNodes.map(n => n.id)]
}

function validateDnsRecords(recordSets: any[], zoneName: string): TestFinding[] {
  const findings: TestFinding[] = []
  const normalizedZone = normalizeDnsName(zoneName)
  const cnameTargets = new Set<string>()

  recordSets.forEach((record: any) => {
    const recordName = normalizeDnsRecordName(record?.name)
    const values = Array.isArray(record?.values) ? record.values : []

    if (!isValidDnsRecordName(recordName)) {
      findings.push({
        severity: 'critical',
        message: `DNS record "${record?.name || '(empty)'}" in zone "${zoneName}" has an invalid record name.`,
      })
    }

    if (!Number.isFinite(record?.ttl) || Number(record.ttl) <= 0) {
      findings.push({
        severity: 'critical',
        message: `DNS record "${record?.name || '@'}" in zone "${zoneName}" has an invalid TTL value.`,
      })
    }

    if (record?.type === 'A' && values.some((value: string) => !isValidIpv4(value))) {
      findings.push({
        severity: 'critical',
        message: `A record "${record?.name || '@'}" in zone "${zoneName}" contains an invalid IPv4 address.`,
      })
    }

    if (record?.type === 'AAAA' && values.some((value: string) => !isValidIpv6(value))) {
      findings.push({
        severity: 'critical',
        message: `AAAA record "${record?.name || '@'}" in zone "${zoneName}" contains an invalid IPv6 address.`,
      })
    }

    if (record?.type === 'CNAME') {
      if (values.length !== 1 || !isValidDnsPointer(values[0])) {
        findings.push({
          severity: 'critical',
          message: `CNAME record "${record?.name || '@'}" in zone "${zoneName}" must contain exactly one valid hostname target.`,
        })
      } else {
        cnameTargets.add(normalizeDnsName(values[0]))
      }
    }

    if (record?.type === 'MX' && values.some((value: string) => !/^\d+\s+[^\s]+$/.test(String(value).trim()))) {
      findings.push({
        severity: 'critical',
        message: `MX record "${record?.name || '@'}" in zone "${zoneName}" must use the format "priority hostname".`,
      })
    }
  })

  recordSets
    .filter((record: any) => record?.type === 'CNAME')
    .forEach((record: any) => {
      const target = normalizeDnsName(record.values?.[0])
      const targetRelativeName = toRelativeDnsRecordName(target, normalizedZone)
      const targetRecord = recordSets.find((candidate: any) => normalizeDnsRecordName(candidate?.name) === targetRelativeName)
      if (targetRecord?.type === 'CNAME') {
        findings.push({
          severity: 'warning',
          message: `CNAME record "${record?.name || '@'}" in zone "${zoneName}" points to another CNAME record ("${targetRecord.name}").`,
        })
      }
    })

  return findings
}

function resolveDnsHostname(hostname: string, zoneName: string, recordSets: any[]) {
  const zone = normalizeDnsName(zoneName)
  const requestedName = normalizeDnsName(hostname)
  const initialRecordName = toRelativeDnsRecordName(requestedName, zone)
  return resolveDnsRecordName(initialRecordName, zone, recordSets, new Set<string>())
}

function resolveDnsRecordName(recordName: string, zoneName: string, recordSets: any[], visited: Set<string>) {
  const normalizedRecordName = normalizeDnsRecordName(recordName)
  if (visited.has(normalizedRecordName)) {
    return { success: false, message: `CNAME loop detected while resolving ${recordName}.${zoneName}.` }
  }

  visited.add(normalizedRecordName)

  const matchingRecords = recordSets.filter((record: any) => normalizeDnsRecordName(record?.name) === normalizedRecordName)
  const addressRecord = matchingRecords.find((record: any) => record?.type === 'A' || record?.type === 'AAAA')
  if (addressRecord) {
    return {
      success: true,
      values: Array.isArray(addressRecord.values) ? addressRecord.values : [],
    }
  }

  const cnameRecord = matchingRecords.find((record: any) => record?.type === 'CNAME')
  if (cnameRecord) {
    const target = normalizeDnsName(cnameRecord.values?.[0])
    if (!target) {
      return { success: false, message: `CNAME record "${cnameRecord.name}" in zone "${zoneName}" has no target.` }
    }

    const targetRecordName = toRelativeDnsRecordName(target, zoneName)
    const targetIsInternal = target === normalizeDnsName(zoneName) || target.endsWith(`.${normalizeDnsName(zoneName)}`) || !target.includes('.')
    if (!targetIsInternal) {
      return { success: true, values: [target] }
    }

    return resolveDnsRecordName(targetRecordName, zoneName, recordSets, visited)
  }

  return {
    success: false,
    message: `No record found for ${recordName === '@' ? zoneName : `${recordName}.${zoneName}`} in zone "${zoneName}".`,
  }
}

function normalizeDnsName(value: string): string {
  return String(value || '').trim().replace(/\.$/, '').toLowerCase()
}

function normalizeDnsRecordName(value: string): string {
  const normalized = normalizeDnsName(value)
  return normalized === '' ? '@' : normalized
}

function toRelativeDnsRecordName(hostname: string, zoneName: string): string {
  const normalizedHost = normalizeDnsName(hostname)
  const normalizedZone = normalizeDnsName(zoneName)

  if (!normalizedHost || normalizedHost === normalizedZone) return '@'
  if (normalizedHost.endsWith(`.${normalizedZone}`)) {
    return normalizeDnsRecordName(normalizedHost.slice(0, -(normalizedZone.length + 1)))
  }
  return normalizeDnsRecordName(normalizedHost)
}

function isValidDnsZoneName(zoneName: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(normalizeDnsName(zoneName))
}

function isValidDnsRecordName(recordName: string): boolean {
  if (recordName === '@') return true
  return /^(?:[a-z0-9_](?:[a-z0-9-_]{0,61}[a-z0-9_])?)(?:\.[a-z0-9_](?:[a-z0-9-_]{0,61}[a-z0-9_])?)*$/i.test(recordName)
}

function isValidDnsPointer(value: string): boolean {
  const normalized = normalizeDnsName(value)
  return isValidDnsRecordName(normalized) || isValidDnsZoneName(normalized)
}

function isValidIpv4(value: string): boolean {
  const parts = String(value || '').trim().split('.')
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

function isValidIpv6(value: string): boolean {
  return /^[0-9a-f:]+$/i.test(String(value || '').trim()) && String(value || '').includes(':')
}

function findConnectionPath(sourceId: string, targetId: string, nodes: DiagramEntity[], edges: any[]): string[] {
  const relationships = buildRelationshipGraph(nodes, edges)
  const visited = new Set<string>()
  const queue: string[][] = [[sourceId]]

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]
    if (current === targetId) return path
    if (visited.has(current)) continue
    visited.add(current)

    const neighbors = [...(relationships.get(current) || [])]
      .filter((id: string) => !visited.has(id))

    for (const neighbor of neighbors) {
      queue.push([...path, neighbor])
    }
  }

  return []
}

function buildRelationshipGraph(nodes: DiagramEntity[], edges: any[]): RelationshipGraph {
  const graph: RelationshipGraph = new Map()
  const nodeIds = new Set(nodes.map(node => node.id))

  const connect = (left?: string | null, right?: string | null) => {
    if (!left || !right || left === right) return
    if (!nodeIds.has(left) || !nodeIds.has(right)) return

    if (!graph.has(left)) graph.set(left, new Set())
    if (!graph.has(right)) graph.set(right, new Set())

    graph.get(left)!.add(right)
    graph.get(right)!.add(left)
  }

  for (const node of nodes) {
    if (!graph.has(node.id)) graph.set(node.id, new Set())
  }

  edges.forEach((edge: any) => connect(edge.source, edge.target))

  nodes.forEach((node) => {
    const data = node.data || {}
    const parentLink = getParentRelationship(node)
    if (parentLink) connect(node.id, parentLink)

    if (Array.isArray(data.nicIds)) {
      data.nicIds.forEach((nicId: string) => connect(node.id, nicId))
    }

    if (Array.isArray(data.subnetIds)) {
      data.subnetIds.forEach((subnetId: string) => connect(node.id, subnetId))
    }

    if (Array.isArray(data.asgIds)) {
      data.asgIds.forEach((asgId: string) => connect(node.id, asgId))
    }

    if (Array.isArray(data.publicIpIds)) {
      data.publicIpIds.forEach((publicIpId: string) => connect(node.id, publicIpId))
    }

    if (Array.isArray(data.vnetLinks)) {
      data.vnetLinks.forEach((vnetId: string) => connect(node.id, vnetId))
    }

    if (Array.isArray(data.virtualNetworkRules)) {
      data.virtualNetworkRules.forEach((resourceId: string) => connect(node.id, resourceId))
    }

    if (Array.isArray(data.backendPools)) {
      data.backendPools.forEach((backendPool: any) => {
        if (typeof backendPool === 'string') connect(node.id, backendPool)
        if (Array.isArray(backendPool?.nicIds)) {
          backendPool.nicIds.forEach((nicId: string) => connect(node.id, nicId))
        }
      })
    }

    if (Array.isArray(data.frontendIpConfigs)) {
      data.frontendIpConfigs.forEach((frontend: any) => {
        connect(node.id, frontend?.subnetId)
        connect(node.id, frontend?.publicIpId)
      })
    }

    connect(node.id, data.subnetId)
    connect(node.id, data.vnetId)
    connect(node.id, data.nsgId)
    connect(node.id, data.routeTableId)
    connect(node.id, data.publicIpId)
    connect(node.id, data.frontendIpId)
    connect(node.id, data.gatewayIpId)
    connect(node.id, data.associatedTo)
    connect(node.id, data.localVnetId)
    connect(node.id, data.remoteVnetId)
    connect(node.id, data.storageAccountId)
    connect(node.id, data.privateLinkServiceId)
    connect(node.id, data.dnsZoneGroupId)
    connect(node.id, data.attachedToVmId)
    connect(node.id, data.assignedToId)
    connect(node.id, data.vnetIntegrationSubnetId)
  })

  return graph
}

function getParentRelationship(node: DiagramEntity): string | undefined {
  const data = node.data || {}

  if (data.type === NetworkComponentType.SUBNET && data.vnetId) return data.vnetId
  if (data.type === NetworkComponentType.FIREWALL && data.vnetId) return data.vnetId
  if (data.type === NetworkComponentType.APP_SERVICE && data.vnetIntegrationSubnetId) return data.vnetIntegrationSubnetId
  if (data.type === NetworkComponentType.FUNCTIONS && data.vnetIntegrationSubnetId) return data.vnetIntegrationSubnetId

  if (data.type === NetworkComponentType.VM && Array.isArray(data.nicIds) && data.nicIds.length > 0) return undefined

  if (data.subnetId) return data.subnetId

  return node.parentNode
}

function findBlockingNsgId(path: string[], nodes: any[], condition: TestCondition): string | null {
  for (const nodeId of path) {
    const node = nodes.find((n: any) => n.id === nodeId)
    if (node?.data?.type === NetworkComponentType.NSG) {
      const rules = node.data.securityRules || []
      for (const rule of rules) {
        if (rule.access === 'Deny' && rule.direction === 'Inbound') {
          if (condition.port &&
              rule.destinationPortRange !== '*' &&
              rule.destinationPortRange === String(condition.port)) {
            return nodeId
          }
          if (rule.destinationPortRange === '*' && rule.priority >= 4000) {
            return nodeId
          }
        }
      }
    }
  }
  return null
}

function checkNsgBlocking(path: string[], nodes: any[], condition: TestCondition): string | null {
  for (const nodeId of path) {
    const node = nodes.find((n: any) => n.id === nodeId)
    if (node?.data?.type === NetworkComponentType.NSG) {
      const rules = node.data.securityRules || []
      for (const rule of rules) {
        if (rule.access === 'Deny' && rule.direction === 'Inbound') {
          if (condition.port &&
              rule.destinationPortRange !== '*' &&
              rule.destinationPortRange === String(condition.port)) {
            return `NSG "${node.data.name}" rule "${rule.name}" blocks port ${condition.port}`
          }
          if (rule.destinationPortRange === '*' && rule.priority >= 4000) {
            return `NSG "${node.data.name}" default deny rule`
          }
        }
      }
    }
  }
  return null
}

function checkOpenPorts(nsgNodes: any[]): string[] {
  const dangerousPorts = ['22', '3389', '23', '21', '25']
  const openPorts: string[] = []

  for (const nsg of nsgNodes) {
    const rules = nsg.data?.securityRules || []
    for (const rule of rules) {
      if (rule.access === 'Allow' && rule.direction === 'Inbound' &&
          (rule.sourceAddressPrefix === '*' || rule.sourceAddressPrefix === 'Internet')) {
        if (dangerousPorts.includes(rule.destinationPortRange)) {
          openPorts.push(`Port ${rule.destinationPortRange} (${nsg.data.name})`)
        }
      }
    }
  }

  return openPorts
}
