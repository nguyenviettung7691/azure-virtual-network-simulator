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
  </g>
</template>

<script setup lang="ts">
import { getSmoothStepPath } from '@vue-flow/core'
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

const edgeColor = computed(() => 'var(--diagram-edge-color, var(--text, #323130))')

const path = computed(() => {
  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: 12,
  })
  return edgePath
})

const edgeStyle = computed(() => ({
  stroke: edgeColor.value,
  strokeWidth: 1.5,
  strokeDasharray: props.data.animated ? '5,5' : undefined,
  animation: props.data.animated ? 'dashdraw 0.5s linear infinite' : undefined,
  ...(props.style || {}),
}))
</script>

<style scoped>
.network-edge-label {
  font-size: 11px;
  fill: var(--diagram-edge-color, var(--text, #323130));
}
</style>
