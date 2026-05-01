<template>
  <g>
    <BaseEdge
      :id="id"
      ref="edgeRef"
      :path="path"
      :style="edgeStyle"
      class="animation-edge-path"
      :marker-end="`url(#${markerId})`"
    />

    <defs>
      <marker
        :id="markerId"
        markerWidth="12"
        markerHeight="8"
        refX="10"
        refY="4"
        orient="auto"
      >
        <polygon points="0 0, 12 4, 0 8" :fill="edgeColor" />
      </marker>
    </defs>

    <EdgeLabelRenderer>
      <div
        v-if="isAnimating"
        ref="travelerRef"
        class="animation-traveler"
        :class="`animation-traveler--${edgeState}`"
        :style="travelerStyle"
      >
        <span class="animation-traveler-shell">
          <Icon icon="mdi:paper-plane-outline" class="animation-traveler-icon" />
        </span>
      </div>
    </EdgeLabelRenderer>
  </g>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core'
import type { EdgeProps } from '@vue-flow/core'

interface AnimationEdgeData {
  state?: 'pending' | 'active' | 'pass' | 'fail' | 'warning'
  durationMs?: number
  travelerVisible?: boolean
}

interface AnimationEdgeProps extends EdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: any
  targetPosition: any
  data?: AnimationEdgeData
}

const props = defineProps<AnimationEdgeProps>()

type BaseEdgeRef = {
  pathEl?: SVGPathElement | null
}

const edgeRef = ref<BaseEdgeRef | null>(null)
const travelerRef = ref<HTMLElement | null>(null)
const isAnimating = ref(false)

let travelerAnimation: Animation | null = null

const edgeState = computed(() => props.data?.state || 'pending')
const showTraveler = computed(() => Boolean(props.data?.travelerVisible && edgeState.value === 'active'))
const durationMs = computed(() => props.data?.durationMs ?? 1600)
const markerId = computed(() => `${props.id}-arrow`)

const edgeColor = computed(() => {
  if (edgeState.value === 'pass') return '#107c10'
  if (edgeState.value === 'fail') return '#d13438'
  if (edgeState.value === 'warning') return '#c19c00'
  if (edgeState.value === 'active') return '#0f6cbd'
  return '#8a8886'
})

const travelerIconColor = computed(() => {
  if (edgeState.value === 'pass') return '#0b5f0b'
  if (edgeState.value === 'fail') return '#a4262c'
  if (edgeState.value === 'warning') return '#6b4f00'
  if (edgeState.value === 'active') return '#0b4f8a'
  return '#4f4d4b'
})

const path = computed(() => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })

  return edgePath
})

const edgeStyle = computed(() => ({
  stroke: edgeColor.value,
  strokeWidth: edgeState.value === 'active' ? 3 : 2.5,
  strokeDasharray: edgeState.value === 'pending' ? '8 7' : edgeState.value === 'active' ? '10 5' : undefined,
  animation: edgeState.value === 'active' ? 'animationEdgePulse 0.75s linear infinite' : undefined,
  filter: edgeState.value === 'active' ? `drop-shadow(0 0 8px ${edgeColor.value}66)` : undefined,
}))

const travelerStyle = computed(() => ({
  position: 'absolute',
  left: '0px',
  top: '0px',
  zIndex: 6,
  pointerEvents: 'none',
  offsetPath: `path('${path.value}')`,
  offsetDistance: '0%',
  offsetRotate: 'auto',
  offsetAnchor: 'center',
}))

watch([showTraveler, path, durationMs], ([visible]) => {
  if (visible) {
    void runTravelerAnimation()
    return
  }

  stopTravelerAnimation()
}, { immediate: true })

onBeforeUnmount(() => {
  stopTravelerAnimation()
})

async function runTravelerAnimation() {
  stopTravelerAnimation()
  isAnimating.value = true

  await nextTick()

  const pathEl = edgeRef.value?.pathEl
  const travelerEl = travelerRef.value

  if (!pathEl || !travelerEl) {
    isAnimating.value = false
    return
  }

  travelerAnimation = travelerEl.animate(
    [
      { offsetDistance: '0%' },
      { offsetDistance: '100%' },
    ],
    {
      duration: durationMs.value,
      direction: 'normal',
      easing: 'linear',
      fill: 'forwards',
      iterations: 1,
    },
  )

  const handleAnimationEnd = () => {
    travelerAnimation = null
    isAnimating.value = false
  }

  travelerAnimation.onfinish = handleAnimationEnd
  travelerAnimation.oncancel = handleAnimationEnd
}

function stopTravelerAnimation() {
  if (travelerAnimation) {
    travelerAnimation.onfinish = null
    travelerAnimation.oncancel = null
    travelerAnimation.cancel()
    travelerAnimation = null
  }

  isAnimating.value = false
}
</script>

<style scoped>
.animation-edge-path {
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke 180ms ease, stroke-width 180ms ease, filter 180ms ease;
}

.animation-traveler {
  will-change: offset-distance, transform;
}

.animation-traveler-shell {
  align-items: center;
  backdrop-filter: blur(6px);
  background: color-mix(in srgb, var(--surface, #ffffff) 92%, var(--text, #323130) 8%);
  border: 2px solid v-bind(edgeColor);
  border-radius: 999px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.22);
  color: v-bind(travelerIconColor);
  display: inline-flex;
  justify-content: center;
  padding: 6px;
  transform: translate(-50%, -50%);
}

.animation-traveler-icon {
  display: block;
  height: 20px;
  width: 20px;
}

:global(.dark-mode) .animation-traveler-shell {
  background: color-mix(in srgb, var(--surface, #1b1a19) 82%, white 18%);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.42);
}

.animation-traveler--pass {
  filter: drop-shadow(0 2px 10px rgba(16, 124, 16, 0.28));
}

.animation-traveler--fail {
  filter: drop-shadow(0 2px 10px rgba(209, 52, 56, 0.3));
}

.animation-traveler--warning {
  filter: drop-shadow(0 2px 10px rgba(193, 156, 0, 0.3));
}

@keyframes animationEdgePulse {
  to {
    stroke-dashoffset: -30;
  }
}
</style>