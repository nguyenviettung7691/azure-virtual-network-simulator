<template>
  <footer class="bottom-toolbar">
    <div class="toolbar-group">
      <span class="group-label">Export</span>
      <Button v-tooltip.top="'Export as .drawio'" icon="pi pi-file" text size="small" label=".drawio" @click="onExport('drawio')" />
      <Button v-tooltip.top="'Export as .vsdx'" icon="pi pi-file" text size="small" label=".vsdx" @click="onExport('vsdx')" />
      <Button v-tooltip.top="'Export as PNG'" icon="pi pi-image" text size="small" label="PNG" @click="onExport('png')" />
      <Button v-tooltip.top="'Export as PDF'" icon="pi pi-file-pdf" text size="small" label="PDF" @click="onExport('pdf')" />
      <Button v-tooltip.top="'Export as SVG'" icon="pi pi-file" text size="small" label="SVG" @click="onExport('svg')" />
    </div>

    <Divider layout="vertical" />

    <div class="toolbar-group">
      <span class="group-label">Import</span>
      <Button v-tooltip.top="'Import .drawio / .vsdx file'" icon="pi pi-upload" text size="small" label="Import" @click="onImport" />
      <input ref="fileInput" type="file" accept=".drawio,.xml,.vsdx" style="display:none" @change="handleFileChange" />
    </div>

    <Divider layout="vertical" />

    <div class="toolbar-group">
      <span class="save-button-wrap">
        <Button
          v-tooltip.top="'Save current setup to cloud'"
          icon="pi pi-save"
          text
          size="small"
          label="Save Setup"
          :loading="isSaving"
          @click="onSaveSetup"
        />
        <span
          v-if="diagramStore.isDirty"
          class="save-button-badge"
          aria-hidden="true"
        />
      </span>
    </div>

    <Divider layout="vertical" />

    <div class="toolbar-group">
      <Button
        v-tooltip.top="'Generate AI Challenge'"
        icon="pi pi-bolt"
        text
        size="small"
        label="AI Challenge"
        severity="help"
        @click="onAIChallenge"
      />
    </div>

    <Divider layout="vertical" />

    <div class="toolbar-group">
      <Button
        v-tooltip.top="'Reset diagram (remove all components)'"
        icon="pi pi-trash"
        text
        size="small"
        label="Reset"
        severity="danger"
        @click="onReset"
      />
    </div>

    <div class="toolbar-spacer" />

    <div class="toolbar-status">
      <span v-if="diagramStore.isDirty" class="unsaved-indicator">● Unsaved</span>
      <span class="status-text">
        <Icon icon="mdi:vector-polygon" class="status-icon" />
        {{ diagramStore.nodeCount }} nodes · {{ diagramStore.edgeCount }} edges
      </span>
    </div>
  </footer>

  <!-- Save Setup Dialog -->
  <Dialog v-model:visible="showSaveDialog" modal header="Save Setup" :style="{ width: '380px' }">
    <div class="save-form">
      <label class="field-label">Setup Name</label>
      <InputText v-model="setupName" placeholder="My VNet Setup" class="w-full" autofocus />
      <small v-if="saveError" class="p-error">{{ saveError }}</small>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="showSaveDialog = false" />
      <Button label="Save" icon="pi pi-check" :loading="isSaving" @click="confirmSave" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const diagramStore = useDiagramStore()
const authStore = useAuthStore()
const challengesStore = useChallengesStore()
const savedSetupsStore = useSavedSetupsStore()
const testsStore = useTestsStore()

const { exportToPng, exportToSvgFile, exportToPdf, exportToDrawioFile, exportToVsdxFile } = useExport()
const { importFromFile } = useImport()

const fileInput = ref<HTMLInputElement | null>(null)
const showSaveDialog = ref(false)
const setupName = ref('')
const saveError = ref('')
const isSaving = ref(false)

async function onExport(format: string) {
  const name = `azure-vnet-${Date.now()}`
  switch (format) {
    case 'drawio': await exportToDrawioFile(name); break
    case 'vsdx': await exportToVsdxFile(name); break
    case 'png': await exportToPng(name); break
    case 'pdf': await exportToPdf(name); break
    case 'svg': await exportToSvgFile(name); break
  }
}

function onImport() {
  if (diagramStore.nodeCount > 0) {
    diagramStore.confirmAction(
      'Importing a file will replace your current diagram. Continue?',
      () => fileInput.value?.click()
    )
  } else {
    fileInput.value?.click()
  }
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await importFromFile(file)
  input.value = ''
}

function onSaveSetup() {
  if (!authStore.isAuthenticated) {
    authStore.openAuthModal('login')
    return
  }
  setupName.value = ''
  saveError.value = ''
  showSaveDialog.value = true
}

async function confirmSave() {
  if (!setupName.value.trim()) {
    saveError.value = 'Please enter a setup name'
    return
  }
  isSaving.value = true
  saveError.value = ''
  try {
    await savedSetupsStore.saveCurrentSetup(setupName.value.trim())
    showSaveDialog.value = false
  } catch (err: any) {
    saveError.value = err.message || 'Failed to save'
  } finally {
    isSaving.value = false
  }
}

function onAIChallenge() {
  if (!authStore.isAuthenticated) {
    authStore.openAuthModal('login')
    return
  }
  diagramStore.confirmAction(
    'Generating a challenge will remove your current diagram. Continue?',
    () => challengesStore.openSetupModal()
  )
}

function onReset() {
  if (diagramStore.nodeCount === 0) return
  diagramStore.confirmAction(
    'This will remove all components from the diagram. Are you sure?',
    (resetTests?: boolean) => {
      diagramStore.resetDiagram()
      if (resetTests) testsStore.clearAllTests()
    },
    'Also reset all network tests'
  )
}
</script>

<style scoped>
.bottom-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  height: var(--bottom-toolbar-height);
  background: var(--surface-card);
  border-top: 1px solid var(--surface-border);
  box-shadow: 0 -1px 4px rgba(0,0,0,0.06);
  flex-shrink: 0;
  z-index: 50;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.save-button-wrap {
  position: relative;
  display: inline-flex;
}

.save-button-badge {
  position: absolute;
  top: 0.15rem;
  right: 0.15rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--warning);
  box-shadow: 0 0 0 2px var(--surface-card);
  pointer-events: none;
}

.group-label {
  font-size: 0.65rem;
  color: var(--text-color-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 0.15rem;
  white-space: nowrap;
}

.toolbar-spacer { flex: 1; }

.toolbar-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.status-icon {
  font-size: 0.85rem;
  vertical-align: middle;
}

.unsaved-indicator {
  color: var(--warning);
  font-weight: 600;
}

.save-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}
</style>
