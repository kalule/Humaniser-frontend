import type { StudioType } from '../types/studio'
import type { GeneratorMode } from '../types/research'

// Display-only mapping — never rename the GENERATOR/AGENT backend values,
// only how they're labeled in the UI (Proposal Studio UX audit, 2026-10-03).
// StudioType and GeneratorMode share the same two values, so one map covers
// both ResearchProject- and StudioDocument-backed rows.
export const GENERATOR_MODE_LABELS: Record<GeneratorMode | StudioType, string> = {
  GENERATOR: 'Guided',
  AGENT: 'Autonomous',
}
