import type { GapCard, GapRun, GapType } from '../types/gapFinder'
import type { GapDossier } from '../types/proposalWorkflow'

// Research-platform W4.4: the gap dossier starts from the student's own Research Gap Finder result instead of a blank
// form. Only empty fields are filled, the student edits before assessing, and the evidence links stay the student's
// to choose (Gap Finder evidence is not a reviewed claim-passage binding).

const TYPE_LABELS: Record<GapType, string> = {
  insufficient: 'Insufficient evidence',
  unreliable_methods: 'Unreliable methods',
  conflicting: 'Conflicting findings',
  wrong_question: 'The question has not been asked this way',
}

const VERIFICATION_LABELS: Record<string, string> = {
  no_clear_answer_found: 'A follow-up search found no study that clearly answers it',
  partly_addressed: 'A follow-up search found studies that partly address it',
  narrowed: 'The gap was narrowed after a follow-up search',
  rejected: 'A follow-up search found it already answered',
  not_verified: 'The gap was not checked with a follow-up search',
}

/** The gap the student chose in their latest finished run, or that run's first card when none was chosen. */
export function pickGapCard(runs: GapRun[]): { run: GapRun; card: GapCard } | null {
  const done = runs.filter(r => r.status === 'completed' && r.cards.length > 0)
    .sort((a, b) => Date.parse(b.completedAt ?? b.createdAt) - Date.parse(a.completedAt ?? a.createdAt))
  const run = done.find(r => r.usedGapId) ?? done[0]
  if (!run) return null
  const card = run.cards.find(c => c.gapId === run.usedGapId) ?? run.cards[0]
  return { run, card }
}

export function dossierFromGap(run: GapRun, card: GapCard): Pick<GapDossier, 'gap' | 'type' | 'scope' | 'coverageLimitations' | 'counterEvidenceAssessment'> {
  const scope = run.scope
  const scopeParts = [
    scope?.concepts.length ? `Concepts: ${scope.concepts.join(', ')}` : '',
    scope?.population ? `Population: ${scope.population}` : '',
    scope?.location ? `Location: ${scope.location}` : '',
  ].filter(Boolean)
  const c = card.coverage
  const coverage = [
    `Screened ${c.papersScreened} papers and used ${c.papersUsed}; ${c.abstractsOnly} read from the abstract only and ${c.fullTexts} in full.`,
    c.sources.length ? `Sources: ${c.sources.join(', ')}.` : '',
    c.searchDate ? `Searched on ${c.searchDate.slice(0, 10)}.` : '',
    c.notReviewed.length ? `Not reviewed: ${c.notReviewed.join('; ')}.` : '',
    ...c.notes,
  ].filter(Boolean).join(' ')
  const v = card.verification
  const closest = v.closestWorks.length ? ` Closest work found: ${v.closestWorks.length} ${v.closestWorks.length === 1 ? 'study' : 'studies'}.` : ''
  return {
    gap: card.statement.trim(),
    type: TYPE_LABELS[card.type] ?? card.type,
    scope: scopeParts.join('. '),
    coverageLimitations: coverage,
    counterEvidenceAssessment: `${VERIFICATION_LABELS[v.status] ?? v.status} (${v.hitsJudged} results judged).${closest}`,
  }
}

/** Fills only the fields the student has not written yet. */
export function fillEmpty(current: GapDossier, from: Partial<GapDossier>): GapDossier {
  const next = { ...current }
  for (const key of ['gap', 'type', 'scope', 'coverageLimitations', 'counterEvidenceAssessment'] as const) {
    const value = from[key]
    if (typeof value === 'string' && value.trim() && !next[key].trim()) next[key] = value
  }
  return next
}
