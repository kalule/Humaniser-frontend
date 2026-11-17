/**
 * The one place a Deep Research / evidence-package value becomes words. Every enum the server sends
 * (session status, completion reason, question status, sufficiency, strength, polarity, verification,
 * geography, gap type, provider outcome) maps here, with a tone for its chip. Anything unmapped is
 * de-camel-cased rather than shown raw, so a new server value never reaches the screen as
 * "SearchesExhausted".
 */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export interface Label { text: string; tone: Tone }

export type LabelKind =
  | 'sessionStatus' | 'completionReason' | 'questionStatus' | 'sufficiency' | 'strength' | 'polarity'
  | 'verification' | 'geography' | 'gapType' | 'gapConfidence' | 'providerOutcome' | 'questionType'

const L = (text: string, tone: Tone = 'neutral'): Label => ({ text, tone })

const LABELS: Record<LabelKind, Record<string, Label>> = {
  sessionStatus: {
    Created: L('Queued', 'info'), Queued: L('Queued', 'info'), Running: L('Running…', 'info'),
    Completed: L('Complete', 'success'), Stopped: L('Stopped at its limit', 'warning'),
    BudgetExhausted: L('Stopped at its limit', 'warning'), Cancelled: L('Cancelled'),
    Failed: L('Failed', 'danger'), NeedsReview: L('Off-topic results', 'danger'),
  },
  completionReason: {
    EvidenceSufficient: L('Enough evidence found', 'success'),
    SearchesExhausted: L('Every search was tried; some questions still lack evidence', 'warning'),
    BudgetIterations: L('Stopped after its research rounds ran out', 'warning'),
    BudgetSearchQueries: L('Stopped at its search limit', 'warning'),
    BudgetSources: L('Stopped at its source limit', 'warning'),
    BudgetRuntime: L('Stopped at its time limit', 'warning'),
    BudgetLlmCalls: L('Stopped at its processing limit', 'warning'),
    BudgetTotalTokens: L('Stopped at its processing limit', 'warning'),
    BudgetEstimatedCost: L('Stopped at its processing limit', 'warning'),
    Cancelled: L('Cancelled before it finished'),
    Failed: L('Failed before it finished', 'danger'),
    OffTopicResults: L('Most searches returned papers about a different subject', 'danger'),
  },
  questionStatus: {
    Open: L('Not started'), Researching: L('Researching…', 'info'), Resolved: L('Answered', 'success'), Exhausted: L('No more searches to try', 'warning'),
  },
  sufficiency: {
    Sufficient: L('Well supported', 'success'), PartiallySufficient: L('Partly answered', 'warning'), Insufficient: L('Needs more evidence', 'danger'),
  },
  strength: {
    Strong: L('Strong evidence', 'success'), Moderate: L('Moderate evidence', 'success'), Conflicting: L('Conflicting evidence', 'warning'),
    Weak: L('Limited evidence', 'warning'), Insufficient: L('Not enough evidence', 'danger'),
  },
  polarity: {
    Supports: L('Supports', 'success'), Contradicts: L('Contradicts', 'warning'), Null: L('No effect found'), Background: L('Background'),
  },
  verification: {
    Verified: L('Verified', 'success'), Unverified: L('Not verified', 'warning'), Unverifiable: L("Can't be verified", 'warning'),
    MetadataMismatch: L("Details don't match the record", 'danger'), Retracted: L('Retracted', 'danger'), NotFound: L('Not found in the index', 'warning'),
  },
  geography: {
    Target: L('From your study region', 'success'), Regional: L('From a neighbouring region'), International: L('International'), Unknown: L('Region unclear'),
  },
  gapType: {
    Geographical: L('Geographical gap'), Population: L('Population gap'), Methodological: L('Methods gap'),
    Measurement: L('Measurement gap'), Contradictory: L('Conflicting findings'),
  },
  gapConfidence: { Low: L('Low confidence', 'warning'), Moderate: L('Moderate confidence', 'info') },
  providerOutcome: {
    Results: L('Results', 'success'), Empty: L('No results'), EmptyUnconfirmed: L('No results (unconfirmed)', 'warning'),
    ProviderUnavailable: L('Unavailable', 'danger'), RateLimited: L('Rate limited', 'warning'), Skipped: L('Skipped'), Cached: L('From an earlier search'),
  },
  questionType: {},
}

/** "SearchesExhausted" → "Searches exhausted"; leaves ordinary text alone. */
export function decamel(value: string): string {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export function label(kind: LabelKind, value: string | null | undefined): Label {
  if (!value) return L('Unknown')
  return LABELS[kind][value] ?? L(decamel(value))
}

export const labelText = (kind: LabelKind, value: string | null | undefined): string => label(kind, value).text

/** What to do next, for a session that did not get a full answer. Null when nothing is needed. */
export function nextStep(status: string, completionReason?: string | null): string | null {
  if (status === 'NeedsReview' || completionReason === 'OffTopicResults')
    return 'Retry the search for free, or rephrase the question with more specific terms.'
  if (status === 'Failed') return 'Resume it, or start it again from Deep Research.'
  if (status === 'Cancelled') return 'Continue it in Deep Research to work on the remaining questions.'
  if (status === 'Running' || status === 'Queued' || status === 'Created') return null
  if (completionReason && completionReason !== 'EvidenceSufficient')
    return 'Continue it in Deep Research to work on the unanswered questions, or narrow the question.'
  return null
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The server writes some reasons for engineers ("Needs 1 accepted source(s); has 0."). Saved packages
 * keep that wording, so it is rewritten here for every package, old and new.
 */
export function humaniseReason(reason: string): string {
  let m = /^Needs (\d+) accepted source\(s\); has (\d+)\.?$/.exec(reason.trim())
  if (m) {
    const [need, has] = [Number(m[1]), Number(m[2])]
    return `Needs ${plural(Math.max(need - has, 0), 'more source')} (has ${has})`
  }
  m = /^Needs (\d+) strong or moderate source\(s\); has (\d+)\.?$/.exec(reason.trim())
  if (m) {
    const [need, has] = [Number(m[1]), Number(m[2])]
    return `Needs ${plural(Math.max(need - has, 0), 'more strong or moderate source')} (has ${has})`
  }
  m = /^(\d+) source\(s\) (.*)$/.exec(reason.trim())
  if (m) {
    const n = Number(m[1])
    return `${plural(n, 'source')} ${n === 1 ? m[2].replace(/\bwere\b/g, 'was').replace(/\bare\b/g, 'is') : m[2]}`
  }
  return reason.replace(/source\(s\)/g, 'sources')
}

/** "16 Nov 2026" — the Research Library's one date format: day, short month, year, never ambiguous. */
export function formatLibraryDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`
}

/** "16 Nov 2026, 14:05" (24-hour, local time). */
export function formatLibraryDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${formatLibraryDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
