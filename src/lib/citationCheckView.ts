import type { CitationCard, CitationCheckReport, CitationCheckSummary, CitationVerdict } from '../types/citationCheck'

// Everything the Citation Checker page decides about WHAT TO SAY lives here, away from the JSX, so the wording rules can be tested:
//   - a source we could not find is "could not verify this source exists", never "fake" or "fabricated";
//   - "could not verify" is neutral: it is never counted against the writer, and the score ignores it;
//   - a value the server adds later falls back to a neutral label instead of breaking the page.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface Meta {
  label: string
  tone: Tone
  hint?: string
}

const NEUTRAL_UNKNOWN: Meta = { label: 'Unknown result', tone: 'neutral' }

// ── Verdicts, failure patterns, flags, resolution ────────────────────────────────────────────────

const VERDICTS: Record<string, Meta> = {
  Supported: { label: 'Supported', tone: 'success', hint: 'The source backs up what you wrote.' },
  PartiallySupported: { label: 'Partly supported', tone: 'warning', hint: 'Part of the claim is in the source; the rest goes further than it does.' },
  NotSupported: { label: 'Not supported', tone: 'danger', hint: 'The source does not say this.' },
  Contradicted: { label: 'Contradicted', tone: 'danger', hint: 'The source says something different from your claim.' },
  CannotVerify: { label: 'Could not verify', tone: 'neutral', hint: 'There was not enough to decide either way. This does not count against you.' },
}

export const verdictMeta = (verdict?: string | null): Meta => (verdict ? VERDICTS[verdict] : undefined) ?? NEUTRAL_UNKNOWN

const FAILURES: Record<string, { label: string; explanation: string }> = {
  OutcomePredictorInversion: { label: 'Cause and effect swapped', explanation: 'The source found one thing predicting the other. Your sentence has it the other way round.' },
  DesignTypeMismatch: { label: 'Study design does not support the claim', explanation: 'A study that only shows two things go together cannot show that one causes the other.' },
  HedgeInversion: { label: 'Certainty does not match', explanation: 'The source was cautious ("may", "suggests"), or your sentence is more cautious than a source that was definite.' },
  PopulationBleed: { label: 'Different group of people', explanation: 'The source studied a different population from the one your sentence is about.' },
  CrossDomainBleed: { label: 'Unrelated field', explanation: 'The source is about a different subject, even if it uses similar words.' },
}

/** Null when there is no named pattern: not every problem has one ("the source simply does not say this"). */
export const failureMeta = (failure?: string | null): { label: string; explanation: string } | null =>
  failure && failure !== 'None' ? (FAILURES[failure] ?? { label: failure, explanation: '' }) : null

const FLAGS: Record<string, Meta> = {
  OrphanCitation: { label: 'Not in your reference list', tone: 'warning', hint: 'This citation has no matching entry in your references.' },
  AmbiguousReference: { label: 'Matches more than one reference', tone: 'warning', hint: 'Add a year letter (2020a) or a second author so it can be told apart.' },
  NoReferenceList: { label: 'No reference list in your draft', tone: 'warning', hint: 'Add a "References" section so each citation can be matched to a paper.' },
  YearMismatch: { label: 'Year does not match your list', tone: 'warning', hint: 'Your reference list has this author, but with a different year. Check the year in your text or your list.' },
  SourceNotFound: { label: 'Source not found', tone: 'warning', hint: 'We could not find this source in the databases we search. It may still exist.' },
  MetadataMismatch: { label: 'Reference details differ', tone: 'info', hint: 'The work exists, but its year or authors differ from your reference.' },
  LookupFailed: { label: 'A lookup service did not answer', tone: 'neutral', hint: 'This is not a problem with your reference. Running the check again may help.' },
  ReferenceUnsearchable: { label: 'Reference too short to search', tone: 'warning', hint: 'Add the full title of the work to this reference, then check again.' },
  CheckFailed: { label: 'Error on our side', tone: 'neutral', hint: 'This citation could not be checked because of an error on our side. Running the check again may help.' },
}

/** Flags that say WHY a citation could not be checked; they replace the generic "could not check this source" chip. */
const REASON_FLAGS = ['LookupFailed', 'ReferenceUnsearchable', 'CheckFailed']

export const flagMeta = (flag: string): Meta => FLAGS[flag] ?? { label: flag, tone: 'neutral' }

const RESOLUTION: Record<string, Meta> = {
  Verified: { label: 'Source found', tone: 'success' },
  MetadataMismatch: { label: 'Source found, details differ', tone: 'info' },
  NotFound: { label: 'Could not verify this source exists', tone: 'warning' },
  Unchecked: { label: 'Could not check this source right now', tone: 'neutral' },
  Pending: { label: 'Not checked yet', tone: 'neutral' },
  None: { label: 'No reference entry', tone: 'neutral' },
  Locked: { label: 'Locked', tone: 'neutral' },
}

export const resolutionMeta = (state?: string | null): Meta => (state ? RESOLUTION[state] : undefined) ?? { label: 'Unknown', tone: 'neutral' }

/**
 * The resolution chip for a card, or null when a flag already says the same thing (a not-found source also carries a "Source not
 * found" flag; two chips for one fact is noise). What is left is the state no flag covers: a source we could not check right now.
 */
export function resolutionBadge(card: Pick<CitationCard, 'resolutionState' | 'flags'>): Meta | null {
  const { resolutionState: state, flags } = card
  if (state === 'Verified' || state === 'Pending' || state === 'Locked') return null
  if (flags.some(f => REASON_FLAGS.includes(f))) return null   // the reason flag says it better than "could not check right now"
  if (state === 'NotFound' && flags.includes('SourceNotFound')) return null
  if (state === 'MetadataMismatch' && flags.includes('MetadataMismatch')) return null
  if (state === 'None' && (flags.includes('OrphanCitation') || flags.includes('NoReferenceList') || flags.includes('YearMismatch') || flags.includes('AmbiguousReference'))) return null
  return resolutionMeta(state)
}

/**
 * A second line of explanation, or null when there is nothing to add. For a citation that could not be judged the server uses the
 * same sentence as both the reasoning and the note, so showing both would print it twice. For a judged citation a note matters only
 * when it explains an abstract-only limit.
 */
export function extraNote(v: Pick<CitationVerdict, 'note' | 'reasoning' | 'verdict' | 'evidenceLevel'>): string | null {
  const note = v.note?.trim()
  if (!note || note === v.reasoning?.trim()) return null
  if (v.verdict === 'CannotVerify') return note
  return v.evidenceLevel === 'AbstractOnly' ? note : null
}

export const evidenceLabel = (level?: string | null): string =>
  level === 'FullText' ? 'Checked against the full text' : level === 'AbstractOnly' ? 'Checked against the abstract only' : 'Source text'

/** Field names as the server sends them, in words. */
export const diffFieldLabel = (field: string): string =>
  ({ year: 'Year', authors: 'Authors', 'author order': 'Author order', doi: 'DOI' } as Record<string, string>)[field] ?? field

// ── Run state and progress ───────────────────────────────────────────────────────────────────────

export const isTerminal = (status?: string | null): boolean => status === 'Completed' || status === 'Failed'

const STAGES: Record<string, string> = {
  Queued: 'Waiting to start',
  Parsing: 'Reading your draft',
  Resolving: 'Finding your sources',
  Judging: 'Checking each citation',
  Done: 'Done',
  Failed: 'Stopped',
}

export const stageLabel = (stage?: string | null): string => (stage ? STAGES[stage] : undefined) ?? 'Working'

/** How many citations this run will actually check: a plan limit caps it. Locked citations are never checked, so they are not part of the progress. */
export function checkableTotal(r: Pick<CitationCheckReport, 'citationCount' | 'fullCheckLimit'>): number {
  return r.fullCheckLimit == null ? r.citationCount : Math.min(r.fullCheckLimit, r.citationCount)
}

export interface Progress {
  done: number
  total: number
  /** 0 to 1. */
  fraction: number
  /** True while no honest percentage exists yet (reading, finding sources). */
  indeterminate: boolean
  label: string
}

export function progress(r: CitationCheckReport): Progress {
  const total = checkableTotal(r)
  const done = Math.min(r.citationsDone, total)
  if (isTerminal(r.status)) return { done, total, fraction: 1, indeterminate: false, label: stageLabel(r.status === 'Failed' ? 'Failed' : 'Done') }

  const judging = r.stage === 'Judging'
  return {
    done, total,
    fraction: judging && total > 0 ? done / total : 0,
    indeterminate: !judging,
    label: judging ? `Checking each citation (${done} of ${total})` : stageLabel(r.stage),
  }
}

/** Shown when a check is still waiting to start after a while, so a stuck queue is not mistaken for a frozen page. */
export function queueNotice(status: string | undefined, elapsedMs: number): string | null {
  return status === 'Queued' && elapsedMs > 90_000
    ? 'This is taking longer than usual to start. It will still run, and you can leave this page and come back to it.'
    : null
}

// ── Cards, filters, headline ─────────────────────────────────────────────────────────────────────

export type CardFilter = 'all' | 'attention' | 'differs' | 'supported' | 'unverified' | 'locked'

const PROBLEM_VERDICTS = new Set(['PartiallySupported', 'NotSupported', 'Contradicted'])
const PROBLEM_FLAGS = new Set(['OrphanCitation', 'NoReferenceList', 'YearMismatch', 'AmbiguousReference', 'SourceNotFound', 'ReferenceUnsearchable'])

/** Something the writer should look at: a problem verdict, an unresolved or missing source, or reference details that differ. */
export function needsAttention(c: CitationCard): boolean {
  if (c.locked) return false
  return PROBLEM_VERDICTS.has(c.verdict?.verdict ?? '') || c.flags.some(f => PROBLEM_FLAGS.has(f)) || c.resolutionState === 'MetadataMismatch'
}

export function matchesFilter(c: CitationCard, filter: CardFilter): boolean {
  switch (filter) {
    case 'all': return true
    case 'locked': return c.locked
    case 'attention': return needsAttention(c)
    case 'differs': return !c.locked && c.metadataDiffs.length > 0
    case 'supported': return !c.locked && c.verdict?.verdict === 'Supported' && !needsAttention(c)
    case 'unverified': return !c.locked && c.verdict?.verdict === 'CannotVerify' && !needsAttention(c)
  }
}

/** Cards stay in document order: the writer fixes the draft top to bottom. */
export const filterCards = (cards: CitationCard[], filter: CardFilter): CitationCard[] => cards.filter(c => matchesFilter(c, filter))

export function filterCounts(cards: CitationCard[]): Record<CardFilter, number> {
  const count = (f: CardFilter) => filterCards(cards, f).length
  return { all: cards.length, attention: count('attention'), differs: count('differs'), supported: count('supported'), unverified: count('unverified'), locked: count('locked') }
}

export const FILTER_LABELS: Record<CardFilter, string> = {
  all: 'All', attention: 'Needs attention', differs: 'Reference details differ', supported: 'Supported', unverified: 'Could not verify', locked: 'Locked',
}

export interface SummaryChip { key: string; label: string; count: number; tone: Tone }

/** Zero counts are left out: a row of "0" chips is noise. */
export function summaryChips(s: CitationCheckSummary): SummaryChip[] {
  const all: SummaryChip[] = [
    { key: 'supported', label: 'Supported', count: s.supported, tone: 'success' },
    { key: 'partial', label: 'Partly supported', count: s.partiallySupported, tone: 'warning' },
    { key: 'notSupported', label: 'Not supported', count: s.notSupported, tone: 'danger' },
    { key: 'contradicted', label: 'Contradicted', count: s.contradicted, tone: 'danger' },
    { key: 'cannotVerify', label: 'Could not verify', count: s.cannotVerify, tone: 'neutral' },
    { key: 'locked', label: 'Locked', count: s.locked, tone: 'neutral' },
    { key: 'yearMismatch', label: 'Year to fix', count: s.yearMismatches ?? 0, tone: 'warning' },
    { key: 'overstated', label: 'Strongly worded', count: s.overstatedClaims ?? 0, tone: 'warning' },
  ]
  return all.filter(c => c.count > 0)
}

export const scoreTone = (score: number | null | undefined): Tone =>
  score == null ? 'neutral' : score >= 85 ? 'success' : score >= 60 ? 'warning' : 'danger'

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

export function headline(r: CitationCheckReport): string {
  if (r.status === 'Failed') return r.error || 'The check could not finish.'
  if (!isTerminal(r.status)) return progress(r).label
  if (r.citationCount === 0) return 'No in-text citations were found in your draft.'
  const s = r.summary
  if (s.integrityScore === null) return 'None of the citations could be judged. See each card for why.'
  return `${s.supported} of ${plural(s.checked, 'checked citation')} ${s.checked === 1 ? 'is' : 'are'} fully supported.`
}

export function attentionLine(cards: CitationCard[]): string | null {
  const n = filterCards(cards, 'attention').length
  return n === 0 ? null : `${plural(n, 'citation')} ${n === 1 ? 'needs' : 'need'} your attention.`
}

export function lockedNote(r: CitationCheckReport): string | null {
  if (r.summary.locked <= 0 || r.fullCheckLimit == null) return null
  return `${plural(r.summary.locked, 'more citation')} found but not checked: your plan checks the first ${r.fullCheckLimit} in each run.`
}

export const limitNote = (r: CitationCheckReport): string | null =>
  r.limitReached ? 'This check reached its size limit, so some citations were skipped. They are marked "Could not verify".' : null

export function retentionNote(deleteAfterIso: string, now: Date = new Date()): string {
  const days = Math.ceil((new Date(deleteAfterIso).getTime() - now.getTime()) / 86_400_000)
  if (!Number.isFinite(days)) return 'Your draft and results are deleted automatically after a set time.'
  if (days <= 0) return 'Your draft and results are due to be deleted.'
  return `Your draft and results are deleted automatically in ${plural(days, 'day')}. You can delete them now.`
}

// ── Input ────────────────────────────────────────────────────────────────────────────────────────

export const MIN_WORDS = 20

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length

export const canStart = (text: string): boolean => wordCount(text) >= MIN_WORDS

export const isDocx = (fileName: string): boolean => /\.docx$/i.test(fileName.trim())

export const isPdf = (fileName: string): boolean => /\.pdf$/i.test(fileName.trim())

/** A file the checker can read: Word or a text-based PDF. */
export const isCheckableFile = (fileName: string): boolean => isDocx(fileName) || isPdf(fileName)

/** Matches the server's PDF/Word limit, so an oversized file is refused before it is sent. */
export const MAX_FILE_BYTES = 25_000_000

/**
 * What to say in place of the document when its text cannot be shown. States only what the code does: while a check exists its
 * draft is held on the server, encrypted, and deleted automatically at the delete date (or sooner if the user deletes the check).
 */
export function draftUnavailableCopy(state: 'gone' | 'error', deleteAfterIso: string | null): { title: string; body: string } {
  const date = deleteAfterIso && Number.isFinite(new Date(deleteAfterIso).getTime())
    ? new Date(deleteAfterIso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const kept = date
    ? `Your draft is held on our server, encrypted, until ${date}, or until you delete this check.`
    : 'Your draft is held on our server, encrypted, for up to 30 days, or until you delete this check.'
  return state === 'error'
    ? { title: "We couldn't load your draft just now.", body: `${kept} Try again, or upload the file again to see highlights in the text.` }
    : { title: 'Your draft is no longer available.', body: 'It was deleted or could not be read, so it cannot be shown. Upload the file again to see highlights in the text.' }
}

/** Why a draft cannot be started yet, in words; null when it can. */
export function startHint(text: string): string | null {
  const words = wordCount(text)
  if (words === 0) return `Paste a draft with in-text citations and a reference list. Minimum ${MIN_WORDS} words.`
  return words < MIN_WORDS ? `Minimum ${MIN_WORDS} words required (${MIN_WORDS - words} more needed).` : null
}
