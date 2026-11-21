import type { AlignmentIssue, CitationFlag, ProjectSection } from '../types/research'
import { STEPS } from '../data/proposalOutline'
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
export const THESIS_UNLOCK_REASON = 'Unlocks after the readiness audit passes and the proposal moves to a thesis.'

const THESIS_PLACEHOLDERS = ['Results', 'Discussion', 'Conclusion']

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
    for (const title of THESIS_PLACEHOLDERS) {
      chapters.push({ key: `locked-${title.toLowerCase()}`, number: null, title, sections: [], lockedReason: THESIS_UNLOCK_REASON })
    }
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

const MISMATCH_TEXT: Partial<Record<string, string>> = {
  ClaimContentMismatch: 'the source may not support the claim',
  ClaimPartialMatch:    'the source only partly supports the claim',
  UnresolvedCitation:   'no matching source in your literature',
  UnresolvedGapMarker:  'a citation is still needed here',
  MissingSourceData:    'the source has no text to check against',
  JournalMismatch:      'the journal name does not match the source',
  AuthorMismatch:       'the authors do not match the source',
}

function citationMessage(flag: CitationFlag): string {
  const reasons = flag.mismatchTypes.map(t => MISMATCH_TEXT[t]).filter((r): r is string => !!r)
  const what = reasons.length ? reasons.join('; ') : 'this citation needs checking'
  return flag.citationRawText ? `${flag.citationRawText}: ${what}.` : `${what[0].toUpperCase()}${what.slice(1)}.`
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
  citationFlags.filter(f => f.sectionCode === section.code && f.status === 'Open').forEach(flag =>
    flags.push({ id: flag.id, sectionCode: section.code, kind: 'citation', message: citationMessage(flag) }))
  if (section.isUnderReferenced && section.status !== 'Approved') {
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
