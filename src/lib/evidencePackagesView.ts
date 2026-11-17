import type { DeepResearchSessionSummary, EvidenceQuestion, VerifiedEvidencePackage } from '../api/deepResearch'

export interface PackageRun { session: DeepResearchSessionSummary; runNumber: number }
export interface PackageGroup {
  key: string
  question: string
  projectId: string
  /** Oldest first; run numbers count up from 1. */
  runs: PackageRun[]
  latest: PackageRun
}

export const isInProgress = (s: Pick<DeepResearchSessionSummary, 'status' | 'isFinished'>): boolean =>
  !s.isFinished || s.status === 'Running' || s.status === 'Queued'

const normaliseQuestion = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/, '')

/**
 * Runs of the same question in the same project become one package with versions. Groups are
 * ordered by their latest run, newest first.
 */
export function groupPackages(sessions: DeepResearchSessionSummary[]): PackageGroup[] {
  const groups = new Map<string, DeepResearchSessionSummary[]>()
  for (const s of sessions) {
    const key = `${s.projectId}::${normaliseQuestion(s.researchQuestion)}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  return [...groups.entries()].map(([key, list]) => {
    const runs = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((session, i) => ({ session, runNumber: i + 1 }))
    const latest = runs[runs.length - 1]
    return { key, question: latest.session.researchQuestion, projectId: latest.session.projectId, runs, latest }
  }).sort((a, b) => b.latest.session.createdAt.localeCompare(a.latest.session.createdAt))
}

/** Answered = Sufficient; partly = PartiallySufficient. */
export function questionSummary(questions: Pick<EvidenceQuestion, 'sufficiency'>[]): { answered: number; partly: number; total: number } {
  return {
    answered: questions.filter(q => q.sufficiency === 'Sufficient').length,
    partly: questions.filter(q => q.sufficiency === 'PartiallySufficient').length,
    total: questions.length,
  }
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/, '')

/**
 * The scope details worth showing: topic only when it differs from the question, plus whatever else
 * was established. An empty list means the Scope block would only repeat the title.
 */
export function scopeDetails(evidence: Pick<VerifiedEvidencePackage, 'scope' | 'researchQuestion'>): { label: string; value: string }[] {
  const s = evidence.scope
  if (!s) return []
  const out: { label: string; value: string }[] = []
  if (s.topic && norm(s.topic) !== norm(evidence.researchQuestion)) out.push({ label: 'Topic', value: s.topic })
  if (s.relationship) out.push({ label: 'Relationship', value: s.relationship })
  if (s.academicField) out.push({ label: 'Field', value: s.academicField })
  if (s.population.length) out.push({ label: 'Population', value: s.population.join(', ') })
  if (s.geography.length) out.push({ label: 'Geography', value: s.geography.join(', ') })
  if (s.timePeriod) out.push({ label: 'Period', value: s.timePeriod })
  else if (s.minYear || s.maxYear) out.push({ label: 'Period', value: `${s.minYear ?? '…'}–${s.maxYear ?? 'now'}` })
  return out
}
