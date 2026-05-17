<template>
  <div
    class="compute-node diagram-node generic-node"
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
        <Icon :name="nodeIcon" mode="svg" class="generic-icon" />
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
import { NetworkComponentType, getComponentColor, getComponentLabel } from '~/types/network'
import { getAzureComponentIcon } from '~/lib/azureIcons'

interface Props {
  id: string
  data: any
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

const nodeColor = computed(() => getComponentColor(props.data.type))
const nodeIcon = computed(() => getAzureComponentIcon(props.data.type))
const nodeTypeLabel = computed(() => getComponentLabel(props.data.type))

const nodeDetail = computed(() => {
  const d = props.data
  if (d.type === NetworkComponentType.VM) return `${d.os || 'Linux'} - ${d.size || 'Standard_D2s_v3'}`
  if (d.type === NetworkComponentType.VMSS) return `${d.capacity || 2} instances`
  if (d.type === NetworkComponentType.AKS) return `${d.nodeCount || 3} nodes - ${d.kubernetesVersion || '1.27'}`
  if (d.type === NetworkComponentType.APP_SERVICE) return `${d.tier || 'Standard'}`
  if (d.type === NetworkComponentType.FUNCTIONS) {
    const hosting = d.hostingOption || (d.hostingPlanSku ? 'Legacy' : '')
    const runtime = d.runtimeStack || 'node'
    return [hosting, runtime].filter(Boolean).join(' - ')
  }
  return ''
})

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
