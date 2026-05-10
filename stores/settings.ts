import { defineStore } from 'pinia'
import type { UserSettings, ThemeType, DarkModeType } from '~/types/settings'

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'ocean-blue',
  darkMode: 'system',
  language: 'en',
  autoSave: true,
  autoSaveInterval: 30,
  showMinimap: true,
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  defaultRegion: 'eastus',
  defaultResourceGroup: 'my-rg',
  showTooltips: true,
  animateEdges: true,
  compactNodes: false,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    ...DEFAULT_SETTINGS,
    showSettingsModal: false,
    isSyncing: false,
    syncError: null as string | null,
    currentUserId: null as string | null,
    lastAutoSaveAttemptAt: null as string | null,
    lastAutoSaveAt: null as string | null,
  }),

  getters: {
    isDarkMode(): boolean {
      if (this.darkMode === 'dark') return true
      if (this.darkMode === 'light') return false
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      return false
    },
    settings(): UserSettings {
      return {
        theme: this.theme,
        darkMode: this.darkMode,
        language: this.language,
        autoSave: this.autoSave,
        autoSaveInterval: this.autoSaveInterval,
        showMinimap: this.showMinimap,
        showGrid: this.showGrid,
        snapToGrid: this.snapToGrid,
        gridSize: this.gridSize,
        defaultRegion: this.defaultRegion,
        defaultResourceGroup: this.defaultResourceGroup,
        showTooltips: this.showTooltips,
        animateEdges: this.animateEdges,
        compactNodes: this.compactNodes,
        sidebarCollapsed: this.sidebarCollapsed,
        rightPanelCollapsed: this.rightPanelCollapsed,
      }
    },
  },

  actions: {
    updateTheme(theme: ThemeType) {
      this.theme = theme
      this.applyTheme()
      this.saveToLocalStorage()
    },

    updateDarkMode(mode: DarkModeType) {
      this.darkMode = mode
      this.applyDarkMode()
      this.saveToLocalStorage()
    },

    updateSettings(updates: Partial<UserSettings>) {
      Object.assign(this, updates)
      this.applyAll()
      this.saveToLocalStorage()
    },

    applySettingsSnapshot(snapshot: Partial<UserSettings>, options: { persistToLocalStorage?: boolean } = {}) {
      this.theme = snapshot.theme || DEFAULT_SETTINGS.theme
      this.darkMode = snapshot.darkMode || DEFAULT_SETTINGS.darkMode
      this.language = snapshot.language || DEFAULT_SETTINGS.language
      this.autoSave = snapshot.autoSave ?? DEFAULT_SETTINGS.autoSave
      this.autoSaveInterval = snapshot.autoSaveInterval || DEFAULT_SETTINGS.autoSaveInterval
      this.showMinimap = snapshot.showMinimap ?? DEFAULT_SETTINGS.showMinimap
      this.showGrid = snapshot.showGrid ?? DEFAULT_SETTINGS.showGrid
      this.snapToGrid = snapshot.snapToGrid ?? DEFAULT_SETTINGS.snapToGrid
      this.gridSize = snapshot.gridSize || DEFAULT_SETTINGS.gridSize
      this.defaultRegion = snapshot.defaultRegion || DEFAULT_SETTINGS.defaultRegion
      this.defaultResourceGroup = snapshot.defaultResourceGroup || DEFAULT_SETTINGS.defaultResourceGroup
      this.showTooltips = snapshot.showTooltips ?? DEFAULT_SETTINGS.showTooltips
      this.animateEdges = snapshot.animateEdges ?? DEFAULT_SETTINGS.animateEdges
      this.compactNodes = snapshot.compactNodes ?? DEFAULT_SETTINGS.compactNodes
      this.sidebarCollapsed = snapshot.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed
      this.rightPanelCollapsed = snapshot.rightPanelCollapsed ?? DEFAULT_SETTINGS.rightPanelCollapsed
      this.applyAll()
      if (options.persistToLocalStorage) {
        this.saveToLocalStorage()
      }
    },

    applyTheme() {
      if (typeof document === 'undefined') return
      const themes = ['ocean-blue', 'azure-dark', 'forest-green', 'sunset-orange', 'midnight-purple', 'rose-gold']
      themes.forEach(t => document.documentElement.classList.remove(`theme-${t}`))
      if (this.theme !== 'ocean-blue') {
        document.documentElement.classList.add(`theme-${this.theme}`)
      }
    },

    applyDarkMode() {
      if (typeof document === 'undefined') return
      if (this.isDarkMode) {
        document.documentElement.classList.add('dark-mode')
      } else {
        document.documentElement.classList.remove('dark-mode')
      }
    },

    applyAll() {
      this.applyTheme()
      this.applyDarkMode()
    },

    saveToLocalStorage() {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem('vnet-settings', JSON.stringify(this.settings))
    },

    loadFromLocalStorage() {
      if (typeof localStorage === 'undefined') return
      const saved = localStorage.getItem('vnet-settings')
      if (!saved) return
      try {
        const parsed = JSON.parse(saved) as Partial<UserSettings>
        this.applySettingsSnapshot(parsed)
      } catch {
        // ignore malformed data
      }
    },

    openSettingsModal() {
      this.showSettingsModal = true
    },

    closeSettingsModal() {
      this.showSettingsModal = false
    },

    // MongoDB Atlas sync -------------------------------------------------------

    setSyncing(isSyncing: boolean) {
      this.isSyncing = isSyncing
    },

    setSyncError(error: string | null) {
      this.syncError = error
    },

    applyRemoteSettings(remote: UserSettings) {
      this.applySettingsSnapshot(remote, { persistToLocalStorage: true })
      this.syncError = null
    },

    setCurrentUser(userId: string | null) {
      this.currentUserId = userId
      if (!userId) {
        this.isSyncing = false
      }
    },

    setLastAutoSaveTime() {
      this.lastAutoSaveAt = new Date().toISOString()
    },

    setLastAutoSaveAttemptTime() {
      this.lastAutoSaveAttemptAt = new Date().toISOString()
    },
  },
})
