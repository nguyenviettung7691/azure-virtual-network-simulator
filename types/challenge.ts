import type { NetworkComponentType } from './network'

export enum ChallengeDifficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export interface ChallengeTask {
  id: string
  description: string
  type: 'add_component' | 'connect_components' | 'configure_component' | 'remove_component'
  componentType?: NetworkComponentType
  targetComponentId?: string
  completed: boolean
  points: number
}

export interface ChallengeCondition {
  requiredComponents: string[]
  requiredConnections: Array<{ from: string; to: string }>
  securityRequirements: string[]
  networkRequirements: string[]
}

export interface Challenge {
  id: string
  title: string
  description: string
  difficulty: ChallengeDifficulty
  conditions: ChallengeCondition
  tasks: ChallengeTask[]
  totalPoints: number
  timeLimit: number
  completedAt?: string
  score?: number
}
