import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { Challenge } from '~/types/challenge'
import { ChallengeDifficulty } from '~/types/challenge'
import { NetworkComponentType } from '~/types/network'

let bedrockClient: BedrockRuntimeClient | null = null

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    const config = useRuntimeConfig()
    bedrockClient = new BedrockRuntimeClient({
      region: config.public.bedrockRegion || 'us-east-1',
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

  const existingList = params.existingComponents.map(c => c.toString()).join(', ')

  const prompt = `You are an Azure networking expert. Create a ${difficultyDescriptions[params.difficulty]} Azure Virtual Network challenge.

The user currently has these components in their diagram: ${existingList || 'none'}

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

Return ONLY valid JSON, no other text.`

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  })

  const response = await client.send(command)
  const responseText = new TextDecoder().decode(response.body)
  const responseData = JSON.parse(responseText)
  const content = responseData.content[0].text

  const challenge = JSON.parse(content) as Challenge
  challenge.id = `challenge-${Date.now()}`
  return challenge
}
