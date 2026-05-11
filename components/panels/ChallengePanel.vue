<template>
  <div class="challenge-panel" v-if="challengesStore.showChallengePanel && challengesStore.currentChallenge">
    <div class="challenge-header" @click="toggleExpand">
      <div class="challenge-title-row">
        <Icon icon="mdi:bolt" class="challenge-icon" />
        <span class="challenge-title">{{ challengesStore.currentChallenge.title }}</span>
        <Tag :value="challengesStore.currentChallenge.difficulty" severity="help" class="difficulty-tag" />
        <Tag :value="`${challengesStore.progressPercent}%`" :severity="progressSeverity" />
      </div>
      <div class="challenge-controls">
        <div class="timer-group">
          <span class="timer">{{ formatTime(challengesStore.remainingTime) }}</span>
          <span class="timer-hint">left / {{ formatTime(challengesStore.currentChallenge.timeLimit) }}</span>
        </div>
        <Button icon="pi pi-times" text size="small" v-tooltip.left="'Quit challenge'" @click.stop="quitChallenge" />
        <Button :icon="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-up'" text size="small" />
      </div>
    </div>

    <div v-if="expanded" class="challenge-body">
      <ProgressBar :value="challengesStore.progressPercent" class="challenge-progress" />
      <p class="challenge-desc">{{ challengesStore.currentChallenge.description }}</p>
      <div class="task-list">
        <div v-for="task in challengesStore.currentChallenge.tasks" :key="task.id" class="task-row" :class="{ completed: task.completed }">
          <Icon :icon="task.completed ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'" class="task-check" />
          <span class="task-desc">{{ task.description }}</span>
          <Tag v-if="task.points" :value="`+${task.points}pts`" severity="info" class="task-pts" />
        </div>
      </div>
      <div class="challenge-footer">
        <Button label="New Challenge" icon="pi pi-bolt" size="small" severity="help" text @click="challengesStore.openSetupModal()" />
        <div class="summary-strip">
          <span class="summary-item">{{ completedTaskCount }} / {{ challengesStore.totalTasks }} tasks</span>
          <span class="summary-item points-label">{{ challengesStore.earnedPoints }} / {{ challengesStore.currentChallenge.totalPoints }} pts</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const challengesStore = useChallengesStore()
const diagramStore = useDiagramStore()

const expanded = ref(true)

function toggleExpand() { expanded.value = !expanded.value }

const progressSeverity = computed(() => {
  const p = challengesStore.progressPercent
  if (p >= 100) return 'success'
  if (p >= 50) return 'warn'
  return 'secondary'
})

const completedTaskCount = computed(() => challengesStore.completedTasks.length)

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function quitChallenge() {
  diagramStore.confirmAction('Quit the current challenge?', () => challengesStore.quitChallenge())
}

watch(
  () => [diagramStore.nodes.length, diagramStore.edges.length],
  () => {
    if (challengesStore.isActive && challengesStore.currentChallenge) {
      challengesStore.evaluateCompletion(diagramStore.nodes, diagramStore.edges)
    }
  }
)
</script>

<style scoped>
.challenge-panel {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-card) 90%, var(--primary) 10%) 0%, var(--surface-card) 100%);
  border-top: 1px solid color-mix(in srgb, var(--primary) 38%, var(--surface-border) 62%);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
  z-index: 50;
}
.challenge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.85rem;
  cursor: pointer;
}
.challenge-title-row { display: flex; align-items: center; gap: 0.52rem; min-width: 0; }
.challenge-icon { font-size: 1.1rem; color: var(--yellow-500); }
.challenge-title {
  font-weight: 700;
  font-size: 0.9rem;
  max-width: min(64vw, 540px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.difficulty-tag { font-size: 0.65rem; }
.challenge-controls { display: flex; align-items: center; gap: 0.22rem; }
.timer-group { display: flex; align-items: center; gap: 0.35rem; }
.timer {
  font-size: 0.9rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--primary) 80%, var(--text-color) 20%);
  font-variant-numeric: tabular-nums;
}
.timer-hint {
  font-size: 0.72rem;
  color: var(--text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.challenge-body { padding: 0.45rem 0.85rem 0.85rem; display: flex; flex-direction: column; gap: 0.56rem; }
.challenge-progress { height: 6px; }
.challenge-desc { font-size: 0.8rem; color: var(--text-color-secondary); margin: 0; line-height: 1.42; }
.task-list { display: flex; flex-direction: column; gap: 0.3rem; }
.task-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.task-row.completed .task-desc { text-decoration: line-through; color: var(--text-color-secondary); }
.task-check { font-size: 1rem; }
.task-row.completed .task-check { color: var(--green-500); }
.task-pts { font-size: 0.65rem; }
.challenge-footer { display: flex; align-items: center; justify-content: space-between; }
.summary-strip { display: flex; align-items: center; gap: 0.6rem; }
.summary-item {
  font-size: 0.76rem;
  color: var(--text-color-secondary);
  font-weight: 600;
}
.points-label { color: var(--primary-color); }

@media (max-width: 768px) {
  .challenge-title {
    max-width: min(40vw, 230px);
  }

  .timer-hint {
    display: none;
  }

  .summary-strip {
    gap: 0.4rem;
  }

  .summary-item {
    font-size: 0.72rem;
  }
}
</style>
