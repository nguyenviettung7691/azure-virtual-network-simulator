<template>
  <div
    class="identity-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: nodeColor }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: nodeColor + '20' }">
        <Icon :icon="nodeIcon" :style="{ color: nodeColor }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">{{ nodeTypeLabel }}</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail">{{ nodeDetail }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import { NetworkComponentType, getComponentColor, getComponentIcon, getComponentLabel } from '~/types/network'

interface Props {
  id: string
  data: any
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

const nodeColor = computed(() => getComponentColor(props.data.type))
const nodeIcon = computed(() => getComponentIcon(props.data.type))
const nodeTypeLabel = computed(() => getComponentLabel(props.data.type))

const nodeDetail = computed(() => {
  const d = props.data
  if (d.type === NetworkComponentType.KEY_VAULT) return `${d.sku || 'Standard'}`
  if (d.type === NetworkComponentType.MANAGED_IDENTITY) return `${d.identityType || 'UserAssigned'}`
  return ''
})

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
