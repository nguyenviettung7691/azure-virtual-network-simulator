import type { Node, Edge } from '@vue-flow/core'
import type { AnyNetworkComponent } from './network'

export interface DiagramNode extends Node {
  data: AnyNetworkComponent
}

export interface DiagramEdge extends Edge {
  type?: string
  animated?: boolean
}

export type DiagramViewMode = 'infrastructure' | 'animation'

export type AnimationVisualState = 'pending' | 'active' | 'pass' | 'fail' | 'warning'

export type AnimationTerminalState = 'pass' | 'fail' | 'warning'

export interface DiagramAnimationSession {
  activeTestId: string
  path: string[]
  overlayEdges: DiagramEdge[]
  nodeStates: Record<string, AnimationVisualState>
  edgeStates: Record<string, AnimationVisualState>
  activeEdgeId: string | null
  travelerVisible: boolean
  segmentDurationMs: number
  terminalState: AnimationTerminalState
  isRunning: boolean
}

export enum EdgeType {
  DEFAULT = 'network-edge',
  ANIMATED = 'animated-edge',
  DASHED = 'dashed-edge',
}

export interface DiagramViewport {
  x: number
  y: number
  zoom: number
}

export interface DiagramState {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  viewport: DiagramViewport
}

export interface SavedSetup {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  thumbnailUrl?: string
  state: DiagramState
  tags?: string[]
}
