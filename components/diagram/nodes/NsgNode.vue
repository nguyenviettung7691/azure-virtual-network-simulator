<template>
  <div
    class="nsg-node diagram-node generic-node"
    :class="{ selected }"
    @dblclick="onDblClick"
  >
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />
    <div class="generic-node-content" :style="{ borderColor: '#d13438' }">
      <div class="generic-node-icon-wrap" :style="{ backgroundColor: '#d1343820' }">
        <Icon icon="mdi:shield-lock" :style="{ color: '#d13438' }" class="generic-icon" />
      </div>
      <div class="generic-node-info">
        <span class="generic-node-type">Network Security Group</span>
        <span class="generic-node-name">{{ data.name }}</span>
        <span class="generic-node-detail" v-if="data.securityRules?.length">
          {{ data.securityRules.length }} rules
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { NsgComponent } from '~/types/network'

interface Props {
  id: string
  data: NsgComponent
  selected?: boolean
}

const props = defineProps<Props>()
const diagramStore = useDiagramStore()

function onDblClick() {
  diagramStore.openEditComponentModal(props.data)
}
</script>

<style scoped>
/* Styles provided globally via assets/css/diagram.css */
</style>
