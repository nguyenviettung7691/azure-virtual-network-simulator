import { defineStore } from 'pinia'
import type { UserSettings, ThemeType, DarkModeType } from '~/types/settings'
import { getUserSettings, saveUserSettings } from '~/lib/mongodb'

// Module-level debounce handle — kept outside reactive state intentionally
let _saveTimer: ReturnType<typeof setTimeout> | null = null

// Clear pending timer on HMR to prevent stale callbacks holding store references
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (_saveTimer) {
      clearTimeout(_saveTimer)
      _saveTimer = null
    }
  })
}

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
      this._scheduleSave()
    },

    updateDarkMode(mode: DarkModeType) {
      this.darkMode = mode
      this.applyDarkMode()
      this.saveToLocalStorage()
      this._scheduleSave()
    },

    updateSettings(updates: Partial<UserSettings>) {
      Object.assign(this, updates)
      this.applyAll()
      this.saveToLocalStorage()
      this._scheduleSave()
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

    // MongoDB Atlas sync -------------------------------------------------------

    setCurrentUser(userId: string | null) {
      this.currentUserId = userId
      if (!userId && _saveTimer !== null) {
        clearTimeout(_saveTimer)
        _saveTimer = null
      }
    },

    async loadFromMongoDB() {
      if (!this.currentUserId) return
      this.isSyncing = true
      this.syncError = null
      try {
        const config = useRuntimeConfig().public
        const remote = await getUserSettings(this.currentUserId, {
          mongodbEndpoint: config.mongodbEndpoint,
          mongodbApiKey: config.mongodbApiKey,
          mongodbDatabase: config.mongodbDatabase,
          mongodbCollection: config.mongodbCollection,
        })
        if (remote) {
          // Remote wins — apply then warm the local cache
          this.theme = remote.theme || DEFAULT_SETTINGS.theme
          this.darkMode = remote.darkMode || DEFAULT_SETTINGS.darkMode
          this.language = remote.language || DEFAULT_SETTINGS.language
          this.autoSave = remote.autoSave ?? DEFAULT_SETTINGS.autoSave
          this.autoSaveInterval = remote.autoSaveInterval || DEFAULT_SETTINGS.autoSaveInterval
          this.showMinimap = remote.showMinimap ?? DEFAULT_SETTINGS.showMinimap
          this.showGrid = remote.showGrid ?? DEFAULT_SETTINGS.showGrid
          this.snapToGrid = remote.snapToGrid ?? DEFAULT_SETTINGS.snapToGrid
          this.gridSize = remote.gridSize || DEFAULT_SETTINGS.gridSize
          this.defaultRegion = remote.defaultRegion || DEFAULT_SETTINGS.defaultRegion
          this.defaultResourceGroup = remote.defaultResourceGroup || DEFAULT_SETTINGS.defaultResourceGroup
          this.showTooltips = remote.showTooltips ?? DEFAULT_SETTINGS.showTooltips
          this.animateEdges = remote.animateEdges ?? DEFAULT_SETTINGS.animateEdges
          this.compactNodes = remote.compactNodes ?? DEFAULT_SETTINGS.compactNodes
          this.sidebarCollapsed = remote.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed
          this.rightPanelCollapsed = remote.rightPanelCollapsed ?? DEFAULT_SETTINGS.rightPanelCollapsed
          this.applyAll()
          this.saveToLocalStorage()
        }
      } catch (err: any) {
        this.syncError = err?.message || 'Failed to load settings from MongoDB'
      } finally {
        this.isSyncing = false
      }
    },

    async saveToMongoDB() {
      if (!this.currentUserId) return
      this.isSyncing = true
      this.syncError = null
      try {
        const config = useRuntimeConfig().public
        await saveUserSettings(this.currentUserId, this.settings, {
          mongodbEndpoint: config.mongodbEndpoint,
          mongodbApiKey: config.mongodbApiKey,
          mongodbDatabase: config.mongodbDatabase,
          mongodbCollection: config.mongodbCollection,
        })
      } catch (err: any) {
        this.syncError = err?.message || 'Failed to save settings to MongoDB'
      } finally {
        this.isSyncing = false
      }
    },

    _scheduleSave() {
      if (!this.currentUserId) return
      if (_saveTimer !== null) clearTimeout(_saveTimer)
      _saveTimer = setTimeout(() => {
        _saveTimer = null
        this.saveToMongoDB()
      }, 1500)
    },
  },
})
