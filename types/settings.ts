export type ThemeType =
  | 'ocean-blue'
  | 'azure-dark'
  | 'forest-green'
  | 'sunset-orange'
  | 'midnight-purple'
  | 'rose-gold'

export type DarkModeType = 'light' | 'dark' | 'system'

export interface UserSettings {
  theme: ThemeType
  darkMode: DarkModeType
  language: string
  autoSave: boolean
  autoSaveInterval: number
  showMinimap: boolean
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  defaultRegion: string
  defaultResourceGroup: string
  showTooltips: boolean
  animateEdges: boolean
  compactNodes: boolean
  sidebarCollapsed: boolean
  rightPanelCollapsed: boolean
}
