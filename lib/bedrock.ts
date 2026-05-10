import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { Challenge } from '~/types/challenge'
import { getBrowserAwsCredentials } from '~/lib/aws'
import { ChallengeDifficulty } from '~/types/challenge'
import { NetworkComponentType } from '~/types/network'

const CHALLENGE_CREATABLE_COMPONENTS = Object.values(NetworkComponentType)
  .filter(type => type !== NetworkComponentType.INTERNET)

const COMPONENT_GROUPS: Array<{ category: string; types: NetworkComponentType[] }> = [
  {
    category: 'Networking foundation',
    types: [NetworkComponentType.VNET, NetworkComponentType.SUBNET, NetworkComponentType.VNET_PEERING],
  },
  {
    category: 'Connectivity',
    types: [NetworkComponentType.VPN_GATEWAY, NetworkComponentType.NETWORK_IC],
  },
  {
    category: 'Security',
    types: [NetworkComponentType.NSG, NetworkComponentType.ASG, NetworkComponentType.FIREWALL, NetworkComponentType.BASTION],
  },
  {
    category: 'Routing',
    types: [NetworkComponentType.UDR, NetworkComponentType.NVA],
  },
  {
    category: 'Load balancing',
    types: [NetworkComponentType.APP_GATEWAY, NetworkComponentType.LOAD_BALANCER],
  },
  {
    category: 'IP and DNS',
    types: [NetworkComponentType.IP_ADDRESS, NetworkComponentType.DNS_ZONE],
  },
  {
    category: 'Compute',
    types: [
      NetworkComponentType.VM,
      NetworkComponentType.VMSS,
      NetworkComponentType.AKS,
      NetworkComponentType.APP_SERVICE,
      NetworkComponentType.FUNCTIONS,
    ],
  },
  {
    category: 'Storage',
    types: [NetworkComponentType.STORAGE_ACCOUNT, NetworkComponentType.BLOB_STORAGE, NetworkComponentType.MANAGED_DISK],
  },
  {
    category: 'Identity and secrets',
    types: [NetworkComponentType.MANAGED_IDENTITY, NetworkComponentType.KEY_VAULT],
  },
  {
    category: 'Endpoints',
    types: [NetworkComponentType.SERVICE_ENDPOINT, NetworkComponentType.PRIVATE_ENDPOINT],
  },
]

function buildCurrentDiagramSummary(existingComponents: NetworkComponentType[]): string {
  if (!existingComponents.length) return 'none'

  const counts = new Map<NetworkComponentType, number>()
  for (const componentType of existingComponents) {
    counts.set(componentType, (counts.get(componentType) || 0) + 1)
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([componentType, count]) => `${componentType} x${count}`)
    .join(', ')
}

function buildComponentCatalog(): string {
  return COMPONENT_GROUPS
    .map(group => `${group.category}: ${group.types.join(', ')}`)
    .join('\n')
}

function stripMarkdownCodeFence(text: string): string {
  const fenceMatch = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (!fenceMatch) return text
  return fenceMatch[1].trim()
}

function extractFirstJsonObject(text: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let isEscaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (isEscaped) {
      isEscaped = false
      continue
    }

    if (inString) {
      if (ch === '\\') {
        isEscaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      if (depth === 0) start = i
      depth++
      continue
    }

    if (ch === '}') {
      if (depth === 0) continue
      depth--
      if (depth === 0 && start >= 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

function parseChallengeContent(rawContent: string): Challenge {
  const trimmed = rawContent.trim()
  const withoutFence = stripMarkdownCodeFence(trimmed)
  const extracted = extractFirstJsonObject(withoutFence)
    || extractFirstJsonObject(trimmed)
    || withoutFence

  try {
    return JSON.parse(extracted) as Challenge
  } catch (error: any) {
    const message = error?.message || 'Unknown parse error'
    throw new Error(`Invalid challenge JSON from model: ${message}`)
  }
}

let bedrockClient: BedrockRuntimeClient | null = null

// Release the AWS SDK client on HMR to avoid leaked HTTP connection pools
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    bedrockClient = null
  })
}

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    const config = useRuntimeConfig()
    bedrockClient = new BedrockRuntimeClient({
      region: config.public.bedrockRegion || 'ap-southeast-1',
      credentials: async () => {
        const credentials = await getBrowserAwsCredentials()

        return {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
          expiration: credentials.expiration,
        }
      },
    })
  }
  return bedrockClient
}

export async function generateChallenge(params: {
  difficulty: ChallengeDifficulty
  existingComponents: NetworkComponentType[]
}): Promise<Challenge> {
  const client = getBedrockClient()

  const difficultyDescriptions: Record<ChallengeDifficulty, string> = {
    [ChallengeDifficulty.BEGINNER]: 'beginner (simple tasks involving 2-3 components)',
    [ChallengeDifficulty.INTERMEDIATE]: 'intermediate (tasks involving 4-6 components with security considerations)',
    [ChallengeDifficulty.ADVANCED]: 'advanced (complex tasks involving 6+ components with routing, security, and HA)',
    [ChallengeDifficulty.EXPERT]: 'expert (enterprise-grade architecture with all security and compliance requirements)',
  }

  const existingList = buildCurrentDiagramSummary(params.existingComponents)
  const availableComponentList = CHALLENGE_CREATABLE_COMPONENTS.join(', ')
  const componentCatalog = buildComponentCatalog()

  const prompt = `You are an Azure networking expert. Create a ${difficultyDescriptions[params.difficulty]} Azure Virtual Network challenge.

The user currently has these components in their diagram: ${existingList || 'none'}

These are all Azure component types supported by the simulator and available for challenge tasks:
${availableComponentList}

Supported components by category:
${componentCatalog}

Important constraints:
- Only use component types from the supported list above.
- Do not include INTERNET in required components or tasks. Public Internet is system-managed.
- Use realistic Azure networking relationships in requiredConnections.
- The difficulty field must be exactly "${params.difficulty}".

Generate a challenge as a JSON object with this exact structure:
{
  "id": "challenge-<timestamp>",
  "title": "Challenge title",
  "description": "Brief description of the scenario",
  "difficulty": "${params.difficulty}",
  "conditions": {
    "requiredComponents": ["VNET", "SUBNET", "NSG"],
    "requiredConnections": [{"from": "componentType1", "to": "componentType2"}],
    "securityRequirements": ["NSG must be attached to all subnets"],
    "networkRequirements": ["All VMs must be in subnets"]
  },
  "tasks": [
    {
      "id": "task-1",
      "description": "Create a Virtual Network with address space 10.0.0.0/16",
      "type": "add_component",
      "componentType": "VNET",
      "completed": false,
      "points": 10
    }
  ],
  "totalPoints": 50,
  "timeLimit": 300
}

Return ONLY a valid JSON object.
Do not include markdown code fences, comments, or extra prose.`

  const body = JSON.stringify({
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 2000,
    },
  })

  const command = new InvokeModelCommand({
    modelId: 'global.amazon.nova-2-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  })

  const response = await client.send(command)
  const responseText = new TextDecoder().decode(response.body)
  const responseData = JSON.parse(responseText)
  const content = responseData?.output?.message?.content?.[0]?.text

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Bedrock response did not include challenge content')
  }

  const challenge = parseChallengeContent(content)
  challenge.id = `challenge-${Date.now()}`
  return challenge
}
