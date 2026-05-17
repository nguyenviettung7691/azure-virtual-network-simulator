<template>
  <div class="component-form">
    <div class="field">
      <label>Name *</label>
      <InputText v-model="model.name" class="w-full" placeholder="web-servers-asg" />
    </div>
    
    <div class="field">
      <label>Description</label>
      <Textarea v-model="model.description" rows="2" class="w-full" placeholder="NICs that belong to this security group" />
    </div>
    
    <div class="field">
      <label>Virtual Network (Derived)</label>
      <div class="read-only-field">
        {{ vnetDisplay }}
      </div>
      <small class="hint-text">Automatically determined by member NICs. All NICs must be in the same VNet.</small>
    </div>
    
    <div class="field">
      <label>Member NICs</label>
      <div class="member-info">
        <div v-if="nicCount === 0" class="empty-state">
          <i class="pi pi-info-circle"></i>
          No NICs assigned yet
        </div>
        <div v-else class="member-count">
          <strong>{{ nicCount }}</strong> NIC{{ nicCount !== 1 ? 's' : '' }} in this group
        </div>
      </div>
    </div>
    
    <p class="hint">Application Security Groups logically group network interfaces. Assign NICs to this ASG in the NIC form for group-based NSG rules.</p>
  </div>
</template>

<script setup lang="ts">
import type { AsgComponent } from '~/types/network'

const props = defineProps<{ modelValue: Partial<AsgComponent>; nodes?: any[] }>()
const emit = defineEmits(['update:modelValue'])

const model = computed({ 
  get: () => props.modelValue as AsgComponent, 
  set: v => emit('update:modelValue', v) 
})

const nicCount = computed(() => model.value.nicIds?.length || 0)

const vnetDisplay = computed(() => {
  if (!model.value.nicIds || model.value.nicIds.length === 0) {
    return '(No NICs assigned; VNet will be determined when first NIC is added)'
  }
  
  // Get VNet of first NIC
  if (!props.nodes) return 'N/A'
  
  const firstNicId = model.value.nicIds[0]
  const nic = props.nodes.find((n: any) => n.id === firstNicId)?.data
  if (!nic?.subnetId) return 'Unknown'
  
  const subnet = props.nodes.find((n: any) => n.id === nic.subnetId)?.data
  if (!subnet?.vnetId) return 'Unknown'
  
  const vnet = props.nodes.find((n: any) => n.id === subnet.vnetId)?.data
  return vnet?.name || 'Unknown'
})
</script>

<style scoped>
.component-form { display: flex; flex-direction: column; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.82rem; font-weight: 600; color: var(--text-color-secondary); }
.hint { font-size: 0.78rem; color: var(--text-color-secondary); font-style: italic; margin: 0; }
.read-only-field {
  background-color: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 0.25rem;
  padding: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-color);
  font-family: monospace;
}
.hint-text { font-size: 0.75rem; color: var(--text-color-secondary); display: block; margin-top: 0.25rem; }
.member-info {
  background-color: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 0.25rem;
  padding: 0.75rem;
  font-size: 0.9rem;
}
.empty-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
  font-style: italic;
}
.empty-state i { font-size: 1.1rem; }
.member-count {
  color: var(--text-color);
  font-weight: 500;
}
</style>
