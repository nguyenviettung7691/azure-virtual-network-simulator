import { defineStore } from 'pinia'
import type {
  Challenge,
  ChallengeGenerationDefaults,
  ChallengeGenerationOptions,
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

function normalizeChallenge(
  challenge: Challenge,
  difficulty: ChallengeDifficulty,
  options: ChallengeGenerationDefaults,
): Challenge {
  const tasks = Array.isArray(challenge.tasks)
    ? challenge.tasks.slice(0, Math.max(MIN_TASK_COUNT, options.taskCount)).map(task => ({ ...task, completed: false }))
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

      const nodeTypes = nodes.map(n => n.data?.type as NetworkComponentType)
      const updatedTasks = this.currentChallenge.tasks.map(task => {
        let completed = task.completed

        if (task.type === 'add_component' && task.componentType) {
          completed = nodeTypes.includes(task.componentType as NetworkComponentType)
        } else if (task.type === 'connect_components') {
          completed = edges.length > 0
        } else if (task.type === 'configure_component' && task.targetComponentId) {
          const target = nodes.find(n => n.id === task.targetComponentId)
          completed = target != null
        } else if (task.type === 'remove_component' && task.componentType) {
          completed = !nodeTypes.includes(task.componentType as NetworkComponentType)
        }

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
      { id: 'task-1', description: 'Create a Virtual Network', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 10 },
      { id: 'task-2', description: 'Add a Subnet to your VNet', type: 'add_component', componentType: NetworkComponentType.SUBNET, completed: false, points: 10 },
      { id: 'task-3', description: 'Add a Virtual Machine', type: 'add_component', componentType: NetworkComponentType.VM, completed: false, points: 10 },
    ],
    [ChallengeDifficulty.INTERMEDIATE]: [
      { id: 'task-1', description: 'Create a Virtual Network', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 10 },
      { id: 'task-2', description: 'Add two Subnets', type: 'add_component', componentType: NetworkComponentType.SUBNET, completed: false, points: 10 },
      { id: 'task-3', description: 'Add a Network Security Group', type: 'add_component', componentType: NetworkComponentType.NSG, completed: false, points: 15 },
      { id: 'task-4', description: 'Add a Load Balancer', type: 'add_component', componentType: NetworkComponentType.LOAD_BALANCER, completed: false, points: 15 },
      { id: 'task-5', description: 'Add Virtual Machines', type: 'add_component', componentType: NetworkComponentType.VM, completed: false, points: 10 },
    ],
    [ChallengeDifficulty.ADVANCED]: [
      { id: 'task-1', description: 'Create a Hub VNet', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 10 },
      { id: 'task-2', description: 'Add NSGs with security rules', type: 'add_component', componentType: NetworkComponentType.NSG, completed: false, points: 20 },
      { id: 'task-3', description: 'Add an Azure Firewall', type: 'add_component', componentType: NetworkComponentType.FIREWALL, completed: false, points: 20 },
      { id: 'task-4', description: 'Configure UDR routing', type: 'add_component', componentType: NetworkComponentType.UDR, completed: false, points: 20 },
      { id: 'task-5', description: 'Add VPN Gateway', type: 'add_component', componentType: NetworkComponentType.VPN_GATEWAY, completed: false, points: 20 },
      { id: 'task-6', description: 'Set up VNet Peering', type: 'add_component', componentType: NetworkComponentType.VNET_PEERING, completed: false, points: 10 },
    ],
    [ChallengeDifficulty.EXPERT]: [
      { id: 'task-1', description: 'Design a Hub-Spoke architecture with 3 VNets', type: 'add_component', componentType: NetworkComponentType.VNET, completed: false, points: 20 },
      { id: 'task-2', description: 'Add Azure Firewall in hub', type: 'add_component', componentType: NetworkComponentType.FIREWALL, completed: false, points: 20 },
      { id: 'task-3', description: 'Configure AKS cluster', type: 'add_component', componentType: NetworkComponentType.AKS, completed: false, points: 20 },
      { id: 'task-4', description: 'Add Application Gateway with WAF', type: 'add_component', componentType: NetworkComponentType.APP_GATEWAY, completed: false, points: 20 },
      { id: 'task-5', description: 'Configure Private Endpoints', type: 'add_component', componentType: NetworkComponentType.PRIVATE_ENDPOINT, completed: false, points: 20 },
      { id: 'task-6', description: 'Add Azure Bastion', type: 'add_component', componentType: NetworkComponentType.BASTION, completed: false, points: 20 },
      { id: 'task-7', description: 'Set up VNet Peering for all VNets', type: 'add_component', componentType: NetworkComponentType.VNET_PEERING, completed: false, points: 20 },
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
