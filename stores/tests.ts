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
    testSummary(): { total: number; passed: number; failed: number; pending: number } {
      return {
        total: this.tests.length,
        passed: this.tests.filter(t => t.result?.status === 'pass').length,
        failed: this.tests.filter(t => t.result?.status === 'fail').length,
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
    } else if (test.type === 'security') {
      return simulateSecurityTest(test, nodes, edges, timestamp)
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

function simulateSecurityTest(test: NetworkTest, nodes: any[], edges: any[], timestamp: string): TestResult {
  const nsgNodes = nodes.filter(n => n.data?.type === NetworkComponentType.NSG)
  const subnetNodes = nodes.filter(n => n.data?.type === NetworkComponentType.SUBNET)

  if (nsgNodes.length === 0) {
    return {
      status: 'warning',
      message: 'No NSGs found in the diagram. All traffic is unrestricted.',
      timestamp,
    }
  }

  const unsecuredSubnets = subnetNodes.filter((subnet: any) => {
    const hasNsg = edges.some((e: any) =>
      (e.source === subnet.id && nodes.find((n: any) => n.id === e.target)?.data?.type === NetworkComponentType.NSG) ||
      (e.target === subnet.id && nodes.find((n: any) => n.id === e.source)?.data?.type === NetworkComponentType.NSG)
    )
    return !hasNsg && !subnet.data?.nsgId
  })

  if (unsecuredSubnets.length > 0) {
    return {
      status: 'warning',
      message: `${unsecuredSubnets.length} subnet(s) without NSG protection: ${unsecuredSubnets.map((s: any) => s.data.name).join(', ')}`,
      timestamp,
    }
  }

  const openPorts = checkOpenPorts(nsgNodes)
  if (openPorts.length > 0) {
    return {
      status: 'warning',
      message: `Potentially dangerous open ports detected: ${openPorts.join(', ')}`,
      timestamp,
    }
  }

  return {
    status: 'pass',
    message: `Security check passed. All ${nsgNodes.length} NSGs are properly configured.`,
    timestamp,
  }
}

function simulateLoadBalanceTest(test: NetworkTest, nodes: any[], edges: any[], timestamp: string): TestResult {
  const lbNodes = nodes.filter(n => n.data?.type === NetworkComponentType.LOAD_BALANCER)

  if (lbNodes.length === 0) {
    return { status: 'fail', message: 'No Load Balancers found in the diagram', timestamp }
  }

  const targetLb = test.condition.targetId
    ? lbNodes.find((n: any) => n.id === test.condition.targetId)
    : lbNodes[0]

  if (!targetLb) {
    return { status: 'fail', message: 'Target Load Balancer not found', timestamp }
  }

  const backendVms = edges
    .filter((e: any) => e.source === targetLb.id || e.target === targetLb.id)
    .map((e: any) => {
      const otherId = e.source === targetLb.id ? e.target : e.source
      return nodes.find((n: any) => n.id === otherId)
    })
    .filter((n: any) => n?.data?.type === NetworkComponentType.VM || n?.data?.type === NetworkComponentType.VMSS)

  if (backendVms.length === 0) {
    return {
      status: 'warning',
      message: `Load Balancer "${targetLb.data.name}" has no backend VM connections`,
      timestamp,
    }
  }

  const rps = Math.floor(Math.random() * 5000) + 1000
  const distribution = backendVms.map((vm: any) => ({
    name: vm.data.name,
    percentage: Math.floor(100 / backendVms.length),
  }))

  return {
    status: 'pass',
    message: `Load balancing active across ${backendVms.length} instances. Simulated ${rps} req/s. Distribution: ${distribution.map((d: any) => `${d.name}: ${d.percentage}%`).join(', ')}`,
    timestamp,
  }
}

function simulateDnsTest(test: NetworkTest, nodes: any[], edges: any[], timestamp: string): TestResult {
  const dnsNodes = nodes.filter(n => n.data?.type === NetworkComponentType.DNS_ZONE)

  if (dnsNodes.length === 0) {
    return {
      status: 'warning',
      message: 'No DNS Zones configured. Using Azure default DNS.',
      timestamp,
      latencyMs: 1,
    }
  }

  const targetZone = test.condition.targetId
    ? dnsNodes.find((n: any) => n.id === test.condition.targetId)
    : dnsNodes[0]

  if (!targetZone) {
    return { status: 'fail', message: 'Target DNS zone not found', timestamp }
  }

  const recordSets = targetZone.data?.recordSets || []
  if (recordSets.length === 0) {
    const simulatedIp = `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`
    return {
      status: 'pass',
      message: `DNS resolution successful for zone "${targetZone.data.zoneName}". Simulated IP: ${simulatedIp}`,
      timestamp,
      latencyMs: Math.floor(Math.random() * 3) + 1,
    }
  }

  return {
    status: 'pass',
    message: `DNS zone "${targetZone.data.zoneName}" has ${recordSets.length} record set(s) configured.`,
    timestamp,
    latencyMs: 1,
  }
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
