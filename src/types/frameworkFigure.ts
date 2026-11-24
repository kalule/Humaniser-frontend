// PR 8 (2026-11-24): the conceptual framework figure. Mirrors HumaniseAI.Application.DTOs.Research.FrameworkFigureDtos.

export type FigureRole = 'predictor' | 'mediator' | 'outcome' | 'moderator' | 'control'
export type FigureEdgeKind = 'association' | 'mediation' | 'moderation' | 'control'

export interface FigureNode {
  id: string
  label: string
  role: FigureRole | string
  x: number
  y: number
  w: number
  h: number
}

export interface FigureEdge {
  from: string
  to: string
  kind: FigureEdgeKind | string
  label?: string | null
  /** For a moderation arrow: the arrow it points at, "fromId->toId". */
  targetEdge?: string | null
}

export interface FrameworkFigureSpec {
  version: string
  width: number
  height: number
  nodes: FigureNode[]
  edges: FigureEdge[]
  caption: string
  note: string
  edited: boolean
}

export interface FrameworkFigureResponse {
  /** True when the figure is the student's saved copy; false when it was computed from the saved text. */
  stored: boolean
  figure: FrameworkFigureSpec | null
  /** Why there is no figure (for example a qualitative design). */
  reason: string | null
}

/** sectionContent key holding the student's edited figure (a JSON string; empty = use the computed one). */
export const FRAMEWORK_FIGURE_KEY = 'frameworkDiagram'
/** sectionContent key for the abstract format: "single" for one paragraph; anything else is structured. */
export const ABSTRACT_FORMAT_KEY = 'abstractFormat'
