import type { ChallengeDifficulty } from '~/types/challenge'
import { NetworkComponentType } from '~/types/network'

export const useAI = () => {
  const challengesStore = useChallengesStore()
  const diagramStore = useDiagramStore()

  async function generateChallenge(difficulty: ChallengeDifficulty) {
    const existingComponents = (diagramStore.nodes as any[]).map(n => n.data?.type) as NetworkComponentType[]
    await challengesStore.generateChallenge(difficulty, existingComponents)
  }

  return {
    isGenerating: computed(() => challengesStore.isGenerating),
    error: computed(() => challengesStore.error),
    currentChallenge: computed(() => challengesStore.currentChallenge),
    generateChallenge,
  }
}
