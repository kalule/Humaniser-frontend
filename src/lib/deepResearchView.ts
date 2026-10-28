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
