<template>
  <footer class="bottom-toolbar">
    <div class="toolbar-group">
      <span class="group-label">Export</span>
      <Button
        v-tooltip.top="'Export as .drawio'"
        text
        size="small"
        class="export-action-button"
        :disabled="isExportBusy('drawio')"
        :loading="isExportSpinner('drawio')"
        @click="onExport('drawio')"
      >
        <span class="export-button-content" aria-hidden="true">
          <span class="export-button-row">
            <Icon icon="mdi:xml" />
            <span>.drawio</span>
          </span>
          <ProgressBar
            v-if="isExportDeterminate('drawio')"
            class="export-progress-bar"
            :value="exportProgress.value"
          />
        </span>
      </Button>
      <Button
        v-tooltip.top="'Export as PNG'"
        text
        size="small"
        class="export-action-button"
        :disabled="isExportBusy('png')"
        :loading="isExportSpinner('png')"
        @click="onExport('png')"
      >
        <span class="export-button-content" aria-hidden="true">
          <span class="export-button-row">
            <i class="pi pi-image" />
            <span>PNG</span>
          </span>
          <ProgressBar
            v-if="isExportDeterminate('png')"
            class="export-progress-bar"
            :value="exportProgress.value"
          />
        </span>
      </Button>
      <Button
        v-tooltip.top="'Export as PDF'"
        text
        size="small"
        class="export-action-button"
        :disabled="isExportBusy('pdf')"
        :loading="isExportSpinner('pdf')"
        @click="onExport('pdf')"
      >
        <span class="export-button-content" aria-hidden="true">
          <span class="export-button-row">
            <i class="pi pi-file-pdf" />
            <span>PDF</span>
          </span>
          <ProgressBar
            v-if="isExportDeterminate('pdf')"
            class="export-progress-bar"
            :value="exportProgress.value"
          />
        </span>
      </Button>
      <Button
        v-tooltip.top="'Export as SVG'"
        text
        size="small"
        class="export-action-button"
        :disabled="isExportBusy('svg')"
        :loading="isExportSpinner('svg')"
        @click="onExport('svg')"
      >
        <span class="export-button-content" aria-hidden="true">
          <span class="export-button-row">
            <Icon icon="mdi:vector-square" />
            <span>SVG</span>
          </span>
          <ProgressBar
            v-if="isExportDeterminate('svg')"
            class="export-progress-bar"
            :value="exportProgress.value"
          />
        </span>
      </Button>
    </div>

    <Divider layout="vertical" />

    <div class="toolbar-group">
      <span class="group-label">Import</span>
      <Button v-tooltip.top="'Import .drawio file'" icon="pi pi-upload" text size="small" @click="onImport" />
      <input ref="fileInput" type="file" accept=".drawio" style="display:none" @change="handleFileChange" />
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
          class="save-setup-btn"
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
        class="ai-challenge-btn"
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
        class="reset-btn"
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

type ExportFormat = 'drawio' | 'png' | 'pdf' | 'svg'

interface ExportProgressState {
  format: ExportFormat | null
  mode: 'idle' | 'spinner' | 'determinate'
  value: number
  startedAtMs: number
  thresholdTimer: ReturnType<typeof setTimeout> | null
  progressTimer: ReturnType<typeof setInterval> | null
}

const diagramStore = useDiagramStore()
const authStore = useAuthStore()
const challengesStore = useChallengesStore()
const savedSetupsStore = useSavedSetupsStore()
const testsStore = useTestsStore()

const { exportToPng, exportToSvgFile, exportToPdf, exportToDrawioFile } = useExport()
const { importFromFile } = useImport()

const fileInput = ref<HTMLInputElement | null>(null)
const showSaveDialog = ref(false)
const setupName = ref('')
const saveError = ref('')
const isSaving = ref(false)
const exportDurationEstimatesMs = ref<Record<ExportFormat, number>>({
  drawio: 7000,
  png: 4500,
  pdf: 6500,
  svg: 4500,
})
const exportProgress = reactive<ExportProgressState>({
  format: null,
  mode: 'idle',
  value: 0,
  startedAtMs: 0,
  thresholdTimer: null,
  progressTimer: null,
})

async function onExport(format: ExportFormat) {
  if (exportProgress.format) return

  const filename = resolveExportFilename(generateDefaultExportFilename())
  const isWorkerDriven = format === 'png' || format === 'pdf' || format === 'svg'
  if (isWorkerDriven) {
    beginWorkerExportProgress(format)
  } else {
    beginExportProgress(format)
  }
  await yieldForExportPaint()
  const startedAt = performance.now()
  let succeeded = false

  try {
    switch (format) {
      case 'drawio':
        succeeded = await exportToDrawioFile(filename)
        break
      case 'png':
        succeeded = await exportToPng(filename, (_stage, percent) => {
          updateWorkerExportProgress(format, percent)
        })
        break
      case 'pdf':
        succeeded = await exportToPdf(filename, (_stage, percent) => {
          updateWorkerExportProgress(format, percent)
        })
        break
      case 'svg':
        succeeded = await exportToSvgFile(filename, (_stage, percent) => {
          updateWorkerExportProgress(format, percent)
        })
        break
    }
  } catch (err) {
    console.error(`Export failed for format ${format}:`, err)
  } finally {
    const elapsed = performance.now() - startedAt
    if (succeeded) updateDurationEstimate(format, elapsed)
    await finishExportProgress(elapsed)
  }
}

function beginWorkerExportProgress(format: ExportFormat) {
  clearExportTimers()
  exportProgress.format = format
  exportProgress.mode = 'determinate'
  exportProgress.value = 1
  exportProgress.startedAtMs = performance.now()
}

function updateWorkerExportProgress(format: ExportFormat, percent: number) {
  if (exportProgress.format !== format) return
  if (exportProgress.mode !== 'determinate') {
    exportProgress.mode = 'determinate'
  }
  const normalized = Number.isFinite(percent) ? Math.round(percent) : 1
  exportProgress.value = Math.min(99, Math.max(1, normalized))
}

function isExportBusy(_format: ExportFormat): boolean {
  return Boolean(exportProgress.format)
}

function isExportSpinner(format: ExportFormat): boolean {
  return exportProgress.format === format && exportProgress.mode === 'spinner'
}

function isExportDeterminate(format: ExportFormat): boolean {
  return exportProgress.format === format && exportProgress.mode === 'determinate'
}

function beginExportProgress(format: ExportFormat) {
  clearExportTimers()
  exportProgress.format = format
  exportProgress.mode = 'spinner'
  exportProgress.value = 0
  exportProgress.startedAtMs = performance.now()

  exportProgress.thresholdTimer = setTimeout(() => {
    if (exportProgress.format !== format) return
    exportProgress.mode = 'determinate'
    updateDeterminateProgress(format)
    exportProgress.progressTimer = setInterval(() => {
      if (exportProgress.format !== format) return
      updateDeterminateProgress(format)
    }, 120)
  }, 10000)
}

function updateDeterminateProgress(format: ExportFormat) {
  const elapsed = performance.now() - exportProgress.startedAtMs
  const estimatedTotal = Math.max(exportDurationEstimatesMs.value[format], elapsed + 2500)
  const nextValue = Math.round((elapsed / estimatedTotal) * 100)
  exportProgress.value = Math.min(95, Math.max(1, nextValue))
}

async function finishExportProgress(elapsedMs: number) {
  if (elapsedMs >= 10000 && exportProgress.mode === 'spinner') {
    exportProgress.mode = 'determinate'
    exportProgress.value = 100
    await new Promise(resolve => setTimeout(resolve, 160))
  } else if (exportProgress.mode === 'determinate') {
    exportProgress.value = 100
    await new Promise(resolve => setTimeout(resolve, 160))
  }
  clearExportTimers()
  exportProgress.format = null
  exportProgress.mode = 'idle'
  exportProgress.value = 0
}

async function yieldForExportPaint() {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

function clearExportTimers() {
  if (exportProgress.thresholdTimer) {
    clearTimeout(exportProgress.thresholdTimer)
    exportProgress.thresholdTimer = null
  }
  if (exportProgress.progressTimer) {
    clearInterval(exportProgress.progressTimer)
    exportProgress.progressTimer = null
  }
}

function updateDurationEstimate(format: ExportFormat, elapsedMs: number) {
  const prev = exportDurationEstimatesMs.value[format]
  exportDurationEstimatesMs.value[format] = Math.max(1000, Math.round((prev * 0.65) + (elapsedMs * 0.35)))
}

function generateDefaultExportFilename() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const sec = String(now.getSeconds()).padStart(2, '0')
  return `azure-vnet-${yyyy}${mm}${dd}-${hh}${min}${sec}`
}

function resolveExportFilename(rawName: string) {
  const defaultName = generateDefaultExportFilename()
  const trimmed = rawName.trim() || defaultName
  const withoutExtension = trimmed.replace(/\.(drawio|png|pdf|svg)$/i, '')
  const sanitized = withoutExtension
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  const fallback = sanitized || defaultName
  return fallback.slice(0, 120)
}

onBeforeUnmount(() => {
  clearExportTimers()
})

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
  const isNativeDrawioImport = file.name.endsWith('.drawio')
  const hasExistingTests = testsStore.tests.length > 0
  const shouldPromptForTests = isNativeDrawioImport && hasExistingTests
  const shouldRerunKeptTests = shouldPromptForTests && testsStore.autoRunEnabled
  const renderReady = shouldPromptForTests ? diagramStore.waitForNextLoadRender() : null

  if (shouldRerunKeptTests) {
    testsStore.deferNextDiagramLoadAutoRun()
  }

  const result = await importFromFile(file)

  if (!result.success) {
    if (shouldRerunKeptTests) {
      testsStore.resetNextDiagramLoadAutoRunSkip()
    }
    input.value = ''
    return
  }

  if (result.format === 'drawio' && renderReady) {
    await renderReady
    promptForImportedTestReset({ rerunKeptTests: shouldRerunKeptTests })
  }

  input.value = ''
}

function promptForImportedTestReset(options: { rerunKeptTests: boolean }) {
  diagramStore.confirmAction(
    'The diagram was imported successfully. Do you also want to reset all Network Tests?',
    () => testsStore.clearAllTests(),
    {
      confirmLabel: 'Reset Tests',
      cancelLabel: 'Keep Tests',
      cancelAction: () => {
        if (!options.rerunKeptTests) return
        void testsStore.runAllTests(diagramStore.nodes, diagramStore.edges)
      },
    }
  )
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
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--surface-card);
  border-top: 1px solid var(--surface-border);
  box-shadow: 0 -1px 4px rgba(0,0,0,0.06);
  flex-shrink: 0;
  z-index: 50;
}

.bottom-toolbar::-webkit-scrollbar {
  height: 6px;
}

.bottom-toolbar::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-color-secondary) 35%, transparent);
  border-radius: 999px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
}

.export-filename-input {
  width: 12.5rem;
  font-size: 0.75rem;
  margin-right: 0.25rem;
}

.export-button-content {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 4.75rem;
}

.export-button-row {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  line-height: 1;
}

.export-action-button {
  min-width: 5.5rem;
}

.export-action-button :deep(.p-button-label) {
  font-size: 0.78rem;
  font-weight: 600;
}

.export-progress-bar {
  width: 4.5rem;
  height: 0.24rem;
}

.export-progress-bar :deep(.p-progressbar) {
  height: 100%;
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
  flex-shrink: 0;
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

@media (max-width: 1024px) {
  .bottom-toolbar {
    gap: 0.35rem;
    padding: 0 0.5rem;
  }

  .group-label {
    font-size: 0.58rem;
    margin-right: 0.1rem;
  }

  .export-action-button {
    min-width: 5rem;
  }

  .export-button-content {
    min-width: 4.25rem;
  }

  .toolbar-spacer {
    flex: 0 0 0.5rem;
  }

  .toolbar-status {
    gap: 0.35rem;
    font-size: 0.7rem;
  }

  .status-text {
    white-space: nowrap;
  }

  .save-setup-btn,
  .ai-challenge-btn,
  .reset-btn {
    width: 34px;
    height: 34px;
    padding: 0;
  }

  .save-setup-btn :deep(.p-button-label),
  .ai-challenge-btn :deep(.p-button-label),
  .reset-btn :deep(.p-button-label) {
    display: none;
  }

  :deep(.p-divider.p-divider-vertical) {
    margin: 0 0.1rem;
  }
}
</style>
