import { defineStore } from 'pinia'
import type { NetworkTest, TestResult, TestType, TestStatus, TestCondition } from '~/types/test'
import { INTERNET_SOURCE_ID } from '~/types/test'
import { NetworkComponentType } from '~/types/network'

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
      if (!test) return

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

  const path = findPath(sourceNode.id, targetNode.id, nodes, edges)
  if (!path || path.length === 0) {
    return {
      status: 'warning',
      message: `No path found between ${sourceNode.data.name} and ${targetNode.data.name}. Components may be in different VNets.`,
      timestamp,
    }
  }

  const nsgBlocking = checkNsgBlocking(path, nodes, test.condition)
  if (nsgBlocking) {
    return { status: 'fail', message: `Connection blocked by NSG: ${nsgBlocking}`, timestamp, path }
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

function simulateInternetConnectionTest(test: NetworkTest, nodes: any[], timestamp: string): TestResult {
  const { targetId, port } = test.condition
  const targetNode = nodes.find((n: any) => n.id === targetId)

  if (!targetNode) {
    return { status: 'fail', message: 'Target component not found in diagram', timestamp }
  }

  const d = targetNode.data as any
  const portStr = port ? String(port) : undefined

  // Collect NSGs that apply to this target: NIC NSGs and Subnet NSG
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
    return {
      status: 'warning',
      message: `No NSGs found protecting ${d.name}. Inbound port ${port ?? 'any'} traffic from Internet is unrestricted.`,
      timestamp,
    }
  }

  // Check rules from highest-priority (lowest priority number) first
  for (const nsg of applicableNsgs) {
    const rules = (nsg.data?.securityRules || []).slice().sort((a: any, b: any) => a.priority - b.priority)
    for (const rule of rules) {
      if (rule.direction !== 'Inbound') continue
      const portMatches = !portStr || rule.destinationPortRange === '*' || rule.destinationPortRange === portStr
      if (!portMatches) continue
      if (rule.access === 'Deny') {
        return {
          status: 'fail',
          message: `Connection from Internet to ${d.name}:${port} blocked by NSG "${nsg.data.name}" rule "${rule.name}"`,
          path: ['Internet', `NSG: ${nsg.data.name}`, d.name],
          timestamp,
        }
      }
      if (rule.access === 'Allow') {
        return {
          status: 'pass',
          message: `Connection from Internet to ${d.name}:${port} is allowed by NSG "${nsg.data.name}" rule "${rule.name}"`,
          path: ['Internet', d.name],
          hopCount: 3,
          latencyMs: Math.floor(Math.random() * 20) + 5,
          timestamp,
        }
      }
    }
  }

  // No matching rule found — default Azure deny
  return {
    status: 'fail',
    message: `No matching Allow rule found on NSGs for ${d.name}:${port}. Traffic blocked by default deny.`,
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

function findPath(sourceId: string, targetId: string, nodes: any[], edges: any[]): string[] {
  const visited = new Set<string>()
  const queue: string[][] = [[sourceId]]

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]
    if (current === targetId) return path
    if (visited.has(current)) continue
    visited.add(current)

    const neighbors = edges
      .filter((e: any) => e.source === current || e.target === current)
      .map((e: any) => e.source === current ? e.target : e.source)
      .filter((id: string) => !visited.has(id))

    for (const neighbor of neighbors) {
      queue.push([...path, neighbor])
    }
  }

  return []
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
