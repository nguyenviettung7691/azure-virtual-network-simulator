import type { Node, Edge } from '@vue-flow/core'
import type { AnyNetworkComponent } from './network'

export interface DiagramNode extends Node {
  data: AnyNetworkComponent
}

export interface DiagramEdge extends Edge {
  type?: string
  animated?: boolean
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
