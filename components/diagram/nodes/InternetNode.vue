<template>
  <div class="internet-node diagram-node" :class="{ selected }">
    <Handle type="source" :position="Position.Right" />
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Top" id="top-source" />
    <Handle type="target" :position="Position.Bottom" id="bottom-target" />

    <div class="internet-shell">
      <Icon icon="mdi:web" class="internet-icon" />
      <span class="internet-name">{{ data.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Icon } from '@iconify/vue'
import type { InternetComponent } from '~/types/network'

interface Props {
  id: string
  data: InternetComponent
  selected?: boolean
}

defineProps<Props>()
</script>

<style scoped>
.internet-node {
  width: 100%;
  height: 100%;
}

.internet-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 1rem 1.1rem;
  border: 2px dashed #0f6cbd;
  border-radius: 18px;
  background:
    radial-gradient(circle at top, rgba(15, 108, 189, 0.18), transparent 58%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(232, 243, 255, 0.99));
  box-shadow: 0 10px 24px rgba(15, 108, 189, 0.12);
  text-align: center;
}

.internet-node.selected .internet-shell {
  box-shadow: 0 0 0 3px rgba(15, 108, 189, 0.24), 0 14px 28px rgba(15, 108, 189, 0.18);
}

.internet-icon {
  width: 4.25rem;
  height: 4.25rem;
  color: #0f6cbd;
  filter: drop-shadow(0 6px 12px rgba(15, 108, 189, 0.18));
}

.internet-name {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.01em;
  color: #0b2239;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
}
</style>