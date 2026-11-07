import type { DeepResearchReport, DeepResearchReportClaim } from '../api/deepResearch'
import { DEPTH_TIERS, type DepthId } from './deepResearchIntake'

// View helpers for the report and the running screen. Pure; nothing here writes or scores anything.

// ── run stepper ─────────────────────────────────────────────────────────────────────────────

export const RUN_STEPS = ['Plan', 'Search', 'Read', 'Write', 'Finish'] as const

/**
 * Which step of Plan → Search → Read → Write → Finish the run is in, from the server's own phase and message (the same
 * ones it shows as text). A finished run is past the last step.
 */
export function currentStep(progress: { phase: string; message: string }, finished: boolean): number {
  if (finished) return RUN_STEPS.length
  switch (progress.phase) {
    case 'Queued': case 'Scoping': case 'Planning': return 0
    case 'Summarising': return 3
    case 'Researching': return /^(reviewing|verifying|assessing)/i.test(progress.message) ? 2 : 1
    default: return 1
  }
}

export const stepState = (index: number, current: number): 'done' | 'active' | 'todo' =>
  index < current ? 'done' : index === current ? 'active' : 'todo'

/** "2:05" from a start time. */
export function elapsedLabel(startIso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(startIso).getTime()) / 1000))
  if (!Number.isFinite(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** What is left of the depth's usual time. Honest about running over rather than showing a negative. */
export function timeLeftLabel(depth: DepthId | string | null | undefined, startIso: string, now: number = Date.now()): string {
  const tier = DEPTH_TIERS[(depth as DepthId) ?? 'deep'] ?? DEPTH_TIERS.deep
  const left = tier.minutes * 60_000 - (now - new Date(startIso).getTime())
  if (!Number.isFinite(left)) return `about ${tier.minutes} min`
  if (left <= 30_000) return 'taking a little longer than usual'
  return `about ${Math.max(1, Math.ceil(left / 60_000))} min left`
}

// ── report ──────────────────────────────────────────────────────────────────────────────────

/** Source id → the number shown in the citation marker. */
export function citationNumbers(report: Pick<DeepResearchReport, 'references'>): Map<string, number> {
  return new Map(report.references.map(r => [r.sourceId, r.number]))
}

/** The markers for one claim, in order. A source with no reference entry is not shown (the server always sends one). */
export function claimMarkers(claim: DeepResearchReportClaim, numbers: Map<string, number>): { id: string; n: number }[] {
  return claim.sourceIds.flatMap(id => (numbers.has(id) ? [{ id, n: numbers.get(id)! }] : []))
}

/** True when a claim could be shown without a citation: the report must never render one. */
export const isUncited = (claim: DeepResearchReportClaim, numbers: Map<string, number>): boolean => claimMarkers(claim, numbers).length === 0

/** Every claim the report would show, with any that has no resolvable citation removed. */
export function citedOnly(claims: DeepResearchReportClaim[], numbers: Map<string, number>): DeepResearchReportClaim[] {
  return claims.filter(c => c.text.trim().length > 0 && !isUncited(c, numbers))
}

// ── source panel ────────────────────────────────────────────────────────────────────────────

const norm = (q: string) => q.toLowerCase().replace(/[‘’“”"'`]/g, '').replace(/[\s….]+/g, ' ').trim()

/**
 * Supporting quotes without the repeats: the same passage twice, or a shorter excerpt of a longer one that is also
 * listed, is shown once (the longer one). Order of first appearance is kept.
 */
export function dedupeQuotes(quotes: (string | null | undefined)[]): string[] {
  const all = quotes.filter((q): q is string => !!q && norm(q).length > 0)
  const normed = all.map(norm)
  const kept: string[] = []
  const seen = new Set<string>()
  all.forEach((q, i) => {
    const n = normed[i]
    const covered = normed.some((other, j) => j !== i && other.length > n.length && other.includes(n))
    if (covered || seen.has(n)) return
    seen.add(n)
    kept.push(q)
  })
  return kept
}

// ── source funnel ───────────────────────────────────────────────────────────────────────────

export interface FunnelRow { key: string; label: string; n: number; widthPct: number; nested: boolean }

/**
 * Found → accepted → of those, the ones that disagree. The last is a subset of the second, so it is drawn narrower
 * and labelled "of which", never as a third separate pool. Widths are relative to what was found.
 */
export function funnelRows(counts: { found: number; used: number }, against: number): FunnelRow[] {
  const used = Math.min(counts.used, counts.found)
  const disagree = Math.min(against, used)
  const width = (n: number) => (counts.found > 0 ? Math.max(n > 0 ? 3 : 0, Math.round((n / counts.found) * 100)) : 0)
  return [
    { key: 'found', label: 'Found', n: counts.found, widthPct: width(counts.found), nested: false },
    { key: 'used', label: 'Accepted as evidence', n: used, widthPct: width(used), nested: false },
    { key: 'against', label: 'of which disagree with you', n: disagree, widthPct: width(disagree), nested: true },
  ]
}
