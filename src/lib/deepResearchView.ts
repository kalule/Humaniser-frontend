import type { DeepResearchMode, DeepResearchSession, EvidenceQuestion, EvidenceSource } from '../api/deepResearch'

// View-model for the Deep Research results page. Everything here is derived from fields the server already
// stores and returns; nothing is generated, guessed or scored on the client. Where a label could imply more than
// the code established (a verified DOI is not a relevant paper), the wording says exactly what was checked.

// ── sources: one card per source ─────────────────────────────────────────────────────────────

/** One link between a source and an evidence question: the server returns one row per link. */
export interface SourceLink {
  questionId: string
  polarity: string
  strength: string
  decision: EvidenceSource['decision']
  exclusionReason: string | null
  quote: string | null
}

export type SourceBucket = 'used' | 'excluded' | 'unassessed'

export interface SourceGroup {
  id: string
  title: string
  authors: string[]
  year: number | null
  journal: string | null
  doi: string | null
  verification: string
  geography: string
  decidedBy: EvidenceSource['decidedBy']
  coverage: 'Abstract' | 'FullText'
  studyDesign: string | null
  links: SourceLink[]
  bucket: SourceBucket
  exclusionReason: string | null
  /** Ids of other records of the same paper that were merged into this one. */
  aliases?: string[]
}

/**
 * Merges the per-question rows of one source into a single entry. A source linked to two questions used to be
 * listed twice ("Sources (7)" for five papers). The source is "used" if it is accepted for at least one question.
 */
export function mergeSourceRows(rows: EvidenceSource[]): SourceGroup[] {
  const byId = new Map<string, SourceGroup>()
  for (const r of rows) {
    const link: SourceLink = {
      questionId: r.questionId, polarity: r.polarity, strength: r.strength,
      decision: r.decision, exclusionReason: r.exclusionReason, quote: r.quote,
    }
    const existing = byId.get(r.id)
    if (existing) {
      existing.links.push(link)
      // Prefer a known region over "Unknown"; the tier belongs to the source's scope, not to one question.
      if (existing.geography === 'Unknown' && r.geography !== 'Unknown') existing.geography = r.geography
      if (r.decidedBy === 'You') existing.decidedBy = 'You'
      if (r.coverage === 'FullText' && r.decision === 'Accepted') { existing.coverage = 'FullText'; existing.studyDesign ??= r.studyDesign ?? null }
    } else {
      byId.set(r.id, {
        id: r.id, title: r.title, authors: r.authors, year: r.year, journal: r.journal, doi: r.doi,
        verification: r.verification, geography: r.geography, decidedBy: r.decidedBy,
        coverage: r.coverage === 'FullText' && r.decision === 'Accepted' ? 'FullText' : 'Abstract',
        studyDesign: r.coverage === 'FullText' && r.decision === 'Accepted' ? (r.studyDesign ?? null) : null,
        links: [link], bucket: 'unassessed', exclusionReason: null,
      })
    }
  }
  for (const g of byId.values()) {
    const accepted = g.links.some(l => l.decision === 'Accepted')
    const rejected = g.links.filter(l => l.decision === 'Rejected')
    g.bucket = accepted ? 'used' : rejected.length > 0 ? 'excluded' : 'unassessed'
    g.exclusionReason = g.bucket === 'excluded' ? (rejected.find(l => l.exclusionReason)?.exclusionReason ?? null) : null
  }
  return [...byId.values()]
}

export const bySourceYearDesc = (a: SourceGroup, b: SourceGroup): number => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title)

export interface SourceCounts { found: number; used: number; excluded: number; unassessed: number }

export function countSources(groups: SourceGroup[]): SourceCounts {
  return {
    found: groups.length,
    used: groups.filter(g => g.bucket === 'used').length,
    excluded: groups.filter(g => g.bucket === 'excluded').length,
    unassessed: groups.filter(g => g.bucket === 'unassessed').length,
  }
}

export type SourceFilter = 'used' | 'excluded' | { questionId: string }

/** The links of a source that matter for a filter: accepted ones when looking at a question. */
export function applyFilter(groups: SourceGroup[], filter: SourceFilter): SourceGroup[] {
  if (filter === 'used') return groups.filter(g => g.bucket === 'used')
  if (filter === 'excluded') return groups.filter(g => g.bucket !== 'used')
  return groups.filter(g => g.links.some(l => l.questionId === filter.questionId && l.decision === 'Accepted'))
}

// ── labels that say what was actually checked ────────────────────────────────────────────────

export interface Chip { label: string; tone: 'neutral' | 'warning' | 'danger'; hint: string }

/**
 * What the "Verified" status really established: the DOI resolves to a record whose title and year match and which
 * is not retracted. It says the paper exists. It says nothing about whether it answers the question.
 */
export function citationCheckChip(status: string): Chip {
  switch (status) {
    case 'Verified':
      return { label: 'DOI matched', tone: 'neutral', hint: 'The DOI resolves to a record with the same title and year, and it is not flagged as retracted. This shows the paper exists, not that it answers your question.' }
    case 'Retracted':
      return { label: 'Retracted', tone: 'danger', hint: 'The record is flagged as retracted, so it cannot be used as evidence.' }
    case 'MetadataMismatch':
      return { label: 'DOI does not match', tone: 'warning', hint: 'The DOI points to a record with a different title or year.' }
    case 'NotFound':
      return { label: 'DOI not found', tone: 'warning', hint: 'The DOI was not found in the verification index.' }
    case 'Unverifiable':
      return { label: 'Could not check', tone: 'warning', hint: 'There is no DOI, or it is not in the verification index, so the record could not be checked.' }
    default:
      return { label: 'Not checked', tone: 'neutral', hint: 'This source has not been checked yet.' }
  }
}

const DESIGN_LABELS: Record<string, string> = {
  SystematicReview: 'systematic review', Experimental: 'experiment', QuasiExperimental: 'quasi-experiment', Longitudinal: 'longitudinal study',
  CrossSectional: 'cross-sectional study', Qualitative: 'qualitative study', CaseStudy: 'case study', Opinion: 'opinion piece',
}

/**
 * What the agent read to judge the source. An abstract cannot show a study's design or sample, so strength from an
 * abstract is capped and says so; a full-text read shows the design it found.
 */
export function coverageChip(coverage: 'Abstract' | 'FullText', studyDesign: string | null): Chip {
  if (coverage === 'FullText') {
    const design = studyDesign ? DESIGN_LABELS[studyDesign] : undefined
    return {
      label: design ? `Full text · ${design}` : 'Full text read',
      tone: 'neutral',
      hint: 'The agent read the open-access full text of this paper, and the quote shown was checked against it.',
    }
  }
  return {
    label: 'Abstract only',
    tone: 'warning',
    hint: 'Judged from the abstract alone: no open-access full text was available, so the study design and sample were not seen and strength is capped at Moderate.',
  }
}

const REGION_LABELS: Record<string, string> = {
  Target: 'Your study region',
  Regional: 'Neighbouring region',
  International: 'International',
}

/** A region chip only when the region is actually known; "Unknown" is not worth a chip on every card. */
export function regionLabel(geography: string): string | null {
  return REGION_LABELS[geography] ?? null
}

export function shortQuestion(text: string, max = 52): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

/** "Supports: How is usability defined…" / "Background" — the relationship to one specific question. */
export function relationshipLabel(link: Pick<SourceLink, 'polarity' | 'questionId'>, questions: Pick<EvidenceQuestion, 'id' | 'question'>[]): { label: string; hint: string } {
  const q = questions.find(x => x.id === link.questionId)
  const target = q ? shortQuestion(q.question) : null
  switch (link.polarity) {
    case 'Supports':
      return { label: target ? `Supports: ${target}` : 'Supports', hint: 'The reviewer judged this source as supporting this question.' }
    case 'Contradicts':
      return { label: target ? `Disagrees: ${target}` : 'Disagrees', hint: 'The reviewer judged this source as disagreeing on this question.' }
    case 'Null':
      return { label: target ? `No effect found: ${target}` : 'No effect found', hint: 'The source looked at this question and reported no effect.' }
    default:
      return { label: target ? `Background for: ${target}` : 'Background', hint: 'Useful context for this question, not direct evidence.' }
  }
}

// ── questions ────────────────────────────────────────────────────────────────────────────────

export interface QuestionRow {
  question: EvidenceQuestion
  /** Sources accepted for this question. */
  used: SourceGroup[]
  /** Every source that was linked to it, accepted or not. */
  linked: number
  state: 'not-searched' | 'no-sources' | 'none-relevant' | 'needs-more' | 'partly' | 'supported'
  label: string
}

/**
 * Separates "never searched" from "searched, found nothing" from "found some but not enough". Derived only from the
 * question's own status and the real link counts: a question whose status is still Open was never worked on.
 */
export function questionRows(questions: EvidenceQuestion[], groups: SourceGroup[]): QuestionRow[] {
  return questions.map(question => {
    const links = groups.flatMap(g => g.links.filter(l => l.questionId === question.id).map(l => ({ g, l })))
    const used = groups.filter(g => g.links.some(l => l.questionId === question.id && l.decision === 'Accepted')).sort(bySourceYearDesc)
    const linked = new Set(links.map(x => x.g.id)).size
    let state: QuestionRow['state']
    let label: string
    if (question.sufficiency === 'Sufficient') { state = 'supported'; label = 'Well supported' }
    else if (question.sufficiency === 'PartiallySufficient') { state = 'partly'; label = 'Partly answered' }
    else if (question.status === 'Open' && linked === 0) { state = 'not-searched'; label = 'Not searched yet' }
    else if (linked === 0) { state = 'no-sources'; label = 'No sources found' }
    else if (used.length === 0) { state = 'none-relevant'; label = 'Found, none relevant' }
    else { state = 'needs-more'; label = 'Needs more evidence' }
    return { question, used, linked, state, label }
  })
}

export function answeredCount(questions: Pick<EvidenceQuestion, 'sufficiency'>[]): number {
  return questions.filter(q => q.sufficiency === 'Sufficient').length
}

// ── status banner and next step ──────────────────────────────────────────────────────────────

export interface StatusBanner {
  tone: 'success' | 'warning' | 'danger' | 'info'
  title: string
  detail: string | null
  role: 'status' | 'alert'
}

/**
 * The banner states only what is known. The server's completion note is shown as written; the specific limit that
 * was reached is not part of the session response, so it is never guessed here.
 */
export function statusBanner(session: Pick<DeepResearchSession, 'status' | 'completionNote' | 'isFinished'>, answered: number, total: number): StatusBanner {
  const progress = total > 0 ? `${answered} of ${total} questions answered.` : null
  const detail = [session.completionNote, progress].filter(Boolean).join(' ') || null
  switch (session.status) {
    case 'Completed':
      return { tone: 'success', title: 'Research complete', detail, role: 'status' }
    case 'Stopped':
      return { tone: 'warning', title: 'Research stopped before every question was answered', detail, role: 'status' }
    case 'Cancelled':
      return { tone: 'info', title: 'You stopped this research', detail, role: 'status' }
    case 'Failed':
      return { tone: 'danger', title: 'Research could not finish', detail, role: 'alert' }
    default:
      return { tone: 'info', title: 'Research in progress', detail, role: 'status' }
  }
}

export interface Prefill {
  projectId: string
  question: string
  mode: DeepResearchMode
  geography: string
  /** Questions this session did not answer: what a follow-up run would still need to cover. */
  unanswered: string[]
}

export function prefillFrom(session: Pick<DeepResearchSession, 'projectId' | 'researchQuestion' | 'mode' | 'result'>, geography = ''): Prefill {
  return {
    projectId: session.projectId,
    question: session.researchQuestion,
    mode: session.mode as DeepResearchMode,
    geography,
    unanswered: (session.result?.questions ?? []).filter(q => q.sufficiency !== 'Sufficient').map(q => q.question),
  }
}

/** Sessions that stopped or failed should offer a follow-up run; finished-successfully ones do not need one. */
export const needsFollowUp = (status: string): boolean => status === 'Stopped' || status === 'Failed' || status === 'Cancelled'

// ── the results screen: status, segments, checks ─────────────────────────────────────────────

export function sessionStatusChip(status: string): { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' } {
  switch (status) {
    case 'Completed': return { label: 'Complete', tone: 'success' }
    case 'Stopped': return { label: 'Stopped at limit', tone: 'warning' }
    case 'Cancelled': return { label: 'Stopped by you', tone: 'neutral' }
    case 'Failed': return { label: 'Could not finish', tone: 'danger' }
    default: return { label: 'Running', tone: 'neutral' }
  }
}

/** One segment per question: answered, started but not enough, or not reached. */
export function questionSegments(questions: Pick<EvidenceQuestion, 'sufficiency' | 'status'>[]): ('done' | 'partial' | 'pending')[] {
  return questions.map(q => q.sufficiency === 'Sufficient' ? 'done'
    : q.sufficiency === 'PartiallySufficient' || q.status === 'Researching' || q.status === 'Exhausted' ? 'partial' : 'pending')
}

/** Sources accepted as evidence that disagree with the question (or found no effect). */
export function evidenceAgainst(groups: SourceGroup[]): SourceGroup[] {
  return groups
    .filter(g => g.links.some(l => l.decision === 'Accepted' && (l.polarity === 'Contradicts' || l.polarity === 'Null')))
    .sort(bySourceYearDesc)
}

export interface VerificationCheck { state: 'ok' | 'warn' | 'fail' | 'none'; label: string; detail: string }

/**
 * The checks shown beside a source, built only from what was really established. A verified record means the DOI
 * resolved, the title and year matched, and it is not flagged retracted; a quote means it was found in the text that was
 * read (the abstract, or the full paper when that was read). Nothing is ticked that was not checked.
 */
export function verificationChecks(verification: string, hasQuote: boolean, coverage: 'Abstract' | 'FullText'): VerificationCheck[] {
  const checks: VerificationCheck[] = []
  switch (verification) {
    case 'Verified':
      checks.push(
        { state: 'ok', label: 'DOI resolves', detail: 'The DOI leads to a record in the scholarly index.' },
        { state: 'ok', label: 'Metadata matches', detail: 'Title and year agree with the DOI record.' },
        { state: 'ok', label: 'Not retracted', detail: 'No retraction notice on the record.' },
      )
      break
    case 'Retracted': checks.push({ state: 'fail', label: 'Retracted', detail: 'The record is flagged as retracted, so it cannot count as evidence.' }); break
    case 'MetadataMismatch': checks.push({ state: 'fail', label: 'DOI does not match', detail: 'The DOI points to a record with a different title or year.' }); break
    case 'NotFound': checks.push({ state: 'fail', label: 'DOI not found', detail: 'The DOI was not found in the verification index.' }); break
    case 'Unverifiable': checks.push({ state: 'warn', label: 'Could not check the record', detail: 'There is no DOI, or it is not in the verification index.' }); break
    default: checks.push({ state: 'none', label: 'Not checked yet', detail: 'This source has not been checked.' })
  }
  checks.push(hasQuote
    ? { state: 'ok', label: `Quote found in the ${coverage === 'FullText' ? 'paper' : 'abstract'}`, detail: `The sentence below appears word for word in the ${coverage === 'FullText' ? 'full text' : 'abstract'} that was read.` }
    : { state: 'none', label: 'No supporting sentence kept', detail: 'No sentence from the source was kept for this question.' })
  return checks
}

// ── honest labels: how well a question is supported, and whether the run is really "complete" ──────────────────

export type RatingTone = 'success' | 'warning' | 'neutral'
export interface QuestionRating {
  label: string
  tone: RatingTone
  /** 0 = nothing usable, 1 = Limited, 2 = Some support, 3 = Well supported. */
  rank: 0 | 1 | 2 | 3
  /** A short visible note on what holds the label back; null when nothing does. */
  cap: string | null
  /** The full reason, for the tooltip. */
  reason: string
}

const isStrongEnough = (s: string) => s === 'Strong' || s === 'Moderate'

/**
 * The label for one question, from what was actually accepted for it: how many sources, how good each is rated, and
 * whether any was read in full. The research rules decide when to STOP searching (a question can be "sufficient" with
 * two abstract-only sources); this decides how much to CLAIM. Well supported needs at least three accepted sources, two
 * of them rated Moderate or better, one read in full text, and the research rules' own agreement. Anything abstract-only
 * or rated Limited can never reach it.
 */
export function rateQuestion(row: QuestionRow): QuestionRating {
  const n = row.used.length
  if (n === 0) {
    const why: Record<QuestionRow['state'], string> = {
      'not-searched': 'This question was planned but the research stopped before it was reached.',
      'no-sources': 'Searches for this question returned nothing usable.',
      'none-relevant': 'Sources were found, but none was accepted as evidence for this question.',
      'needs-more': 'No source has been accepted yet.',
      partly: 'No source has been accepted yet.',
      supported: 'No source has been accepted yet.',
    }
    const label: Record<QuestionRow['state'], string> = {
      'not-searched': 'Not searched yet', 'no-sources': 'No sources found', 'none-relevant': 'Found, none relevant',
      'needs-more': 'No accepted sources', partly: 'No accepted sources', supported: 'No accepted sources',
    }
    return { label: label[row.state], tone: 'neutral', rank: 0, cap: null, reason: why[row.state] }
  }
  const accepted = row.used.map(g => ({ g, link: g.links.find(l => l.questionId === row.question.id && l.decision === 'Accepted') }))
  const strong = accepted.filter(x => x.link && isStrongEnough(x.link.strength)).length
  const full = accepted.filter(x => x.g.coverage === 'FullText').length

  let rank: 1 | 2 | 3 = n >= 3 && strong >= 2 && full >= 1 ? 3 : strong >= 1 ? 2 : 1
  const server = row.question.sufficiency === 'Sufficient'
  if (rank === 3 && !server) rank = 2

  const causes: string[] = []
  if (n < 3) causes.push(`only ${n} accepted source${n === 1 ? '' : 's'} (3 needed)`)
  if (strong < 2) causes.push(strong === 0 ? 'none rated better than Limited evidence' : 'only one rated Moderate or better (2 needed)')
  if (full === 0) causes.push('all abstract-only, so study design and sample were not seen')
  if (!server) causes.push('the research rules still list it as needing more evidence')
  const label = rank === 3 ? 'Well supported' : rank === 2 ? 'Some support' : 'Limited'
  const cap = rank === 3 ? null : full === 0 ? 'Abstract-only sources' : strong === 0 ? 'Sources rated Limited' : n < 3 ? `Only ${n} source${n === 1 ? '' : 's'}` : 'Needs more evidence'
  const reason = rank === 3
    ? `${n} accepted sources, ${strong} rated Moderate or better, ${full} read in full text.`
    : `Not "Well supported" because ${causes.join('; ')}.`
  return { label, tone: rank === 3 ? 'success' : rank === 2 ? 'warning' : 'neutral', rank, cap, reason }
}

/** "Answered" means well supported, so the headline count and the labels can never disagree. */
export const answeredFromRatings = (ratings: QuestionRating[]): number => ratings.filter(r => r.rank === 3).length

export function segmentsFromRatings(ratings: QuestionRating[], questions: Pick<EvidenceQuestion, 'status'>[]): ('done' | 'partial' | 'pending')[] {
  return ratings.map((r, i) => r.rank === 3 ? 'done' : r.rank > 0 || questions[i]?.status === 'Researching' || questions[i]?.status === 'Exhausted' ? 'partial' : 'pending')
}

export interface CompletionSummary {
  chip: { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }
  headline: string
  /** Null when there is nothing honest to add. Never claims every question has enough evidence unless all do. */
  note: string | null
}

export function completionSummary(
  session: Pick<DeepResearchSession, 'status' | 'completionNote' | 'isFinished'>, answered: number, total: number,
): CompletionSummary {
  const gaps = Math.max(0, total - answered)
  const chip = sessionStatusChip(session.status)
  const claimsAllAnswered = (session.completionNote ?? '').toLowerCase().includes('every key question has enough evidence')
  if (session.status === 'Completed' && total > 0) {
    if (gaps > 0) {
      return {
        chip: { label: 'Completed with gaps', tone: 'warning' },
        headline: `${answered} of ${total} answered, ${gaps} ${gaps === 1 ? 'has a gap' : 'have gaps'}`,
        note: 'The research finished, but the questions without strong support are listed under Gaps in the report.',
      }
    }
    return { chip, headline: `All ${total} questions answered`, note: session.completionNote }
  }
  return {
    chip,
    headline: total > 0 ? `${answered} of ${total} questions answered` : statusBanner(session, answered, total).title,
    note: claimsAllAnswered && gaps > 0 ? null : session.completionNote,
  }
}

// ── findings: tidy text, Q-tags, and a visible reason for every flag ───────────────────────────────────────────

/** Removes separators left at either end of a piece of text ("· Target", "Limited evidence ·"). */
export const stripSeparators = (s: string | null | undefined): string => (s ?? '').replace(/^[\s·•|:;,–—-]+|[\s·•|:;,–—-]+$/g, '').trim()

/** "Moderate evidence · Your study region", with nothing dangling when a part is empty. */
export const joinMeta = (...parts: (string | null | undefined)[]): string => parts.map(stripSeparators).filter(Boolean).join(' · ')

const typeWord = (t: string) => t.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, c => c.toUpperCase())

/** "Q3 · Relationship": which question, without repeating its whole text. The full question is the hint. */
export function questionTag(questionId: string, questions: Pick<EvidenceQuestion, 'id' | 'type' | 'question'>[]): { label: string; hint: string } | null {
  const i = questions.findIndex(q => q.id === questionId)
  if (i < 0) return null
  return { label: `Q${i + 1} · ${typeWord(questions[i].type)}`, hint: questions[i].question }
}

/** How a source relates to a question, by number and kind rather than by repeating the question. */
export function relationshipTag(link: Pick<SourceLink, 'polarity' | 'questionId'>, questions: Pick<EvidenceQuestion, 'id' | 'type' | 'question'>[]): { label: string; hint: string } {
  const verb = link.polarity === 'Supports' ? 'Supports' : link.polarity === 'Contradicts' ? 'Disagrees on' : link.polarity === 'Null' ? 'No effect found for' : 'Background for'
  const tag = questionTag(link.questionId, questions)
  return { label: tag ? `${verb} ${tag.label}` : verb, hint: tag?.hint ?? '' }
}

/**
 * Why a caveat is flagged, in two or three words, or null when the text gives no recognisable reason. A caveat with no
 * reason is shown plain: colour is only used where it can be explained.
 */
export function caveatReason(text: string): { tag: string } | null {
  if (/\b(region|geograph\w*|outside|other countr\w*|international|not from|target (region|area|population))\b/i.test(text)) return { tag: 'Region mismatch' }
  if (/\b(conflict\w*|disagree\w*|contradict\w*|mixed (results|findings))\b/i.test(text)) return { tag: 'Conflicting' }
  if (/\b(single|one study|only one|few |small|limited|weak|abstract|preliminary|low[- ]quality)\b/i.test(text)) return { tag: 'Weak support' }
  return null
}

// ── results page layout helpers ─────────────────────────────────────────────────────────────

export type SegmentState = 'done' | 'partial' | 'pending'
export const SEGMENT_SYMBOL: Record<SegmentState, string> = { done: '✓', partial: '◐', pending: '○' }
export const SEGMENT_WORDS: Record<SegmentState, string> = { done: 'answered', partial: 'started, not enough evidence yet', pending: 'not reached' }
/** Answered, or a gap: of two kinds, so a student can tell "thin" from "never reached". */
export const SEGMENT_LEGEND: { state: SegmentState; word: string }[] = [
  { state: 'done', word: 'Answered' },
  { state: 'partial', word: 'Gap: some evidence' },
  { state: 'pending', word: 'Gap: not reached' },
]

/** "150 found · 86 accepted · 12 disagree". The last is a part of the one before it, and can never exceed it. */
export function sourcesSummaryLine(counts: { found: number; used: number }, against: number): string {
  const used = Math.min(counts.used, counts.found)
  return `${counts.found} found · ${used} accepted · ${Math.min(against, used)} disagree`
}

export interface StrengthLevel { level: 0 | 1 | 2 | 3 | 4; label: string }

/** One indicator for how strong a source's evidence is: four steps and a word. */
export function strengthLevel(strength: string | null | undefined): StrengthLevel {
  switch (strength) {
    case 'Strong': return { level: 4, label: 'Strong evidence' }
    case 'Moderate': return { level: 3, label: 'Moderate evidence' }
    case 'Weak': return { level: 2, label: 'Limited evidence' }
    case 'Conflicting': return { level: 2, label: 'Conflicting evidence' }
    case 'Insufficient': return { level: 1, label: 'Not enough evidence' }
    default: return { level: 0, label: 'Not rated' }
  }
}

/** The element id a question card carries, so a progress segment can scroll to it. */
export const questionAnchor = (questionId: string): string => `question-${questionId}`

/** The strength to show for a source: the best accepted link, or the first link when none is accepted. */
export function sourceStrength(g: Pick<SourceGroup, 'links'>, questionId?: string): string {
  const own = g.links.filter(l => (questionId ? l.questionId === questionId : true))
  const pick = own.find(l => l.decision === 'Accepted') ?? own[0] ?? g.links[0]
  return pick?.strength ?? ''
}

/** The first quote on file for a source, for a hover preview. */
export function previewQuote(g: Pick<SourceGroup, 'links'> | undefined): string | null {
  return g?.links.find(l => l.decision === 'Accepted' && l.quote)?.quote ?? g?.links.find(l => l.quote)?.quote ?? null
}

// ── the research panel: de-duplicated sources, filters, outline ─────────────────────────────

const normDoi = (doi: string | null | undefined): string => (doi ?? '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
const normTitle = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** The key two records share when they are the same paper: its DOI, else its title and year. */
export function sourceKey(g: Pick<SourceGroup, 'doi' | 'title' | 'year'>): string {
  const doi = normDoi(g.doi)
  return doi ? `doi:${doi}` : `title:${normTitle(g.title)}:${g.year ?? ''}`
}

const BUCKET_RANK: Record<SourceBucket, number> = { used: 2, excluded: 1, unassessed: 0 }

/**
 * One entry per paper. The same paper found twice (two candidate ids, one DOI) used to be listed twice. The merged entry
 * keeps every link, is "used" if any copy was, prefers a Verified record, and remembers the other ids as aliases so a
 * citation or decision that names either one still finds it.
 */
export function dedupeByDoi(groups: SourceGroup[]): SourceGroup[] {
  const byKey = new Map<string, SourceGroup>()
  for (const g of groups) {
    const key = sourceKey(g)
    const have = byKey.get(key)
    if (!have) { byKey.set(key, { ...g, links: [...g.links], aliases: [...(g.aliases ?? [])] }); continue }
    have.aliases = [...(have.aliases ?? []), g.id, ...(g.aliases ?? [])]
    have.links.push(...g.links)
    if (BUCKET_RANK[g.bucket] > BUCKET_RANK[have.bucket]) { have.bucket = g.bucket; have.exclusionReason = g.exclusionReason }
    if (g.verification === 'Verified') have.verification = 'Verified'
    if (g.coverage === 'FullText') { have.coverage = 'FullText'; have.studyDesign ??= g.studyDesign }
    if (g.decidedBy === 'You') have.decidedBy = 'You'
    if (have.geography === 'Unknown' && g.geography !== 'Unknown') have.geography = g.geography
  }
  return [...byKey.values()]
}

/** Every id a merged source answers to: its own and its aliases. */
export const idsOf = (g: Pick<SourceGroup, 'id' | 'aliases'>): string[] => [g.id, ...(g.aliases ?? [])]

/** The source an id refers to, whether it is the entry's own id or one folded into it. */
export const findGroup = (groups: SourceGroup[], id: string | null | undefined): SourceGroup | undefined =>
  id ? groups.find(g => g.id === id || g.aliases?.includes(id)) : undefined

export type SourceFilterId = 'cited' | 'all' | 'disagree'

/** The sources for one filter chip: cited in the report, everything found, or those that disagree. */
export function filterSources(groups: SourceGroup[], filter: SourceFilterId, citedIds: Set<string>): SourceGroup[] {
  if (filter === 'cited') return groups.filter(g => idsOf(g).some(id => citedIds.has(id)))
  if (filter === 'disagree') return evidenceAgainst(groups)
  return groups
}

export interface OutlineItem { id: string; label: string; level: 1 | 2 }

/** The report's headings, in reading order, as a jump list. Ids match the headings the report renders. */
export function outlineItems(report: {
  sections: { questionId: string; heading: string; claims: unknown[] }[]; conflicts: unknown[]; gaps: unknown[]; bottomLine?: unknown[]
}): OutlineItem[] {
  const items: OutlineItem[] = [{ id: 'report-bottom', label: 'Bottom line', level: 1 }]
  const withClaims = report.sections.filter(s => s.claims.length > 0)
  if (withClaims.length > 0) {
    items.push({ id: 'report-findings', label: 'Key findings', level: 1 })
    for (const s of withClaims) items.push({ id: `report-section-${s.questionId}`, label: s.heading, level: 2 })
  }
  if (report.conflicts.length > 0) items.push({ id: 'report-conflicts', label: 'Conflicting evidence', level: 1 })
  if (report.gaps.length > 0) items.push({ id: 'report-gaps', label: 'Gaps', level: 1 })
  return items
}

/** The section a scroll position is in: the last heading that has reached the reading line, else the first. */
export function currentSection(tops: { id: string; top: number }[], line: number): string | null {
  if (tops.length === 0) return null
  const passed = tops.filter(t => t.top <= line)
  return (passed.length > 0 ? passed[passed.length - 1] : tops[0]).id
}

/** Sources the student can save to their references: accepted, verified, not saved yet. */
export const savableSources = (groups: SourceGroup[], saved: Set<string>): SourceGroup[] =>
  groups.filter(g => g.bucket === 'used' && g.verification === 'Verified' && !idsOf(g).some(id => saved.has(id)))
