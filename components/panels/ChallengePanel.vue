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
        <span class="timer">{{ formatTime(challengesStore.elapsedSeconds) }}</span>
        <Button icon="pi pi-times" text size="small" v-tooltip="'Quit challenge'" @click.stop="quitChallenge" />
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
        <span class="points-label">{{ challengesStore.earnedPoints }} / {{ challengesStore.currentChallenge.totalPoints }} pts</span>
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
    if (challengesStore.currentChallenge) {
      challengesStore.evaluateCompletion(diagramStore.nodes, diagramStore.edges)
    }
  }
)
</script>

<style scoped>
.challenge-panel {
  background: var(--surface-card);
  border-top: 2px solid var(--primary-color);
  flex-shrink: 0;
  z-index: 50;
}
.challenge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}
.challenge-title-row { display: flex; align-items: center; gap: 0.5rem; }
.challenge-icon { font-size: 1.1rem; color: var(--yellow-500); }
.challenge-title { font-weight: 700; font-size: 0.88rem; }
.difficulty-tag { font-size: 0.65rem; }
.challenge-controls { display: flex; align-items: center; gap: 0.25rem; }
.timer { font-size: 0.78rem; font-weight: 600; color: var(--text-color-secondary); font-variant-numeric: tabular-nums; }
.challenge-body { padding: 0.5rem 0.75rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.challenge-progress { height: 6px; }
.challenge-desc { font-size: 0.8rem; color: var(--text-color-secondary); margin: 0; }
.task-list { display: flex; flex-direction: column; gap: 0.3rem; }
.task-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.task-row.completed .task-desc { text-decoration: line-through; color: var(--text-color-secondary); }
.task-check { font-size: 1rem; }
.task-row.completed .task-check { color: var(--green-500); }
.task-pts { font-size: 0.65rem; }
.challenge-footer { display: flex; align-items: center; justify-content: space-between; }
.points-label { font-size: 0.78rem; font-weight: 700; color: var(--primary-color); }
</style>
