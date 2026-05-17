<template>
  <div
    class="storage-node diagram-node generic-node"
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
  if (d.type === NetworkComponentType.STORAGE_ACCOUNT) return [d.accountKind || 'StorageV2', d.replication || 'LRS'].filter(Boolean).join(' · ')
  if (d.type === NetworkComponentType.BLOB_STORAGE) return [d.accountKind || 'BlobStorage', d.replication || 'LRS'].filter(Boolean).join(' · ')
  if (d.type === NetworkComponentType.MANAGED_DISK) {
    const size = d.diskSizeGb || 128
    const diskType = d.diskType || d.sku || 'Standard'
    const redundancy = d.redundancy || 'LRS'
    const role = d.diskRole ? ` (${d.diskRole})` : ''
    return `${diskType} - ${size} GB (${redundancy})${role}`
  }
  return ''
})

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>
