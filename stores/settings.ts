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
        this.theme = parsed.theme || DEFAULT_SETTINGS.theme
        this.darkMode = parsed.darkMode || DEFAULT_SETTINGS.darkMode
        this.language = parsed.language || DEFAULT_SETTINGS.language
        this.autoSave = parsed.autoSave ?? DEFAULT_SETTINGS.autoSave
        this.autoSaveInterval = parsed.autoSaveInterval || DEFAULT_SETTINGS.autoSaveInterval
        this.showMinimap = parsed.showMinimap ?? DEFAULT_SETTINGS.showMinimap
        this.showGrid = parsed.showGrid ?? DEFAULT_SETTINGS.showGrid
        this.snapToGrid = parsed.snapToGrid ?? DEFAULT_SETTINGS.snapToGrid
        this.gridSize = parsed.gridSize || DEFAULT_SETTINGS.gridSize
        this.defaultRegion = parsed.defaultRegion || DEFAULT_SETTINGS.defaultRegion
        this.defaultResourceGroup = parsed.defaultResourceGroup || DEFAULT_SETTINGS.defaultResourceGroup
        this.showTooltips = parsed.showTooltips ?? DEFAULT_SETTINGS.showTooltips
        this.animateEdges = parsed.animateEdges ?? DEFAULT_SETTINGS.animateEdges
        this.compactNodes = parsed.compactNodes ?? DEFAULT_SETTINGS.compactNodes
        this.sidebarCollapsed = parsed.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed
        this.rightPanelCollapsed = parsed.rightPanelCollapsed ?? DEFAULT_SETTINGS.rightPanelCollapsed
        this.applyAll()
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
  },
})
