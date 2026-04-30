export const useSettings = () => {
  const settingsStore = useSettingsStore()

  return {
    settings: computed(() => settingsStore.settings),
    isDarkMode: computed(() => settingsStore.isDarkMode),
    theme: computed(() => settingsStore.theme),
    darkMode: computed(() => settingsStore.darkMode),
    language: computed(() => settingsStore.language),
    autoSave: computed(() => settingsStore.autoSave),
    autoSaveInterval: computed(() => settingsStore.autoSaveInterval),
    showMinimap: computed(() => settingsStore.showMinimap),
    showGrid: computed(() => settingsStore.showGrid),
    snapToGrid: computed(() => settingsStore.snapToGrid),
    gridSize: computed(() => settingsStore.gridSize),
    animateEdges: computed(() => settingsStore.animateEdges),
    compactNodes: computed(() => settingsStore.compactNodes),
    showTooltips: computed(() => settingsStore.showTooltips),
    sidebarCollapsed: computed(() => settingsStore.sidebarCollapsed),
    rightPanelCollapsed: computed(() => settingsStore.rightPanelCollapsed),
    isSyncing: computed(() => settingsStore.isSyncing),
    syncError: computed(() => settingsStore.syncError),

    updateTheme: settingsStore.updateTheme.bind(settingsStore),
    updateDarkMode: settingsStore.updateDarkMode.bind(settingsStore),
    updateSettings: settingsStore.updateSettings.bind(settingsStore),
    openSettingsModal: settingsStore.openSettingsModal.bind(settingsStore),
    closeSettingsModal: settingsStore.closeSettingsModal.bind(settingsStore),
  }
}
