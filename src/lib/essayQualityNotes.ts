import type { WorkbenchReviewFlag } from '../types/workbench'

/**
 * Warn-only essay-quality findings (backend EssayQualityWarnings.Codes: structure, evidence fit, claim support, references).
 * Each used to become its own toast; an essay can raise ten of them, so they are summarised in one. Keep in step with the backend list.
 */
export const ESSAY_QUALITY_CATEGORIES: Record<string, 'structure' | 'evidence fit' | 'claim support' | 'references'> = {
  EssayThesisMissing: 'structure',
  EssayRoadmapMissing: 'structure',
  EssayConclusionWeak: 'structure',
  EssaySectionOverlap: 'structure',
  EssayStockCloser: 'structure',
  EssayNoDirectEvidence: 'evidence fit',
  EssayIndirectShare: 'evidence fit',
  EssayContextQualifierMissing: 'evidence fit',
  EssayPopulationQualifierMissing: 'evidence fit',
  EssaySourceDensityLow: 'evidence fit',
  EssayTheoryUncited: 'claim support',
  EssayTheoryAttribution: 'claim support',
  EssayUnsupportedConnectingClaim: 'claim support',
  EssayInferenceUngrounded: 'claim support',
  ReferenceContainerMissing: 'references',
  ReferenceYearMismatch: 'references',
}

export function isEssayQualityNote(flag: WorkbenchReviewFlag): boolean {
  return Object.prototype.hasOwnProperty.call(ESSAY_QUALITY_CATEGORIES, flag.code)
}

/** One line for all quality notes, or null when there are none: counts by category, then the first note in full. */
export function essayQualitySummary(flags: WorkbenchReviewFlag[] | undefined): string | null {
  const notes = (flags ?? []).filter(isEssayQualityNote)
  if (notes.length === 0) return null
  const counts = new Map<string, number>()
  for (const note of notes) {
    const category = ESSAY_QUALITY_CATEGORIES[note.code]
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  const parts = [...counts.entries()].map(([category, count]) => `${count} ${category}`)
  return `Review notes (${parts.join(', ')}). First: ${notes[0].message}`
}
