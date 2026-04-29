import { defineStore } from 'pinia'
import type { Challenge, ChallengeTask } from '~/types/challenge'
import { ChallengeDifficulty } from '~/types/challenge'
import { NetworkComponentType } from '~/types/network'

interface ChallengesState {
  currentChallenge: Challenge | null
  isGenerating: boolean
  showChallengePanel: boolean
  showSetupModal: boolean
  showCongratulations: boolean
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
  },

  actions: {
    async generateChallenge(difficulty: ChallengeDifficulty, existingComponents: NetworkComponentType[]) {
      this.isGenerating = true
      this.error = null
      try {
        const { generateChallenge } = await import('~/lib/bedrock')
        const challenge = await generateChallenge({ difficulty, existingComponents })
        this.currentChallenge = challenge
        this.showChallengePanel = true
        this.showSetupModal = false
        this.startTimer()
      } catch (err: any) {
        this.error = err.message || 'Failed to generate challenge'
        this.currentChallenge = generateLocalChallenge(difficulty)
        this.showChallengePanel = true
        this.showSetupModal = false
        this.startTimer()
      } finally {
        this.isGenerating = false
      }
    },

    evaluateCompletion(nodes: any[], edges: any[]) {
      if (!this.currentChallenge) return

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
        this.showCongratulations = true
        this.stopTimer()
      }
    },

    quitChallenge() {
      this.stopTimer()
      this.currentChallenge = null
      this.showChallengePanel = false
      this.showCongratulations = false
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
          this.stopTimer()
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

function generateLocalChallenge(difficulty: ChallengeDifficulty): Challenge {
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

  const tasks = taskSets[difficulty]
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0)
  const timeLimitMap: Record<ChallengeDifficulty, number> = {
    [ChallengeDifficulty.BEGINNER]: 300,
    [ChallengeDifficulty.INTERMEDIATE]: 600,
    [ChallengeDifficulty.ADVANCED]: 900,
    [ChallengeDifficulty.EXPERT]: 1800,
  }

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
    timeLimit: timeLimitMap[difficulty],
  }
}
