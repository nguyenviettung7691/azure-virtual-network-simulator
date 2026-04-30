<template>
  <Dialog
    v-model:visible="challengesStore.showCongratulations"
    modal
    :closable="false"
    :style="{ width: '420px' }"
    @hide="challengesStore.closeCongratulations()"
  >
    <template #header>
      <div class="congrats-header">
        <Icon icon="mdi:party-popper" class="party-icon" />
        <span>Challenge Complete!</span>
      </div>
    </template>

    <div class="congrats-body">
      <p class="congrats-msg">Congratulations! You've completed the <strong>{{ challengesStore.currentChallenge?.title }}</strong>!</p>
      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{{ challengesStore.earnedPoints }}</span>
          <span class="stat-label">Points</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ formatTime(challengesStore.elapsedSeconds) }}</span>
          <span class="stat-label">Time</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ challengesStore.totalTasks }}</span>
          <span class="stat-label">Tasks</span>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Start New Challenge" icon="pi pi-bolt" severity="help" @click="newChallenge" />
      <Button label="Close" text @click="challengesStore.closeCongratulations()" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const challengesStore = useChallengesStore()

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function newChallenge() {
  challengesStore.closeCongratulations()
  challengesStore.quitChallenge()
  challengesStore.openSetupModal()
}
</script>

<style scoped>
.congrats-header { display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem; font-weight: 700; }
.party-icon { font-size: 1.5rem; color: var(--yellow-500); }
.congrats-body { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem 0; text-align: center; }
.congrats-msg { font-size: 0.95rem; line-height: 1.5; margin: 0; }
.stats-row { display: flex; gap: 2rem; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
.stat-value { font-size: 1.8rem; font-weight: 800; color: var(--primary-color); }
.stat-label { font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
