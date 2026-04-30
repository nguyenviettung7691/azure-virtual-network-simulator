<template>
  <Dialog
    v-model:visible="challengesStore.showSetupModal"
    modal
    header="Generate AI Challenge"
    :style="{ width: '480px' }"
    @hide="challengesStore.closeSetupModal()"
  >
    <div class="setup-form">
      <div class="field">
        <label>Difficulty</label>
        <SelectButton v-model="difficulty" :options="difficultyOptions" option-label="label" option-value="value" />
      </div>

      <Divider />

      <div class="field">
        <label>Custom Parameters (optional)</label>
        <div class="custom-params">
          <div class="param-row">
            <label>Number of Components</label>
            <InputNumber v-model="componentCount" :min="2" :max="15" showButtons :disabled="!useCustom" />
          </div>
          <div class="param-row">
            <label>Number of Tasks</label>
            <InputNumber v-model="taskCount" :min="1" :max="10" showButtons :disabled="!useCustom" />
          </div>
          <div class="param-row">
            <label>Use Custom Parameters</label>
            <ToggleSwitch v-model="useCustom" />
          </div>
        </div>
      </div>

      <Message severity="info" :closable="false" icon="pi pi-info-circle">
        Your current diagram will be removed when the challenge starts.
      </Message>

      <Message v-if="challengesStore.error" severity="warn" :closable="false">
        {{ challengesStore.error }} — using local challenge instead.
      </Message>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="challengesStore.closeSetupModal()" />
      <Button
        label="Generate Challenge"
        icon="pi pi-bolt"
        severity="help"
        :loading="challengesStore.isGenerating"
        @click="generate"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ChallengeDifficulty } from '~/types/challenge'

const challengesStore = useChallengesStore()
const diagramStore = useDiagramStore()

const difficulty = ref(ChallengeDifficulty.BEGINNER)
const componentCount = ref(5)
const taskCount = ref(3)
const useCustom = ref(false)

const difficultyOptions = [
  { label: 'Beginner', value: ChallengeDifficulty.BEGINNER },
  { label: 'Intermediate', value: ChallengeDifficulty.INTERMEDIATE },
  { label: 'Advanced', value: ChallengeDifficulty.ADVANCED },
  { label: 'Expert', value: ChallengeDifficulty.EXPERT },
]

async function generate() {
  diagramStore.resetDiagram()
  await challengesStore.generateChallenge(difficulty.value, [])
}
</script>

<style scoped>
.setup-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field > label { font-size: 0.85rem; font-weight: 600; color: var(--text-color-secondary); }
.custom-params { display: flex; flex-direction: column; gap: 0.6rem; }
.param-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
</style>
