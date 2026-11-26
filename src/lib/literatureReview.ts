// Literature Review Studio (backend docs/OPEN_ITEMS.md #113): types that mirror api/v1/literature-reviews and the
// pure helpers the studio's steps share. Enum values travel as strings ("Thematic", "PotentiallyRelevant").

export type ReviewStatus = 'Scoping' | 'Gathering' | 'Screening' | 'Extracting' | 'Synthesising' | 'Outlining' | 'Drafting' | 'Reviewing' | 'Ready'

export interface ReviewCriteria { include: string[]; exclude: string[] }

export interface ReviewSummary {
  id: string; title: string; question: string; reviewType: string; status: ReviewStatus; currentStep: number
  sourceCount: number; progressPercent: number; createdAt: string; updatedAt: string
}

export interface Review extends ReviewSummary {
  academicLevel: string; discipline: string | null; citationStyle: string; targetWords: number
  yearFrom: number | null; yearTo: number | null; criteria: ReviewCriteria
  researchProjectId: string; literatureMatrixId: string | null; revision: number
}

export interface ReviewOptions { reviewTypes: string[]; academicLevels: string[]; citationStyles: string[]; minTargetWords: number; maxTargetWords: number }

/** Source gate (server flag LiteratureReviewStudio:SourceGate). enabled=false while it is off: show nothing. */
export interface SourceCheck {
  enabled: boolean; included: number; extracted: number; inThemes: number; counted: number; minimum: number; met: boolean; overridden: boolean
  message: string | null; minSourcesPerTheme: number; themes: ThemeCoverage[]; balance: SourceBalance | null
}
export interface ThemeCoverage { themeId: string; title: string; verified: boolean; evidenceSources: number; thin: boolean; overridden: boolean; suggestedQuery: string }
export type SourceKind = 'Empirical' | 'SystematicOrScoping' | 'NarrativeOrCommentary' | 'GuidelineOrPolicy' | 'Other'
export interface SourceBalance { counts: Record<SourceKind, number>; total: number; warning: string | null; kindBySource: Record<string, SourceKind> }
export interface Landmark { candidateId: string; title: string; authors: string; year: string | null; journal: string | null; citations: number; aiVerdict: string; manualDecision: string | null }

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  Empirical: 'Empirical studies', SystematicOrScoping: 'Systematic or scoping reviews', NarrativeOrCommentary: 'Narrative reviews or commentary',
  GuidelineOrPolicy: 'Guidelines or policy', Other: 'Other',
}

/** The gate's refusal codes (409) from drafting. */
export type GateRefusal = 'SOURCE_GATE' | 'THIN_THEMES'
export function gateRefusal(err: unknown): GateRefusal | null {
  const code = (err as { serverCode?: string } | null)?.serverCode
  return code === 'SOURCE_GATE' || code === 'THIN_THEMES' ? code : null
}

export interface ScopeAdvice { assessment: 'Clear' | 'Vague' | 'TooBroad' | 'TooNarrow'; issues: string[]; suggestedQuestions: string[]; keyConcepts: string[] }

export interface PoolSource { id: string; title: string; authors: string; year: number | null; journal: string | null; doi: string | null; evidenceLevel: 'FullText' | 'AbstractOnly' | 'MetadataOnly'; origin: 'Library' | 'Search'
  /** What drafting read (server flag LiteratureReviewStudio:EvidenceLevels); absent while the flag is off. */
  textLevel?: 'FullText' | 'AbstractOnly' | 'TitleOnly' | null }

export interface ImportResult { added: number; alreadyInPool: number; withoutAbstract: string[]; notFound: number }

export type ScreeningState = 'NotScreened' | 'Included' | 'AwaitingFullText' | 'PotentiallyRelevant' | 'NotRelevant' | 'Excluded' | 'UnableToAssess'

export interface ScreeningItem {
  candidateId: string; title: string; authors: string; year: string; journal: string; doi: string; abstract: string; foundVia: string[]
  state: ScreeningState; reasonCode: string | null; reasonLabel: string | null; explanation: string; studentNote: string | null
  relevanceScore: number; topicMatchScore: number; evidenceLevel: string; hasFullText: boolean; inPool: boolean
  /** The database this record came from; citations as that database reported them (0 when it gave none). */
  source: string; citations: number
  /** The AI's verdict and reason, kept even when the reviewer decided otherwise. */
  aiVerdict: AiVerdict; aiReason: string
  /** Approved into the review earlier and since taken out of it. */
  removedFromReview: boolean
}

export type AiVerdict = 'Pending' | 'Relevant' | 'Uncertain' | 'Excluded'

/**
 * stateCounts follow the search and filters (they label the tabs); overallCounts are the whole review. matchingIds lists every paper
 * in the current view across pages and is sent only while bulk screening is on.
 */
export interface ScreeningList {
  items: ScreeningItem[]; totalCount: number; page: number; pageSize: number; stateCounts: Record<ScreeningState, number>
  screeningStatus: string; screeningProgressPct: number; canApprove: boolean
  overallCounts: Record<ScreeningState, number>; databases: string[]; bulkScreening: boolean; matchingIds: string[] | null
}

export interface BulkResult { batchId: string | null; changed: number; unchanged: number; leftReview: number; returnedToReview: number }
export interface BulkUndoResult { restored: number; skipped: number }
/** One record set aside at screening. decidedBy is Student, AI or DateRange. */
export interface Exclusion { candidateId: string; title: string; year: string; doi: string; reasonCode: string | null; reason: string; decidedBy: 'Student' | 'AI' | 'DateRange' }

export interface Reason { code: string; label: string }
export interface ApproveResult { addedToPool: number; excludedForDateRange: number; poolSize: number; status: ReviewStatus }
export interface ProviderOutcome { id: string; name: string; state: 'NotSearched' | 'Results' | 'NoSearchResults' | 'ProviderUnavailable' | 'Searching'; count: number; message: string }

export interface Coverage {
  discoveryStatus: string; found: number; unique: number; duplicates: number; providers: ProviderOutcome[]; screeningStatus: string
  stateCounts: Record<ScreeningState, number>; excludedByReason: Record<string, number>; poolSize: number; poolFullText: number
  poolAbstractOnly: number; poolMetadataOnly: number; coverageStatus: string; dimensionsCoveredPct: number; uncoveredDimensions: string[]
  yearFrom: number | null; yearTo: number | null
}

export interface MatrixRunInfo { id: string; status: string; studiesTotal: number; studiesDone: number; studiesSkipped: number; studiesFailed: number; message: string | null; creditsPerStudy: number }

export interface Extraction {
  matrixId: string | null; matrixAvailable: boolean; poolSize: number; inMatrix: number; extracted: number; notLinked: number
  consentAccepted: boolean; creditsPerStudy: number; run: MatrixRunInfo | null
  /** Matrix rows of sources taken out of the review: kept, with their extracted values, but not shown. */
  hiddenStudyIds?: string[] | null
}

export type RunStatus = 'Queued' | 'Running' | 'Succeeded' | 'PartiallySucceeded' | 'Failed' | 'Cancelled'
export interface ReviewRun { id: string; kind: string; status: RunStatus; stage: string | null; done: number; total: number; errorCode: string | null; errorMessage: string | null; creditsCharged: number; startedAt: string; finishedAt: string | null }

export interface Evidence { source: string; field: string; quote: string }
export interface SynthesisPoint { id: string; kind: string; text: string; sourceIds: string[]; evidence: Evidence[]; verified: boolean; failureReason: string | null }
export interface ThemeSource { literatureId: string; title: string; authors: string; year: number | null; stance: string }
export interface Theme { id: string; title: string; summary: string | null; sortOrder: number; origin: 'Ai' | 'User'; verificationState: 'Unverified' | 'Verified' | 'Failed' | 'Stale'; failureReason: string | null; sources: ThemeSource[]; points: SynthesisPoint[] }

export interface Gap {
  id: string; themeId: string | null; gapType: string; explanation: string; justification: string | null; sourceIds: string[]; evidence: Evidence[]
  confidence: 'Low' | 'Medium' | 'High'; classification: 'ResearchGap' | 'CoverageLimit' | 'Rejected'; rejectionReason: string | null; status: 'Proposed' | 'Accepted' | 'Dismissed'
}

export interface OutlineSection { code: string | null; title: string; kind: string; purpose: string | null; themeIds: string[]; targetWords: number }
export interface Outline { sections: OutlineSection[]; totalWords: number }

export interface Section {
  code: string; title: string; kind: string; sortOrder: number; status: 'NotDrafted' | 'Drafted' | 'Edited' | 'Failed'; failureReason: string | null
  text: string; wordCount: number; targetWords: number; citedSourceIds: string[]; unknownCitations: string[]; draftedAt: string | null; editedAt: string | null
}

export interface Issue {
  id: string; sectionCode: string | null; severity: 'Blocking' | 'Warning'; code: string; message: string; claimText: string | null; sourceIds: string[]
  status: 'Open' | 'Repaired' | 'Dismissed' | 'Stale'; repairAttempts: number; canDismiss: boolean; dismissReason: string | null; createdAt: string
}
export interface Readiness { ready: boolean; blockingOpen: number; warningsOpen: number; notDrafted: string[]; notVerified: string[] }
export interface IssueList { issues: Issue[]; readiness: Readiness }

// ── Steps ───────────────────────────────────────────────────────────────────────────────────────────────

export const STEPS = [
  { id: 'scope', label: 'Scope', hint: 'Question and scope' },
  { id: 'sources', label: 'Sources', hint: 'Library, search, matrix' },
  { id: 'screen', label: 'Screen & extract', hint: 'Decide and extract' },
  { id: 'themes', label: 'Themes', hint: 'Synthesis and gaps' },
  { id: 'draft', label: 'Draft', hint: 'Write each section' },
  { id: 'review', label: 'Review & export', hint: 'Check and download' },
] as const
export type StepId = (typeof STEPS)[number]['id']

export function stepIndex(id: string | null | undefined): number {
  const i = STEPS.findIndex(s => s.id === id)
  return i < 0 ? 0 : i
}

/** The furthest step the review's status says has been reached (the student may always go back). */
export function reachedStep(status: ReviewStatus): number {
  switch (status) {
    case 'Scoping': return 0
    case 'Gathering': return 1
    case 'Screening': case 'Extracting': return 2
    case 'Synthesising': case 'Outlining': return 3
    case 'Drafting': return 4
    case 'Reviewing': case 'Ready': return 5
  }
}

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  Scoping: 'Scoping', Gathering: 'Gathering sources', Screening: 'Screening', Extracting: 'Extracting evidence',
  Synthesising: 'Finding themes', Outlining: 'Outlining', Drafting: 'Drafting', Reviewing: 'Checking', Ready: 'Ready to export',
}

export const REVIEW_TYPE_LABELS: Record<string, string> = {
  Narrative: 'Narrative', Thematic: 'Thematic', Scoping: 'Scoping', Critical: 'Critical', ThesisChapter: 'Thesis literature chapter',
}

export const REVIEW_TYPE_HINTS: Record<string, string> = {
  Narrative: 'A broad, readable overview of what is known.',
  Thematic: 'Organised around the themes the studies share.',
  Scoping: 'Maps what kinds of evidence exist and where it is thin.',
  Critical: 'Weighs the strength and limits of the evidence.',
  ThesisChapter: 'The literature chapter of a dissertation or thesis.',
}

export const LEVEL_LABELS: Record<string, string> = { Undergraduate: 'Undergraduate', Masters: 'Masters', Doctoral: 'Doctoral (PhD)' }

export const STYLE_LABELS: Record<string, string> = { apa7: 'APA 7', harvard: 'Harvard', ieee: 'IEEE', mla: 'MLA', chicago: 'Chicago', vancouver: 'Vancouver' }

export const SCREENING_STATES: { state: ScreeningState; label: string; tone: string }[] = [
  { state: 'PotentiallyRelevant', label: 'Potentially relevant', tone: 'bg-amber-50 text-amber-900 border-amber-300' },
  { state: 'UnableToAssess', label: 'Unable to assess', tone: 'bg-slate-100 text-slate-800 border-slate-300' },
  { state: 'AwaitingFullText', label: 'Awaiting full text', tone: 'bg-sky-50 text-sky-900 border-sky-300' },
  { state: 'Included', label: 'Included', tone: 'bg-green-50 text-green-900 border-green-300' },
  { state: 'NotScreened', label: 'Not screened', tone: 'bg-white text-slate-700 border-slate-300' },
  { state: 'NotRelevant', label: 'Not relevant', tone: 'bg-slate-50 text-slate-700 border-slate-300' },
  { state: 'Excluded', label: 'Excluded', tone: 'bg-red-50 text-red-900 border-red-300' },
]

export const stateLabel = (s: ScreeningState) => SCREENING_STATES.find(x => x.state === s)?.label ?? s

export const PROVIDER_LABELS: Record<ProviderOutcome['state'], string> = {
  NotSearched: 'Not searched', Results: 'Found papers', NoSearchResults: 'No matching papers', ProviderUnavailable: 'Results missing', Searching: 'Searching',
}

export const EVIDENCE_LABELS: Record<PoolSource['evidenceLevel'], string> = { FullText: 'Full text', AbstractOnly: 'Abstract only', MetadataOnly: 'Details only' }

/** Fewer sources than this triggers a soft warning: a review needs enough studies to compare. */
export const SOFT_MIN_SOURCES = 8

export const isRunActive = (run: { status: string } | null | undefined) => run?.status === 'Queued' || run?.status === 'Running'

// ── Citations in drafted text ───────────────────────────────────────────────────────────────────────────

export type TextPart = { kind: 'text'; text: string } | { kind: 'cite'; sourceId: string; narrative?: true } | { kind: 'unknown'; label: string }

/** {{cite:n:<id>}} is a narrative citation: the authors are the sentence's subject ("Kelly et al. (2019) report …"). */
const NARRATIVE = 'n:'

const TOKEN = /\{\{cite:([^}]+)\}\}/g

/** Splits drafted text into plain text and citation tokens, so the page can render and link each citation. */
export function splitCitations(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) parts.push({ kind: 'text', text: text.slice(last, m.index) })
    const value = m[1]
    parts.push(value.startsWith('unknown:') ? { kind: 'unknown', label: value.slice('unknown:'.length) }
      : value.startsWith(NARRATIVE) ? { kind: 'cite', sourceId: value.slice(NARRATIVE.length), narrative: true }
      : { kind: 'cite', sourceId: value })
    last = m.index! + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}

/**
 * Short author-year label for a source, as shown inline ("Nakato, 2019"; narrative "Nakato (2019)"). The surname is the first author's
 * last word, so a byline written "Christopher Kelly, Alan Karthikesalingam" shows "Kelly et al.", not "Christopher Kelly et al.".
 */
/** "J.", "MH", "MÁ" are initials; "Yu" or "Li" are names because they have a lower-case letter. */
function isInitials(s: string): boolean {
  const letters = [...s].filter((c) => /\p{L}/u.test(c))
  if (letters.length === 0) return true
  if (s.includes('.')) return letters.length <= 3 && s.replace(/[.\s]/g, '').length <= 3
  return letters.length <= 4 && letters.every((c) => c === c.toUpperCase() && c !== c.toLowerCase())
}

/** Surnames from "Smith, J., Jones, A." (Crossref), "Christopher Kelly, Alan Beam" (OpenAlex) or "Harbi MH, Xu G" (PubMed). Mirrors LitReviewNames on the server. */
export function surnames(authors: string | null | undefined): string[] {
  if (!authors?.trim()) return []
  const parts = (authors.includes(';') ? authors.split(';') : authors.split(',')).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (isInitials(part)) continue
    const comma = part.indexOf(',')
    if (comma > 0) { out.push(part.slice(0, comma).trim()); continue } // "Nakato, J." in a semicolon list
    const words = part.split(/\s+/).filter(Boolean)
    if (words.length === 1) out.push(words[0].replace(/\.+$/, ''))
    else if (isInitials(words[words.length - 1])) out.push(words.slice(0, -1).join(' '))
    else out.push(words[words.length - 1])
  }
  return out
}

export function shortCite(source: { authors: string; year: number | null } | undefined, narrative = false): string {
  if (!source) return 'source not in this review'
  const people = surnames(source.authors)
  const year = source.year ?? 'n.d.'
  const who = people.length === 0 ? 'Unknown' : people.length === 1 ? people[0] : people.length === 2 ? `${people[0]} and ${people[1]}` : `${people[0]} et al.`
  return narrative ? `${who} (${year})` : `${who}, ${year}`
}

/** One sentence for the export gate. */
export function readinessText(r: Readiness): string {
  if (r.ready) return r.warningsOpen > 0 ? `Ready to export. ${r.warningsOpen} warning${r.warningsOpen === 1 ? '' : 's'} to consider.` : 'Ready to export.'
  const parts: string[] = []
  if (r.notDrafted.length) parts.push(`${r.notDrafted.length} section${r.notDrafted.length === 1 ? '' : 's'} not written`)
  if (r.notVerified.length) parts.push(`${r.notVerified.length} section${r.notVerified.length === 1 ? '' : 's'} changed since the last check`)
  if (r.blockingOpen) parts.push(`${r.blockingOpen} blocking issue${r.blockingOpen === 1 ? '' : 's'}`)
  if (parts.length === 0) return 'Not ready to export: build the outline and draft the review first.'
  return `Not ready to export: ${parts.join(', ')}.`
}

/** The server writes its validation messages for the student; anything else gets a plain retry message. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = (err ?? {}) as { message?: string; response?: { status?: number } }
  if (e.response?.status === 429) return 'Too many requests in a short time. Wait a minute and try again.'
  return e.message && e.message.length < 400 && !/^Request failed|Network Error/i.test(e.message) ? e.message : fallback
}

export function cleanList(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = raw.replace(/\s+/g, ' ').trim()
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
  }
  return out
}

// ── Editing drafted text ────────────────────────────────────────────────────────────────────────────────

/**
 * Turns stored text into what the student edits: each citation becomes a numbered marker [@1], [@2] … in order of
 * first appearance, and the list of sources says which number is which. An unknown citation stays visible as [@?S9].
 */
export function toEditable(text: string): { editable: string; sources: string[] } {
  const sources: string[] = []
  const editable = text.replace(TOKEN, (_, value: string) => {
    if (value.startsWith('unknown:')) return `[@?${value.slice('unknown:'.length)}]`
    const narrative = value.startsWith(NARRATIVE)
    const id = narrative ? value.slice(NARRATIVE.length) : value
    let n = sources.indexOf(id)
    if (n < 0) { sources.push(id); n = sources.length - 1 }
    return narrative ? `[@n${n + 1}]` : `[@${n + 1}]`
  })
  return { editable, sources }
}

/**
 * Back from the edited text. A marker whose number is not in the list (a typo, or a number the student invented)
 * becomes an unknown citation, which verification then blocks rather than silently dropping.
 */
export function fromEditable(editable: string, sources: string[]): string {
  return editable.replace(/\[@(\?)?([^\]\s]+)\]/g, (_, unknown: string | undefined, value: string) => {
    if (unknown) return `{{cite:unknown:${value}}}`
    const narrative = /^n\d+$/.test(value)
    const n = Number(narrative ? value.slice(1) : value)
    return Number.isInteger(n) && n >= 1 && n <= sources.length ? `{{cite:${narrative ? NARRATIVE : ''}${sources[n - 1]}}}` : `{{cite:unknown:@${value}}}`
  })
}

// ── Hand-off to the editor ──────────────────────────────────────────────────────────────────────────────

const HANDOFF_PREFIX = 'literatureReview.studioHandOff.'

/** The checked review the editor applies once when it opens this document (same path as a generated review). */
export function saveStudioHandOff(documentId: string, payload: { result: unknown; citationStyle: string }): void {
  try { sessionStorage.setItem(HANDOFF_PREFIX + documentId, JSON.stringify(payload)) } catch { /* storage unavailable */ }
}

/** Reads and removes the hand-off for a document, so it is applied at most once. */
export function takeStudioHandOff<T>(documentId: string): { result: T; citationStyle: string } | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_PREFIX + documentId)
    if (!raw) return null
    sessionStorage.removeItem(HANDOFF_PREFIX + documentId)
    return JSON.parse(raw) as { result: T; citationStyle: string }
  } catch { return null }
}

/** One sentence on what adding sources did. */
export function importSummary(r: ImportResult): string {
  const parts = [`${r.added} added`]
  if (r.alreadyInPool) parts.push(`${r.alreadyInPool} already in the review`)
  if (r.notFound) parts.push(`${r.notFound} not found in your library`)
  let text = parts.join(', ') + '.'
  if (r.withoutAbstract.length) text += ` Left out because they hold details only, no abstract: ${r.withoutAbstract.join('; ')}.`
  return text
}
