import type { AlignmentIssue, CitationFlag, CitationMismatchType, ProjectSection } from '../types/research'
import { STEPS } from '../data/proposalOutline'
import { extractSurnamesFromAuthors } from './citationFormat'
import { chapterNumber, isThesisDocument } from './sectionWorkflow'

/**
 * The Document view's outline: the same section records the Guided wizard edits, grouped into
 * chapters in presentation order. Pure, so the outline and the document column cannot disagree.
 */

export interface OutlineChapter {
  key:      string
  /** Reader-facing chapter number; null for the Abstract, appendix and locked placeholders. */
  number:   number | null
  title:    string
  sections: ProjectSection[]
  /** Set on a chapter that has no sections yet because a gate keeps it shut. */
  lockedReason?: string
}

/** Unlock wording for the thesis chapters a proposal does not have yet. */
export const THESIS_UNLOCK_REASON = 'Added when this proposal becomes a thesis, after the readiness audit passes.'

/** One combined row, not three repeats of the same sentence: a proposal does not have these chapters. */
export const THESIS_PLACEHOLDER_TITLE = 'Results · Discussion · Conclusion'

/** Section codes that open their own tool instead of a document section. */
const NON_DOCUMENT_CODES = new Set(['defence'])

export function buildOutline(sections: readonly ProjectSection[], documentType?: string): OutlineChapter[] {
  const ordered = sections.filter(s => !NON_DOCUMENT_CODES.has(s.code)).sort((a, b) => a.order - b.order)
  const abstract = ordered.filter(s => s.code === '0.0')
  const byChapter = new Map<number, ProjectSection[]>()
  const appendix: ProjectSection[] = []
  for (const s of ordered) {
    if (s.code === '0.0') continue
    const n = chapterNumber(s)
    if (n === null) { appendix.push(s); continue }
    if (!byChapter.has(n)) byChapter.set(n, [])
    byChapter.get(n)!.push(s)
  }

  const chapters: OutlineChapter[] = []
  if (abstract.length) chapters.push({ key: 'abstract', number: null, title: 'Abstract', sections: abstract })
  for (const n of [...byChapter.keys()].sort((a, b) => a - b)) {
    const list = byChapter.get(n)!
    const lead = list.find(s => (s.displayCode || s.code) === `${n}.0`)
    chapters.push({ key: `chapter-${n}`, number: n, title: lead?.title ?? `Chapter ${n}`, sections: list })
  }
  if (!isThesisDocument(documentType)) {
    chapters.push({ key: 'locked-thesis', number: null, title: THESIS_PLACEHOLDER_TITLE, sections: [], lockedReason: THESIS_UNLOCK_REASON })
  }
  if (appendix.length) chapters.push({ key: 'appendix', number: null, title: 'Appendix', sections: appendix })
  return chapters
}

/** "7 of 12 approved": applicable sections only, so a not-applicable 4.4 never blocks 100%. */
export function outlineProgress(sections: readonly ProjectSection[]): { approved: number; total: number } {
  const counted = sections.filter(s => !NON_DOCUMENT_CODES.has(s.code) && s.isApplicableForMethodology !== false)
  return { approved: counted.filter(s => s.status === 'Approved').length, total: counted.length }
}

export type SectionFlagKind = 'alignment' | 'citation' | 'interrupted' | 'stopped'

export interface SectionFlag {
  id:          string
  sectionCode: string
  kind:        SectionFlagKind
  message:     string
}

// Every name the server sends (CitationMismatchType); a missing entry falls back to a vague
// "needs checking", which is what made most Document-view flags unreadable.
const MISMATCH_TEXT: Record<CitationMismatchType, string> = {
  ClaimContentMismatch:             'the source may not support the claim',
  ClaimPartialMatch:                'the source only partly supports the claim',
  WeaklySupported:                  'the source only weakly supports the claim',
  Overstated:                       'the claim says more than the source shows',
  Contradicted:                     'the source contradicts the claim',
  OverclaimedFinding:               'the finding is stated more strongly than the source allows',
  CausalOverreach:                  'the claim is causal but the source is not',
  InsufficientEvidence:             'not enough evidence to check the claim',
  GeneralizationBeyondSample:       'the claim generalises beyond the source’s sample',
  PopulationScopeViolation:         'the claim is about a different population than the source',
  GeographicMismatch:               'the claim is about a different place than the source',
  UnresolvedCitation:               'no matching source in your literature',
  UnresolvedGapMarker:              'a citation is still needed here',
  MissingSourceData:                'the source has no text to check against',
  JournalMismatch:                  'the journal name does not match the source',
  AuthorMismatch:                   'the authors do not match the source',
  VenueMismatch:                    'the venue does not match the source',
  BibliographicDetailMismatch:      'the reference details differ from the source',
  ImplausibleYear:                  'the publication year looks wrong',
  TemporallyImpossibleSource:       'the source is older than a year the claim mentions',
  RetractedSource:                  'the source has been retracted',
  SourceStaleness:                  'the source may be out of date for this claim',
  OverusedInSection:                'the source is cited too often in this section',
  OverusedAcrossDocument:           'the source is also cited in several other sections',
  SourceDiversityWarning:           'the section leans on too few sources',
  UnderCitedStrengthClaim:          'the sentence says "many studies" but cites at most one',
  SecondaryDataPresentedAsPrimary:  'secondary data is described as if you collected it',
  OrphanedReference:                'a reference-list entry is not cited in the text',
  MalformedCitationShape:           'a reference-list line appears without a citing sentence',
  AmbiguousCitation:                'several sources share this author and year',
  StatisticUnknownIdentifier:       'the statistic does not match any analysis result',
  StatisticValueMismatch:           'the number does not match the analysis result',
  StatisticDirectionMismatch:       'the effect direction does not match the analysis result',
  StatisticUnverifiableQualitative: 'the statistical claim cannot be checked against the analysis',
}

function reasonsOf(flag: CitationFlag): string {
  const reasons = flag.mismatchTypes.map(t => MISMATCH_TEXT[t]).filter((r): r is string => !!r)
  return reasons.length ? reasons.join('; ') : 'this citation needs checking'
}

/** "Klishi (2024)": which source of a grouped citation the flag is about. */
function sourceName(flag: CitationFlag): string | null {
  const surname = flag.sourceAuthors ? extractSurnamesFromAuthors(flag.sourceAuthors)[0] : undefined
  if (!surname) return null
  return flag.sourceYear ? `${surname} (${flag.sourceYear})` : surname
}

function citationMessage(raw: string, what: string, sources: string[]): string {
  const base = raw ? `${raw}: ${what}.` : `${what[0].toUpperCase()}${what.slice(1)}.`
  return sources.length ? `${base} Sources concerned: ${sources.join(', ')}.` : base
}

/**
 * The server writes one flag per cited source, so "(A, 2024; B, 2023; C, 2024)" can raise three
 * identical-looking flags. Merge flags with the same citation text and reasons into one, naming
 * the sources concerned when the citation groups several.
 */
function groupCitationFlags(sectionCode: string, flags: readonly CitationFlag[]): SectionFlag[] {
  const groups = new Map<string, { id: string; raw: string; what: string; sources: string[] }>()
  for (const flag of flags) {
    const what = reasonsOf(flag)
    const key = `${flag.citationRawText}\u0000${what}`
    let group = groups.get(key)
    if (!group) { group = { id: flag.id, raw: flag.citationRawText, what, sources: [] }; groups.set(key, group) }
    const name = flag.citationRawText.includes(';') ? sourceName(flag) : null
    if (name && !group.sources.includes(name)) group.sources.push(name)
  }
  return [...groups.values()].map(g => ({
    id: g.id, sectionCode, kind: 'citation', message: citationMessage(g.raw, g.what, g.sources),
  }))
}

/**
 * Everything a reviewer should look at before approving a section, from records that already
 * exist: open citation flags (stored), alignment issues (from the last "Check alignment" run),
 * re-review notices, and an interrupted run.
 */
export function sectionFlags(
  section: ProjectSection,
  citationFlags: readonly CitationFlag[],
  alignmentIssues: readonly AlignmentIssue[],
  /** False hides the "fewer citations than needed" notice (citation flags switched off for this user). */
  includeCitationShortfall = true,
): SectionFlag[] {
  const flags: SectionFlag[] = []
  if (section.generationError && section.status !== 'Generating') {
    // A Stop by the student is not a failure; the server's message already says what was kept.
    const stopped = section.generationError.startsWith('Stopped')
    flags.push({ id: `${section.code}:interrupted`, sectionCode: section.code, kind: stopped ? 'stopped' : 'interrupted',
      message: stopped ? section.generationError : `Generation interrupted: ${section.generationError}` })
  }
  alignmentIssues.filter(i => i.sectionCode === section.code).forEach((issue, i) =>
    flags.push({ id: `${section.code}:alignment:${i}`, sectionCode: section.code, kind: 'alignment', message: issue.issue }))
  if (section.requiresReReview && section.reReviewReason) {
    flags.push({ id: `${section.code}:rereview`, sectionCode: section.code, kind: 'alignment', message: section.reReviewReason })
  }
  if (section.isMethodologyStale && section.methodologyStaleReason) {
    flags.push({ id: `${section.code}:methodology`, sectionCode: section.code, kind: 'alignment', message: section.methodologyStaleReason })
  }
  flags.push(...groupCitationFlags(section.code, citationFlags.filter(f => f.sectionCode === section.code && f.status === 'Open')))
  if (includeCitationShortfall && section.isUnderReferenced && section.status !== 'Approved') {
    flags.push({ id: `${section.code}:under-referenced`, sectionCode: section.code, kind: 'citation',
      message: `Fewer citations than this section needs (${section.resolvedCitationCount} of ${section.citationTarget}).` })
  }
  return flags
}

/**
 * Where Guided opens a section. Proposal sections are steps in the fixed outline ("5.7a" is not a
 * valid ?section= value); thesis-only sections are addressed by ?section=.
 */
export function guidedParamsFor(code: string): Record<string, string> {
  const step = STEPS.findIndex(s => s.id === code)
  return step >= 0 ? { step: String(step) } : { section: code }
}
