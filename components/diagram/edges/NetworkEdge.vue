<template>
  <g>
    <path
      :id="id"
      :style="edgeStyle"
      class="vue-flow__edge-path network-edge-path"
      :d="path"
      :marker-end="`url(#${id}-arrow)`"
    />
    <defs>
      <marker
        :id="`${id}-arrow`"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon
          points="0 0, 10 3.5, 0 7"
          :fill="edgeColor"
        />
      </marker>
    </defs>
    <text v-if="label" class="network-edge-label">
      <textPath :href="`#${id}`" startOffset="50%" text-anchor="middle">
        {{ label }}
      </textPath>
    </text>
    <!-- Wider invisible hit area for easier clicking -->
    <path
      :d="path"
      fill="none"
      stroke="transparent"
      stroke-width="20"
      style="cursor: pointer"
      @click="emit('click', { edge: props })"
    />
  </g>
</template>

<script setup lang="ts">
import { getBezierPath } from '@vue-flow/core'
import type { EdgeProps } from '@vue-flow/core'

interface NetworkEdgeProps extends EdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: any
  targetPosition: any
  data: { animated?: boolean; color?: string }
  label?: string
  style?: Record<string, any>
  markerEnd: string
  selected?: boolean
}

const props = defineProps<NetworkEdgeProps>()
const emit = defineEmits(['click'])

const edgeColor = computed(() => {
  if (props.selected) return '#0078d4'
  return props.data.color || '#999999'
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
  strokeWidth: props.selected ? 2.5 : 1.5,
  strokeDasharray: props.data.animated ? '5,5' : undefined,
  animation: props.data.animated ? 'dashdraw 0.5s linear infinite' : undefined,
  ...(props.style || {}),
}))
</script>

<style scoped>
.network-edge-label {
  font-size: 11px;
  fill: var(--text, #323130);
}

@keyframes dashdraw {
  to { stroke-dashoffset: -10; }
}
</style>
