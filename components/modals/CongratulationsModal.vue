<template>
  <Dialog
    v-model:visible="challengesStore.showCongratulations"
    modal
    :closable="false"
    :style="{ width: '420px' }"
    @hide="handleClose()"
  >
    <template #header>
      <div class="congrats-header">
        <IconifyIcon :icon="headerIcon" class="party-icon" :class="{ danger: !isSuccess }" />
        <span>{{ headerTitle }}</span>
      </div>
    </template>

    <div class="congrats-body">
      <p class="congrats-msg">
        <template v-if="isSuccess">
          Congratulations! You completed <strong>{{ challengesStore.currentChallenge?.title }}</strong>.
        </template>
        <template v-else>
          Time is up for <strong>{{ challengesStore.currentChallenge?.title }}</strong>. The challenge has ended.
        </template>
      </p>
      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{{ points }}</span>
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
      <Button :label="isSuccess ? 'Start New Challenge' : 'Try Another Challenge'" icon="pi pi-bolt" severity="help" @click="newChallenge" />
      <Button label="Close" text @click="handleClose" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon as IconifyIcon } from '@iconify/vue'

const challengesStore = useChallengesStore()

const isSuccess = computed(() => challengesStore.challengeOutcome === 'won')

const headerTitle = computed(() => isSuccess.value ? 'Challenge Complete!' : 'Challenge Failed')
const headerIcon = computed(() => isSuccess.value ? 'mdi:party-popper' : 'mdi:timer-alert-outline')
const points = computed(() => challengesStore.finalPoints || challengesStore.earnedPoints)

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function newChallenge() {
  handleClose()
  challengesStore.openSetupModal()
}

function handleClose() {
  challengesStore.closeCongratulations()
  challengesStore.quitChallenge()
}
</script>

<style scoped>
.congrats-header { display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem; font-weight: 700; }
.party-icon { font-size: 1.5rem; color: var(--yellow-500); }
.party-icon.danger { color: var(--orange-500); }
.congrats-body { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem 0; text-align: center; }
.congrats-msg { font-size: 0.95rem; line-height: 1.5; margin: 0; }
.stats-row { display: flex; gap: 2rem; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
.stat-value { font-size: 1.8rem; font-weight: 800; color: var(--primary-color); }
.stat-label { font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
