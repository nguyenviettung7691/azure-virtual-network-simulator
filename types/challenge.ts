import type { NetworkComponentType } from './network'

export enum ChallengeDifficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export interface ChallengeGenerationDefaults {
  timeLimitSeconds: number
  taskCount: number
  componentCount: number
}

export interface ChallengeGenerationOptions {
  useCustom?: boolean
  timeLimitSeconds?: number
  taskCount?: number
  componentCount?: number
}

export interface ChallengeTask {
  id: string
  description: string
  type: 'add_component' | 'connect_components' | 'configure_component' | 'remove_component'
  componentType?: NetworkComponentType
  targetComponentId?: string
  conditions?: ChallengeTaskConditions
  completed: boolean
  points: number
}

export interface ChallengeComponentSelector {
  id?: string
  name?: string
  type?: NetworkComponentType
}

export interface ChallengePropertyExpectation {
  field: string
  equals?: string | number | boolean
  includes?: string
  min?: number
  max?: number
  exists?: boolean
}

export interface ChallengeComponentRequirement {
  selector?: ChallengeComponentSelector
  type?: NetworkComponentType
  count?: number
  names?: string[]
  properties?: ChallengePropertyExpectation[]
  parentSelector?: ChallengeComponentSelector
}

export interface ChallengeConnectionRequirement {
  from: ChallengeComponentSelector
  to: ChallengeComponentSelector
  bidirectional?: boolean
}

export type ChallengeSecurityRequirement =
  | {
    kind: 'nsg_attached_to_subnet'
    subnetSelector?: ChallengeComponentSelector
    nsgSelector?: ChallengeComponentSelector
  }
  | {
    kind: 'nsg_has_inbound_rule'
    nsgSelector?: ChallengeComponentSelector
    access?: 'Allow' | 'Deny'
    port?: number | string
    sourceAddressPrefix?: string
  }

export type ChallengeNetworkRequirement =
  | {
    kind: 'component_in_subnet'
    componentSelector?: ChallengeComponentSelector
    subnetSelector?: ChallengeComponentSelector
  }
  | {
    kind: 'subnet_in_vnet'
    subnetSelector?: ChallengeComponentSelector
    vnetSelector?: ChallengeComponentSelector
    addressPrefix?: string
  }
  | {
    kind: 'vnet_subnet_count'
    vnetSelector?: ChallengeComponentSelector
    minCount: number
  }

export interface ChallengeTaskConditions {
  mode?: 'all' | 'any'
  requiredComponents?: ChallengeComponentRequirement[]
  requiredConnections?: ChallengeConnectionRequirement[]
  securityRequirements?: ChallengeSecurityRequirement[]
  networkRequirements?: ChallengeNetworkRequirement[]
  componentRequirements?: ChallengeComponentRequirement[]
}

export interface ChallengeCondition {
  requiredComponents: Array<string | ChallengeComponentRequirement>
  requiredConnections: Array<{ from: string; to: string } | ChallengeConnectionRequirement>
  securityRequirements: Array<string | ChallengeSecurityRequirement>
  networkRequirements: Array<string | ChallengeNetworkRequirement>
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
