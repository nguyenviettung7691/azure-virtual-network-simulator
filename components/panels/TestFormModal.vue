<template>
  <Dialog
    v-model:visible="testsStore.showTestFormModal"
    modal
    :header="testsStore.editingTest ? 'Edit Test' : 'Add Network Test'"
    :style="{ width: '480px' }"
    @hide="testsStore.closeTestFormModal()"
  >
    <div class="test-form">
      <div class="field">
        <label>Test Name</label>
        <InputText v-model="form.name" placeholder="My connection test" class="w-full" />
      </div>
      <div class="field">
        <label>Test Type</label>
        <Select v-model="form.type" :options="testTypes" option-label="label" option-value="value" class="w-full" />
      </div>

      <template v-if="form.type === 'connection' || form.type === 'loadbalance'">
        <div class="field">
          <label>Source Component</label>
          <Select v-model="form.condition.sourceId" :options="nodeOptions" option-label="label" option-value="value" class="w-full" placeholder="Select source" />
        </div>
        <div class="field">
          <label>Target Component</label>
          <Select v-model="form.condition.targetId" :options="nodeOptions" option-label="label" option-value="value" class="w-full" placeholder="Select target" />
        </div>
        <div v-if="form.type === 'connection'" class="field">
          <label>Port (optional)</label>
          <InputNumber v-model="form.condition.port" :min="1" :max="65535" placeholder="e.g. 443" class="w-full" />
        </div>
        <div v-if="form.type === 'loadbalance'" class="field">
          <label>Connection Count</label>
          <InputNumber v-model="form.condition.connectionCount" :min="1" :max="10000" placeholder="1000" class="w-full" />
        </div>
      </template>

      <template v-if="form.type === 'dns'">
        <div class="field">
          <label>DNS Zone</label>
          <Select v-model="form.condition.targetId" :options="dnsOptions" option-label="label" option-value="value" class="w-full" placeholder="Select DNS zone" />
        </div>
      </template>

      <div class="field">
        <label>Description (optional)</label>
        <Textarea v-model="form.description" rows="2" class="w-full" placeholder="What does this test check?" />
      </div>

      <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="testsStore.closeTestFormModal()" />
      <Button :label="testsStore.editingTest ? 'Save' : 'Add Test'" icon="pi pi-check" @click="submit" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { NetworkComponentType } from '~/types/network'

const testsStore = useTestsStore()
const diagramStore = useDiagramStore()

const formError = ref('')

const defaultForm = () => ({
  name: '',
  type: 'connection' as string,
  description: '',
  condition: { sourceId: '', targetId: '', port: undefined as number | undefined, connectionCount: 100 },
})

const form = ref(defaultForm())

watch(() => testsStore.showTestFormModal, (v) => {
  if (v) {
    if (testsStore.editingTest) {
      form.value = {
        name: testsStore.editingTest.name,
        type: testsStore.editingTest.type,
        description: testsStore.editingTest.description || '',
        condition: { ...testsStore.editingTest.condition },
      }
    } else {
      form.value = defaultForm()
    }
    formError.value = ''
  }
})

const testTypes = [
  { label: 'Connection Test', value: 'connection' },
  { label: 'Load Balance Test', value: 'loadbalance' },
  { label: 'Security Test', value: 'security' },
  { label: 'DNS Resolution Test', value: 'dns' },
]

const nodeOptions = computed(() =>
  diagramStore.nodes.map(n => ({ label: `${n.data.name} (${n.data.type})`, value: n.id }))
)

const dnsOptions = computed(() =>
  diagramStore.nodes.filter(n => n.data.type === NetworkComponentType.DNS_ZONE)
    .map(n => ({ label: n.data.name, value: n.id }))
)

function submit() {
  formError.value = ''
  if (!form.value.name.trim()) { formError.value = 'Test name is required'; return }

  if (testsStore.editingTest) {
    testsStore.updateTest(testsStore.editingTest.id, {
      name: form.value.name,
      type: form.value.type as any,
      description: form.value.description,
      condition: form.value.condition as any,
    })
  } else {
    testsStore.addTest({
      name: form.value.name,
      type: form.value.type as any,
      description: form.value.description,
      condition: form.value.condition as any,
      autoRun: true,
    })
  }
  testsStore.closeTestFormModal()
}
</script>

<style scoped>
.test-form { display: flex; flex-direction: column; gap: 0.9rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.85rem; font-weight: 600; color: var(--text-color-secondary); }
</style>
