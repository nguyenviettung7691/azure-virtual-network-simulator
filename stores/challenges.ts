import { defineStore } from 'pinia'
import type {
  Challenge,
  ChallengeComponentRequirement,
  ChallengeComponentSelector,
  ChallengeCondition,
  ChallengeGenerationDefaults,
  ChallengeGenerationOptions,
  ChallengeTaskConditions,
  ChallengeNetworkRequirement,
  ChallengeSecurityRequirement,
  ChallengeTask,
} from '~/types/challenge'
import { ChallengeDifficulty } from '~/types/challenge'
import { NetworkComponentType } from '~/types/network'

type ChallengeOutcome = 'won' | 'lost' | null
type ChallengeEndReason = 'completed' | 'timeout' | null

const MIN_TASK_COUNT = 1
const MAX_TASK_COUNT = 10
const MIN_COMPONENT_COUNT = 2
const MAX_COMPONENT_COUNT = 15
const MIN_TIME_LIMIT_SECONDS = 60
const MAX_TIME_LIMIT_SECONDS = 7200

export const CHALLENGE_DIFFICULTY_DEFAULTS: Record<ChallengeDifficulty, ChallengeGenerationDefaults> = {
  [ChallengeDifficulty.BEGINNER]: {
    timeLimitSeconds: 600,
    taskCount: 3,
    componentCount: 4,
  },
  [ChallengeDifficulty.INTERMEDIATE]: {
    timeLimitSeconds: 900,
    taskCount: 5,
    componentCount: 6,
  },
  [ChallengeDifficulty.ADVANCED]: {
    timeLimitSeconds: 1200,
    taskCount: 6,
    componentCount: 8,
  },
  [ChallengeDifficulty.EXPERT]: {
    timeLimitSeconds: 1800,
    taskCount: 7,
    componentCount: 10,
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function getChallengeDefaults(difficulty: ChallengeDifficulty): ChallengeGenerationDefaults {
  return { ...CHALLENGE_DIFFICULTY_DEFAULTS[difficulty] }
}

function resolveGenerationOptions(
  difficulty: ChallengeDifficulty,
  options?: ChallengeGenerationOptions,
): ChallengeGenerationDefaults {
  const defaults = getChallengeDefaults(difficulty)
  if (!options?.useCustom) {
    return defaults
  }

  const resolvedTimeLimit = asFiniteNumber(options.timeLimitSeconds)
  const resolvedTaskCount = asFiniteNumber(options.taskCount)
  const resolvedComponentCount = asFiniteNumber(options.componentCount)

  return {
    timeLimitSeconds: clamp(
      Math.round(resolvedTimeLimit ?? defaults.timeLimitSeconds),
      MIN_TIME_LIMIT_SECONDS,
      MAX_TIME_LIMIT_SECONDS,
    ),
    taskCount: clamp(
      Math.round(resolvedTaskCount ?? defaults.taskCount),
      MIN_TASK_COUNT,
      MAX_TASK_COUNT,
    ),
    componentCount: clamp(
      Math.round(resolvedComponentCount ?? defaults.componentCount),
      MIN_COMPONENT_COUNT,
      MAX_COMPONENT_COUNT,
    ),
  }
}

type DiagramNodeLike = { id: string; data?: any; parentNode?: string }
type DiagramEdgeLike = { source?: string; target?: string }

function normalizeName(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function parseComponentType(value: unknown): NetworkComponentType | undefined {
  if (typeof value !== 'string') return undefined
  const upper = value.trim().toUpperCase()
  return Object.values(NetworkComponentType).find(type => type === upper as NetworkComponentType)
}

function getFieldValue(source: any, fieldPath: string): unknown {
  return fieldPath.split('.').reduce((acc: any, key: string) => acc?.[key], source)
}

function hasExpectedProperty(requirement: ChallengeComponentRequirement, node: DiagramNodeLike): boolean {
  if (!requirement.properties?.length) return true

  return requirement.properties.every(expectation => {
    const value = getFieldValue(node.data || {}, expectation.field)

    if (expectation.exists != null) {
      const exists = value !== null && value !== undefined && value !== ''
      if (exists !== expectation.exists) return false
    }

    if (expectation.equals != null && value !== expectation.equals) return false

    if (expectation.includes != null) {
      if (Array.isArray(value)) {
        if (!value.map(v => String(v)).includes(String(expectation.includes))) return false
      } else if (!String(value ?? '').includes(String(expectation.includes))) {
        return false
      }
    }

    if (expectation.min != null) {
      const numeric = Number(value)
      if (!Number.isFinite(numeric) || numeric < expectation.min) return false
    }

    if (expectation.max != null) {
      const numeric = Number(value)
      if (!Number.isFinite(numeric) || numeric > expectation.max) return false
    }

    return true
  })
}

function isNodeMatchingSelector(node: DiagramNodeLike, selector?: ChallengeComponentSelector): boolean {
  if (!selector) return true

  if (selector.id && node.id !== selector.id) return false
  if (selector.type && node.data?.type !== selector.type) return false
  if (selector.name && normalizeName(node.data?.name) !== normalizeName(selector.name)) return false

  return true
}

function getParentRelationship(node: DiagramNodeLike): string | undefined {
  const data = node.data || {}

  if (data.type === NetworkComponentType.SUBNET && data.vnetId) return data.vnetId
  if (data.type === NetworkComponentType.FIREWALL && data.vnetId) return data.vnetId
  if (data.type === NetworkComponentType.APP_SERVICE && data.vnetIntegrationSubnetId) return data.vnetIntegrationSubnetId
  if (data.type === NetworkComponentType.FUNCTIONS && data.vnetIntegrationSubnetId) return data.vnetIntegrationSubnetId

  if (data.subnetId) return data.subnetId

  return node.parentNode
}

function buildRelationshipGraph(nodes: DiagramNodeLike[], edges: DiagramEdgeLike[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
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

  edges.forEach(edge => connect(edge.source, edge.target))

  nodes.forEach((node) => {
    const data = node.data || {}
    connect(node.id, getParentRelationship(node))

    if (Array.isArray(data.nicIds)) data.nicIds.forEach((id: string) => connect(node.id, id))
    if (Array.isArray(data.subnetIds)) data.subnetIds.forEach((id: string) => connect(node.id, id))
    if (Array.isArray(data.asgIds)) data.asgIds.forEach((id: string) => connect(node.id, id))
    if (Array.isArray(data.publicIpIds)) data.publicIpIds.forEach((id: string) => connect(node.id, id))
    if (Array.isArray(data.vnetLinks)) data.vnetLinks.forEach((id: string) => connect(node.id, id))
    if (Array.isArray(data.virtualNetworkRules)) data.virtualNetworkRules.forEach((id: string) => connect(node.id, id))

    if (Array.isArray(data.backendPools)) {
      data.backendPools.forEach((pool: any) => {
        if (typeof pool === 'string') connect(node.id, pool)
        if (Array.isArray(pool?.nicIds)) pool.nicIds.forEach((id: string) => connect(node.id, id))
      })
    }

    if (Array.isArray(data.frontendIpConfigs)) {
      data.frontendIpConfigs.forEach((frontend: any) => {
        connect(node.id, frontend?.subnetId)
        connect(node.id, frontend?.publicIpId)
      })
    }

    if (Array.isArray(data.routes)) {
      data.routes.forEach((route: any) => {
        connect(node.id, route?.nextHopResourceId)
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

function hasConnectionPath(
  sourceId: string,
  targetId: string,
  graph: Map<string, Set<string>>,
): boolean {
  if (sourceId === targetId) return true

  const visited = new Set<string>()
  const queue: string[] = [sourceId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === targetId) return true
    if (visited.has(current)) continue
    visited.add(current)

    for (const neighbor of graph.get(current) || []) {
      if (!visited.has(neighbor)) queue.push(neighbor)
    }
  }

  return false
}

function resolveSelectorNodes(nodes: DiagramNodeLike[], selector?: ChallengeComponentSelector): DiagramNodeLike[] {
  if (!selector) return [...nodes]
  return nodes.filter(node => isNodeMatchingSelector(node, selector))
}

function resolveRequirementNodes(nodes: DiagramNodeLike[], requirement: ChallengeComponentRequirement): DiagramNodeLike[] {
  const selector: ChallengeComponentSelector | undefined = requirement.selector
    || (requirement.type ? { type: requirement.type } : undefined)

  let candidates = resolveSelectorNodes(nodes, selector)

  if (requirement.names?.length) {
    const expected = new Set(requirement.names.map(normalizeName))
    candidates = candidates.filter(node => expected.has(normalizeName(node.data?.name)))
  }

  if (requirement.parentSelector) {
    const parents = resolveSelectorNodes(nodes, requirement.parentSelector)
    const parentIds = new Set(parents.map(parent => parent.id))
    candidates = candidates.filter(node => {
      const parentId = getParentRelationship(node)
      return !!parentId && parentIds.has(parentId)
    })
  }

  return candidates.filter(node => hasExpectedProperty(requirement, node))
}

function evaluateComponentRequirement(nodes: DiagramNodeLike[], requirement: ChallengeComponentRequirement): boolean {
  const matches = resolveRequirementNodes(nodes, requirement)
  const expectedCount = requirement.count ?? (requirement.names?.length ?? 1)
  return matches.length >= expectedCount
}

function evaluateConnectionRequirement(
  nodes: DiagramNodeLike[],
  graph: Map<string, Set<string>>,
  requirement: { from: ChallengeComponentSelector; to: ChallengeComponentSelector },
): boolean {
  const sources = resolveSelectorNodes(nodes, requirement.from)
  const targets = resolveSelectorNodes(nodes, requirement.to)

  if (!sources.length || !targets.length) return false

  for (const source of sources) {
    for (const target of targets) {
      if (hasConnectionPath(source.id, target.id, graph)) return true
    }
  }

  return false
}

function parseLegacySecurityRequirement(input: string): ChallengeSecurityRequirement | null {
  const normalized = input.trim().toLowerCase()

  if (normalized.includes('nsg') && normalized.includes('subnet')) {
    return { kind: 'nsg_attached_to_subnet' }
  }

  const inboundRule = normalized.match(/(allow|deny).*port\s+(\d{1,5})/)
  if (inboundRule) {
    return {
      kind: 'nsg_has_inbound_rule',
      access: inboundRule[1].toLowerCase() === 'allow' ? 'Allow' : 'Deny',
      port: inboundRule[2],
    }
  }

  return null
}

function parseLegacyNetworkRequirement(input: string): ChallengeNetworkRequirement | null {
  const normalized = input.trim().toLowerCase()

  if (normalized.includes('all vms') && normalized.includes('subnet')) {
    return {
      kind: 'component_in_subnet',
      componentSelector: { type: NetworkComponentType.VM },
    }
  }

  return null
}

function evaluateSecurityRequirement(nodes: DiagramNodeLike[], requirement: ChallengeSecurityRequirement): boolean {
  if (requirement.kind === 'nsg_attached_to_subnet') {
    const subnets = resolveSelectorNodes(nodes, requirement.subnetSelector || { type: NetworkComponentType.SUBNET })
    if (!subnets.length) return false

    const nsgCandidates = requirement.nsgSelector ? resolveSelectorNodes(nodes, requirement.nsgSelector) : []
    const nsgIds = new Set(nsgCandidates.map(node => node.id))

    return subnets.every(subnet => {
      const subnetNsgId = subnet.data?.nsgId
      if (!subnetNsgId) return false
      if (!requirement.nsgSelector) return true
      return nsgIds.has(subnetNsgId)
    })
  }

  if (requirement.kind === 'nsg_has_inbound_rule') {
    const nsgNodes = resolveSelectorNodes(nodes, requirement.nsgSelector || { type: NetworkComponentType.NSG })
    if (!nsgNodes.length) return false

    return nsgNodes.every((nsg) => {
      const rules = Array.isArray(nsg.data?.securityRules) ? nsg.data.securityRules : []
      return rules.some((rule: any) => {
        if (rule.direction !== 'Inbound') return false
        if (requirement.access && rule.access !== requirement.access) return false

        if (requirement.port != null) {
          const port = String(requirement.port)
          const destination = String(rule.destinationPortRange ?? '')
          if (destination !== '*' && destination !== port) return false
        }

        if (requirement.sourceAddressPrefix) {
          const source = String(rule.sourceAddressPrefix ?? '').toLowerCase()
          if (source !== requirement.sourceAddressPrefix.toLowerCase()) return false
        }

        return true
      })
    })
  }

  return false
}

function evaluateNetworkRequirement(nodes: DiagramNodeLike[], requirement: ChallengeNetworkRequirement): boolean {
  if (requirement.kind === 'component_in_subnet') {
    const components = resolveSelectorNodes(nodes, requirement.componentSelector)
    if (!components.length) return false

    let allowedSubnetIds: Set<string> | null = null
    if (requirement.subnetSelector) {
      const subnets = resolveSelectorNodes(nodes, requirement.subnetSelector)
      allowedSubnetIds = new Set(subnets.map(subnet => subnet.id))
      if (!allowedSubnetIds.size) return false
    }

    return components.every((component) => {
      const subnetId = component.data?.subnetId
      if (!subnetId) return false
      if (!allowedSubnetIds) return true
      return allowedSubnetIds.has(subnetId)
    })
  }

  if (requirement.kind === 'subnet_in_vnet') {
    const subnets = resolveSelectorNodes(nodes, requirement.subnetSelector || { type: NetworkComponentType.SUBNET })
      .filter(subnet => requirement.addressPrefix == null || subnet.data?.addressPrefix === requirement.addressPrefix)
    if (!subnets.length) return false

    const vnets = requirement.vnetSelector ? resolveSelectorNodes(nodes, requirement.vnetSelector) : []
    const vnetIds = new Set(vnets.map(vnet => vnet.id))

    return subnets.every((subnet) => {
      const vnetId = subnet.data?.vnetId || subnet.parentNode
      if (!vnetId) return false
      if (!requirement.vnetSelector) return true
      return vnetIds.has(vnetId)
    })
  }

  if (requirement.kind === 'vnet_subnet_count') {
    const vnets = resolveSelectorNodes(nodes, requirement.vnetSelector || { type: NetworkComponentType.VNET })
    if (!vnets.length) return false

    return vnets.some((vnet) => {
      const subnetCount = nodes.filter(node => node.data?.type === NetworkComponentType.SUBNET
        && (node.data?.vnetId === vnet.id || node.parentNode === vnet.id)).length
      return subnetCount >= requirement.minCount
    })
  }

  return false
}

function evaluateTaskConditions(
  conditions: ChallengeTaskConditions,
  nodes: DiagramNodeLike[],
  graph: Map<string, Set<string>>,
): boolean {
  const checks: boolean[] = []

  for (const requirement of conditions.requiredComponents || []) {
    checks.push(evaluateComponentRequirement(nodes, requirement))
  }

  for (const requirement of conditions.componentRequirements || []) {
    checks.push(evaluateComponentRequirement(nodes, requirement))
  }

  for (const requirement of conditions.requiredConnections || []) {
    checks.push(evaluateConnectionRequirement(nodes, graph, requirement))
  }

  for (const requirement of conditions.securityRequirements || []) {
    checks.push(evaluateSecurityRequirement(nodes, requirement))
  }

  for (const requirement of conditions.networkRequirements || []) {
    checks.push(evaluateNetworkRequirement(nodes, requirement))
  }

  if (!checks.length) return false

  if (conditions.mode === 'any') return checks.some(Boolean)
  return checks.every(Boolean)
}

function buildConditionsFromChallenge(task: ChallengeTask, challengeConditions: ChallengeCondition): ChallengeTaskConditions | null {
  const conditions: ChallengeTaskConditions = {}

  if (task.type === 'add_component' || task.type === 'remove_component') {
    if (task.componentType) {
      conditions.requiredComponents = [{ type: task.componentType, count: task.type === 'remove_component' ? 0 : 1 }]
      if (task.type === 'remove_component') {
        return null
      }
    }

    if (Array.isArray(challengeConditions.requiredComponents) && challengeConditions.requiredComponents.length) {
      const parsed = challengeConditions.requiredComponents.map((requirement) => {
        if (typeof requirement === 'string') {
          const type = parseComponentType(requirement)
          if (!type) return null
          return { type, count: 1 } as ChallengeComponentRequirement
        }
        return requirement as ChallengeComponentRequirement
      }).filter((value): value is ChallengeComponentRequirement => value != null)

      if (parsed.length) {
        conditions.requiredComponents = parsed
      }
    }
  }

  if (task.type === 'connect_components' && Array.isArray(challengeConditions.requiredConnections)) {
    const parsed = challengeConditions.requiredConnections.map((connection) => {
      if ('from' in connection && 'to' in connection && typeof connection.from === 'string' && typeof connection.to === 'string') {
        const fromType = parseComponentType(connection.from)
        const toType = parseComponentType(connection.to)
        if (!fromType || !toType) return null
        return {
          from: { type: fromType },
          to: { type: toType },
        }
      }
      return connection as { from: ChallengeComponentSelector; to: ChallengeComponentSelector }
    }).filter((value): value is { from: ChallengeComponentSelector; to: ChallengeComponentSelector } => value != null)

    if (parsed.length) {
      conditions.requiredConnections = parsed
    }
  }

  if ((task.type === 'configure_component' || task.type === 'add_component')
    && Array.isArray(challengeConditions.securityRequirements)) {
    const parsed = challengeConditions.securityRequirements.map((security) => {
      if (typeof security === 'string') return parseLegacySecurityRequirement(security)
      return security as ChallengeSecurityRequirement
    }).filter((value): value is ChallengeSecurityRequirement => value != null)

    if (parsed.length) {
      conditions.securityRequirements = parsed
    }
  }

  if ((task.type === 'configure_component' || task.type === 'add_component')
    && Array.isArray(challengeConditions.networkRequirements)) {
    const parsed = challengeConditions.networkRequirements.map((network) => {
      if (typeof network === 'string') return parseLegacyNetworkRequirement(network)
      return network as ChallengeNetworkRequirement
    }).filter((value): value is ChallengeNetworkRequirement => value != null)

    if (parsed.length) {
      conditions.networkRequirements = parsed
    }
  }

  if (!conditions.requiredComponents?.length
    && !conditions.requiredConnections?.length
    && !conditions.securityRequirements?.length
    && !conditions.networkRequirements?.length
    && !conditions.componentRequirements?.length) {
    return null
  }

  return conditions
}

function evaluateLegacyTaskByType(task: ChallengeTask, nodes: DiagramNodeLike[], edges: DiagramEdgeLike[]): boolean {
  const nodeTypes = nodes.map(n => n.data?.type as NetworkComponentType)

  if (task.type === 'add_component' && task.componentType) {
    return nodeTypes.includes(task.componentType as NetworkComponentType)
  }

  if (task.type === 'connect_components') {
    return edges.length > 0
  }

  if (task.type === 'configure_component' && task.targetComponentId) {
    const target = nodes.find(n => n.id === task.targetComponentId)
    return target != null
  }

  if (task.type === 'remove_component' && task.componentType) {
    return !nodeTypes.includes(task.componentType as NetworkComponentType)
  }

  return task.completed
}

function normalizeChallenge(
  challenge: Challenge,
  difficulty: ChallengeDifficulty,
  options: ChallengeGenerationDefaults,
): Challenge {
  const tasks = Array.isArray(challenge.tasks)
    ? challenge.tasks
      .slice(0, Math.max(MIN_TASK_COUNT, options.taskCount))
      .map(task => ({
        ...task,
        completed: false,
        conditions: task.conditions,
      }))
    : []

  const totalPoints = tasks.reduce((sum, task) => sum + (task.points || 0), 0)

  return {
    ...challenge,
    difficulty,
    tasks,
    totalPoints,
    timeLimit: options.timeLimitSeconds,
  }
}

interface ChallengesState {
  currentChallenge: Challenge | null
  isGenerating: boolean
  showChallengePanel: boolean
  showSetupModal: boolean
  showCongratulations: boolean
  challengeOutcome: ChallengeOutcome
  challengeEndReason: ChallengeEndReason
  finalPoints: number
  error: string | null
  elapsedSeconds: number
  timerInterval: ReturnType<typeof setInterval> | null
}

export const useChallengesStore = defineStore('challenges', {
  state: (): ChallengesState => ({
    currentChallenge: null,
    isGenerating: false,
    showChallengePanel: false,
    showSetupModal: false,
    showCongratulations: false,
    challengeOutcome: null,
    challengeEndReason: null,
    finalPoints: 0,
    error: null,
    elapsedSeconds: 0,
    timerInterval: null,
  }),

  getters: {
    completedTasks(): ChallengeTask[] {
      return this.currentChallenge?.tasks.filter(t => t.completed) || []
    },
    totalTasks(): number {
      return this.currentChallenge?.tasks.length || 0
    },
    progressPercent(): number {
      if (!this.currentChallenge) return 0
      const total = this.currentChallenge.tasks.length
      if (total === 0) return 0
      const completed = this.currentChallenge.tasks.filter(t => t.completed).length
      return Math.round((completed / total) * 100)
    },
    earnedPoints(): number {
      return this.currentChallenge?.tasks
        .filter(t => t.completed)
        .reduce((sum, t) => sum + (t.points || 0), 0) || 0
    },
    isCompleted(): boolean {
      if (!this.currentChallenge) return false
      return this.currentChallenge.tasks.every(t => t.completed)
    },
    remainingTime(): number {
      if (!this.currentChallenge?.timeLimit) return 0
      return Math.max(0, this.currentChallenge.timeLimit - this.elapsedSeconds)
    },
    isActive(): boolean {
      return Boolean(this.currentChallenge)
        && this.challengeOutcome === null
        && this.showChallengePanel
    },
  },

  actions: {
    async generateChallenge(
      difficulty: ChallengeDifficulty,
      existingComponents: NetworkComponentType[],
      options?: ChallengeGenerationOptions,
    ) {
      this.stopTimer()
      this.isGenerating = true
      this.error = null
      this.challengeOutcome = null
      this.challengeEndReason = null
      this.finalPoints = 0
      this.showCongratulations = false

      const resolvedOptions = resolveGenerationOptions(difficulty, options)

      try {
        const { generateChallenge } = await import('~/lib/bedrock')
        const challenge = await generateChallenge({
          difficulty,
          existingComponents,
          options: resolvedOptions,
        })
        this.currentChallenge = normalizeChallenge(challenge, difficulty, resolvedOptions)
        this.showChallengePanel = true
        this.showSetupModal = false
        this.startTimer()
      } catch (err: any) {
        this.error = err.message || 'Failed to generate challenge'
        this.currentChallenge = generateLocalChallenge(difficulty, resolvedOptions)
        this.showChallengePanel = true
        this.showSetupModal = false
        this.startTimer()
      } finally {
        this.isGenerating = false
      }
    },

    evaluateCompletion(nodes: any[], edges: any[]) {
      if (!this.currentChallenge || this.challengeOutcome !== null) return
      const nodeList = nodes as DiagramNodeLike[]
      const edgeList = edges as DiagramEdgeLike[]
      const graph = buildRelationshipGraph(nodeList, edgeList)

      const updatedTasks = this.currentChallenge.tasks.map(task => {
        const effectiveConditions = task.conditions
          || buildConditionsFromChallenge(task, this.currentChallenge!.conditions)

        const completed = effectiveConditions
          ? evaluateTaskConditions(effectiveConditions, nodeList, graph)
          : evaluateLegacyTaskByType(task, nodeList, edgeList)

        return { ...task, completed }
      })

      this.currentChallenge = { ...this.currentChallenge, tasks: updatedTasks }

      if (this.isCompleted && !this.showCongratulations) {
        this.challengeOutcome = 'won'
        this.challengeEndReason = 'completed'
        this.finalPoints = this.earnedPoints
        this.showCongratulations = true
        this.showChallengePanel = false
        this.stopTimer()
      }
    },

    handleTimeExpired() {
      if (!this.currentChallenge || this.challengeOutcome !== null) {
        this.stopTimer()
        return
      }

      this.challengeOutcome = 'lost'
      this.challengeEndReason = 'timeout'
      this.finalPoints = this.earnedPoints
      this.showCongratulations = true
      this.showChallengePanel = false
      this.stopTimer()
    },

    quitChallenge() {
      this.stopTimer()
      this.currentChallenge = null
      this.showChallengePanel = false
      this.showCongratulations = false
      this.challengeOutcome = null
      this.challengeEndReason = null
      this.finalPoints = 0
      this.elapsedSeconds = 0
    },

    openSetupModal() {
      this.error = null
      this.showSetupModal = true
    },

    closeSetupModal() {
      this.showSetupModal = false
    },

    closeCongratulations() {
      this.showCongratulations = false
    },

    startTimer() {
      this.elapsedSeconds = 0
      this.stopTimer()
      this.timerInterval = setInterval(() => {
        this.elapsedSeconds++
        if (this.currentChallenge?.timeLimit && this.elapsedSeconds >= this.currentChallenge.timeLimit) {
          this.handleTimeExpired()
        }
      }, 1000)
    },

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
        this.timerInterval = null
      }
    },
  },
})

function generateLocalChallenge(
  difficulty: ChallengeDifficulty,
  options: ChallengeGenerationDefaults,
): Challenge {
  const taskSets: Record<ChallengeDifficulty, ChallengeTask[]> = {
    [ChallengeDifficulty.BEGINNER]: [
      {
        id: 'task-1', description: 'Create a Virtual Network', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 10,
        conditions: { requiredComponents: [{ type: NetworkComponentType.VNET, count: 1 }] },
      },
      {
        id: 'task-2', description: 'Add a Subnet to your VNet', type: 'add_component', componentType: NetworkComponentType.SUBNET, completed: false, points: 10,
        conditions: { requiredComponents: [{ type: NetworkComponentType.SUBNET, count: 1 }] },
      },
      {
        id: 'task-3', description: 'Add a Virtual Machine', type: 'add_component', componentType: NetworkComponentType.VM, completed: false, points: 10,
        conditions: {
          requiredComponents: [{ type: NetworkComponentType.VM, count: 1 }],
          networkRequirements: [{ kind: 'component_in_subnet', componentSelector: { type: NetworkComponentType.VM } }],
        },
      },
    ],
    [ChallengeDifficulty.INTERMEDIATE]: [
      {
        id: 'task-1', description: 'Create a Virtual Network', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 10,
        conditions: { requiredComponents: [{ type: NetworkComponentType.VNET, count: 1 }] },
      },
      {
        id: 'task-2', description: 'Add two Subnets', type: 'add_component', componentType: NetworkComponentType.SUBNET, completed: false, points: 10,
        conditions: {
          requiredComponents: [{ type: NetworkComponentType.SUBNET, count: 2 }],
          networkRequirements: [{ kind: 'vnet_subnet_count', minCount: 2 }],
        },
      },
      {
        id: 'task-3', description: 'Add a Network Security Group', type: 'add_component', componentType: NetworkComponentType.NSG, completed: false, points: 15,
        conditions: {
          requiredComponents: [{ type: NetworkComponentType.NSG, count: 1 }],
          securityRequirements: [{ kind: 'nsg_attached_to_subnet' }],
        },
      },
      {
        id: 'task-4', description: 'Add a Load Balancer', type: 'add_component', componentType: NetworkComponentType.LOAD_BALANCER, completed: false, points: 15,
        conditions: { requiredComponents: [{ type: NetworkComponentType.LOAD_BALANCER, count: 1 }] },
      },
      {
        id: 'task-5', description: 'Add Virtual Machines', type: 'add_component', componentType: NetworkComponentType.VM, completed: false, points: 10,
        conditions: {
          requiredComponents: [{ type: NetworkComponentType.VM, count: 1 }],
          networkRequirements: [{ kind: 'component_in_subnet', componentSelector: { type: NetworkComponentType.VM } }],
        },
      },
    ],
    [ChallengeDifficulty.ADVANCED]: [
      {
        id: 'task-1', description: 'Create a Hub VNet', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 10,
        conditions: { requiredComponents: [{ type: NetworkComponentType.VNET, count: 1 }] },
      },
      {
        id: 'task-2', description: 'Add NSGs with security rules', type: 'add_component', componentType: NetworkComponentType.NSG, completed: false, points: 20,
        conditions: {
          requiredComponents: [{ type: NetworkComponentType.NSG, count: 1 }],
          securityRequirements: [{ kind: 'nsg_has_inbound_rule', access: 'Allow', port: 443 }],
        },
      },
      {
        id: 'task-3', description: 'Add an Azure Firewall', type: 'add_component', componentType: NetworkComponentType.FIREWALL, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.FIREWALL, count: 1 }] },
      },
      {
        id: 'task-4', description: 'Configure UDR routing', type: 'add_component', componentType: NetworkComponentType.UDR, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.UDR, count: 1 }] },
      },
      {
        id: 'task-5', description: 'Add VPN Gateway', type: 'add_component', componentType: NetworkComponentType.VPN_GATEWAY, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.VPN_GATEWAY, count: 1 }] },
      },
      {
        id: 'task-6', description: 'Set up VNet Peering', type: 'add_component', componentType: NetworkComponentType.VNET_PEERING, completed: false, points: 10,
        conditions: { requiredComponents: [{ type: NetworkComponentType.VNET_PEERING, count: 1 }] },
      },
    ],
    [ChallengeDifficulty.EXPERT]: [
      {
        id: 'task-1', description: 'Design a Hub-Spoke architecture with 3 VNets', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.VNET, count: 3 }] },
      },
      {
        id: 'task-2', description: 'Add Azure Firewall in hub', type: 'add_component', componentType: NetworkComponentType.FIREWALL, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.FIREWALL, count: 1 }] },
      },
      {
        id: 'task-3', description: 'Configure AKS cluster', type: 'add_component', componentType: NetworkComponentType.AKS, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.AKS, count: 1 }] },
      },
      {
        id: 'task-4', description: 'Add Application Gateway with WAF', type: 'add_component', componentType: NetworkComponentType.APP_GATEWAY, completed: false, points: 20,
        conditions: {
          requiredComponents: [{ type: NetworkComponentType.APP_GATEWAY, count: 1 }],
          componentRequirements: [{ type: NetworkComponentType.APP_GATEWAY, properties: [{ field: 'enableWaf', equals: true }] }],
        },
      },
      {
        id: 'task-5', description: 'Configure Private Endpoints', type: 'add_component', componentType: NetworkComponentType.PRIVATE_ENDPOINT, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.PRIVATE_ENDPOINT, count: 1 }] },
      },
      {
        id: 'task-6', description: 'Add Azure Bastion', type: 'add_component', componentType: NetworkComponentType.BASTION, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.BASTION, count: 1 }] },
      },
      {
        id: 'task-7', description: 'Set up VNet Peering for all VNets', type: 'add_component', componentType: NetworkComponentType.VNET_PEERING, completed: false, points: 20,
        conditions: { requiredComponents: [{ type: NetworkComponentType.VNET_PEERING, count: 1 }] },
      },
    ],
  }

  const tasks = taskSets[difficulty].slice(0, Math.max(MIN_TASK_COUNT, options.taskCount))
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0)

  return {
    id: `challenge-${Date.now()}`,
    title: `${difficulty} Azure Networking Challenge`,
    description: `Design an Azure network architecture with ${difficulty.toLowerCase()} complexity requirements.`,
    difficulty,
    conditions: {
      requiredComponents: tasks.map(t => t.componentType as string),
      requiredConnections: [],
      securityRequirements: [],
      networkRequirements: [],
    },
    tasks,
    totalPoints,
    timeLimit: options.timeLimitSeconds,
  }
}
