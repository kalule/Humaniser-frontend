import type { ProjectSection, SectionStatus } from '../types/research'
import { isAbstractStepLocked } from '../pages/app/abstractStepStatus'

/**
 * One status model for a section, shared by the Guided wizard and the Document view.
 *
 * The server keeps its own five values (NotStarted | Generating | Draft | Edited | Approved).
 * This is a read-only view over them plus the drafting gates, so both views show the same thing
 * and nothing new is stored:
 *   Generating             -> writing
 *   Draft | Edited         -> needs_review
 *   Approved               -> approved
 *   NotStarted, has text   -> needs_review  (an interrupted run left text on it)
 *   NotStarted, gate shut  -> locked        (a gate such as Research State or the Abstract's rule)
 *   NotStarted otherwise   -> not_started   (up_next once it is in the agent's current run: see withRunMark)
 *
 * There is no stored "queued" any more: a section waiting in the run is up_next, one outside it
 * (no run, or paused) is not_started.
 */
export type DocumentSectionStatus =
  | 'not_started' | 'up_next' | 'writing' | 'needs_review' | 'approved' | 'locked'
  // Review marks layered over the server status (see withReviewMarks); never returned by documentStatus.
  | 'edited_after_approval' | 'stale'

/** Why a section cannot be drafted right now. `locked` is a gate; the rest are "not yet". */
export type DraftBlocker = 'writing' | 'not_applicable' | 'locked' | 'prerequisite' | 'methodology' | 'design'

export interface DraftDecision {
  allowed: boolean
  /** Sentence for a disabled button or a toast. Null when allowed. */
  reason:  string | null
  blocker: DraftBlocker | null
}

export interface DraftContext {
  /** Every section of the project, deduplicated (see dedupeSections). */
  sections:              readonly ProjectSection[]
  documentType?:         string
  researchState?:        string
  /** True once the methodology is confirmed (project.confirmedMethodology is set). */
  methodologyConfirmed:  boolean
  /**
   * For a proposal bound to a research design: whether the design allows writing. Undefined
   * means "not known here"; the server still checks it.
   */
  designReady?:          boolean
  /**
   * "Draft ahead, review later" (off by default): Chapters 1 to DRAFT_AHEAD_LAST_CHAPTER may be
   * drafted without waiting for earlier chapters' approval. Later chapters still need every
   * earlier chapter approved, and the locks (Abstract, Results/Discussion) never relax.
   */
  draftAhead?:           boolean
  /**
   * Whether a later chapter waits for every earlier chapter's approval. Undefined/true enforces it;
   * false (the app default, see REQUIRE_CHAPTER_ORDER) lets any chapter be drafted at any time.
   */
  chapterOrder?:         boolean
}

// The key study decisions used to hold every section after 1.1 Background until the student set them. They are now
// planned by the server from the topic before drafting (silent study decisions), so drafting never waits for them.

/** Last chapter "draft ahead" covers. Chapter 4 onward always waits for approval. */
export const DRAFT_AHEAD_LAST_CHAPTER = 3

/** Where the setting is kept: the project's synced sectionContent, like targetSectionWordCount. */
export const DRAFT_AHEAD_KEY = 'draftAhead'

export const isDraftAheadOn = (sectionContent: Record<string, string> | undefined) =>
  sectionContent?.[DRAFT_AHEAD_KEY] === 'on'

/** Same list as ResearchService.MethodologySensitiveSectionCodes on the server. */
export const METHODOLOGY_SENSITIVE_SECTIONS: ReadonlySet<string> =
  new Set(['3.3', '5.2', '5.4', '5.5', '5.6', '5.7', '5.7a', '5.9', '5.10', '5.12'])

/** Sections that exist only after the proposal becomes a thesis (gated by the readiness audit). */
export const THESIS_ONLY_SECTIONS: ReadonlySet<string> = new Set(['6.0', '7.0', '8.0', '8.1'])

/**
 * Sections that never hold back a later chapter. Hypotheses (4.4) are only needed when the
 * analysis plan (5.7a) names a statistical test, and that plan is written in Chapter 5, so 4.4
 * can be written after it; the server marks 4.4 not applicable once 5.7a is descriptive only.
 */
export const DEFERRABLE_SECTIONS: ReadonlySet<string> = new Set(['4.4'])

/** Research States in which Results and Discussion may be written (ResearchStateSectionPolicy). */
const EMPIRICAL_STATES: ReadonlySet<string> = new Set(['AnalysisCompleted', 'CompletedResearch'])

const ABSTRACT_CODE = '0.0'

const allowed: DraftDecision = { allowed: true, reason: null, blocker: null }
const blocked = (blocker: DraftBlocker, reason: string): DraftDecision => ({ allowed: false, reason, blocker })

export const isThesisDocument = (documentType?: string) =>
  documentType === 'Thesis' || documentType === 'Dissertation'

/**
 * The reader-facing chapter number of a section, from displayCode ("5.7a" -> 5). Null for the
 * Abstract, appendix sections (a relocated "A.1" Timeline) and anything not numbered.
 */
export function chapterNumber(section: Pick<ProjectSection, 'code' | 'displayCode'>): number | null {
  if (section.code === ABSTRACT_CODE) return null
  const match = /^(\d+)\./.exec(section.displayCode || section.code)
  if (!match) return null
  const n = Number(match[1])
  return n > 0 ? n : null
}

const isApplicable = (s: ProjectSection) => s.isApplicableForMethodology !== false

/**
 * Proposal-chapter rule: every applicable section in an earlier chapter must be approved before a
 * later chapter is drafted. Within a chapter, sections can be drafted in any order, and each one
 * still stops at needs_review. Returns the earlier sections still waiting.
 */
export function unapprovedPrerequisites(section: ProjectSection, sections: readonly ProjectSection[], draftAhead = false): ProjectSection[] {
  if (THESIS_ONLY_SECTIONS.has(section.code)) return []
  const chapter = chapterNumber(section)
  if (chapter === null) return []
  if (draftAhead && chapter <= DRAFT_AHEAD_LAST_CHAPTER) return []
  return sections
    .filter(s => s.code !== section.code
      && !THESIS_ONLY_SECTIONS.has(s.code)
      && !DEFERRABLE_SECTIONS.has(s.code)
      && isApplicable(s)
      && s.status !== 'Approved')
    .filter(s => {
      const c = chapterNumber(s)
      return c !== null && c < chapter
    })
    .sort((a, b) => a.order - b.order)
}

function describeWaiting(waiting: ProjectSection[]): string {
  const chapters = [...new Set(waiting.map(s => chapterNumber(s)!))].sort((a, b) => a - b)
  const label = chapters.length === 1
    ? `Chapter ${chapters[0]}`
    : `Chapters ${chapters.slice(0, -1).join(', ')} and ${chapters[chapters.length - 1]}`
  const first = waiting[0]
  return `Needs ${label} approved first (${first.displayCode || first.code} ${first.title} is not approved yet).`
}

/** The gate that keeps a section shut regardless of what the student does in other sections. */
function lockReason(section: ProjectSection, ctx: DraftContext): string | null {
  if (section.code === ABSTRACT_CODE && isAbstractStepLocked(ctx.sections, ctx.documentType ?? '')) {
    return isThesisDocument(ctx.documentType)
      ? 'Unlocks after Conclusion (8.0) and Recommendations (8.1) are approved.'
      : 'Unlocks after Problem Statement, Justification, General Objective, Specific Objectives and Study Design are approved.'
  }
  if (section.code === '6.0' || section.code === '7.0') {
    const name = section.code === '6.0' ? 'Results' : 'Discussion'
    if (ctx.researchState === 'LiteratureOnly') return `${name} is not written for a literature-only study.`
    if (!EMPIRICAL_STATES.has(ctx.researchState ?? '')) {
      return `${name} unlocks when your Research State is Analysis Completed or Completed Research.`
    }
  }
  if (section.code === '7.0') {
    const results = ctx.sections.find(s => s.code === '6.0')
    if (results?.status !== 'Approved' || !results.content.trim()) return 'Discussion unlocks after Results (6.0) is approved.'
  }
  // Closing-chapter grounding chain, mirroring the server's ThesisChapterPrerequisites:
  // the Conclusion is written from the approved Discussion (not in a literature-only thesis, which has none),
  // and Recommendations from the approved Conclusion.
  const approvedWithContent = (code: string) => {
    const s = ctx.sections.find(x => x.code === code)
    return s?.status === 'Approved' && !!s.content.trim()
  }
  if (section.code === '8.0' && ctx.researchState !== 'LiteratureOnly' && !approvedWithContent('7.0')) {
    return 'Conclusion unlocks after Discussion (7.0) is approved.'
  }
  if (section.code === '8.1' && !approvedWithContent('8.0')) {
    return 'Recommendations unlock after Conclusion (8.0) is approved.'
  }
  return null
}

/**
 * Whether the agent may draft (or redraft) this section now, and why not. Pure: the same answer
 * drives the Guided Generate button, the Document view's drafting buttons and the outline.
 * The server enforces the locks independently; this keeps the UI from offering what it would refuse.
 */
export function canDraft(section: ProjectSection, ctx: DraftContext): DraftDecision {
  if (section.status === 'Generating') return blocked('writing', 'This section is being written now.')
  if (!isApplicable(section)) {
    return blocked('not_applicable', section.notApplicableReason || 'This section does not apply to your methodology.')
  }
  const lock = lockReason(section, ctx)
  if (lock) return blocked('locked', lock)
  const waiting = ctx.chapterOrder === false ? [] : unapprovedPrerequisites(section, ctx.sections, ctx.draftAhead)
  if (waiting.length > 0) return blocked('prerequisite', describeWaiting(waiting))
  if (METHODOLOGY_SENSITIVE_SECTIONS.has(section.code) && !ctx.methodologyConfirmed) {
    return blocked('methodology', 'Confirm your methodology in Setup before drafting this section.')
  }
  if (ctx.designReady === false) return blocked('design', 'Accept your study design before drafting.')
  return allowed
}

export function documentStatus(section: ProjectSection, ctx: DraftContext): DocumentSectionStatus {
  switch (section.status) {
    case 'Generating': return 'writing'
    case 'Approved':   return 'approved'
    case 'Draft':
    case 'Edited':     return 'needs_review'
    default:
      if (section.content.trim()) return 'needs_review'
      return lockReason(section, ctx) ? 'locked' : 'not_started'
  }
}

/** A section is read-only while a run holds it. */
export const isSectionHeld = (section: Pick<ProjectSection, 'status' | 'lockedBy'>) =>
  section.status === 'Generating' || !!section.lockedBy

export const DOCUMENT_STATUS_LABELS: Record<DocumentSectionStatus, string> = {
  not_started:  'Not started',
  up_next:      'Up next',
  writing:      'Writing',
  needs_review: 'Ready for review',
  approved:     'Approved',
  locked:       'Locked',
  edited_after_approval: 'Edited after approval',
  stale:        'May be out of date',
}

/** The outline key's order: the states a student meets most, first. Every status appears once. */
export const LEGEND_STATES: readonly DocumentSectionStatus[] = [
  'approved', 'needs_review', 'writing', 'up_next', 'not_started', 'locked', 'edited_after_approval', 'stale',
]

/** A section with text the student can read and edit (everything except not started, up next, writing and locked). */
export const hasSectionBody = (status: DocumentSectionStatus) =>
  status === 'needs_review' || status === 'approved' || status === 'edited_after_approval' || status === 'stale'

/**
 * Approved only when the student approved it. A section the server has Approved but the student
 * did not (the whole-proposal run auto-approves its drafts) is still ready for their review.
 */
export const withApprovalSource = (status: DocumentSectionStatus, studentApproved: boolean): DocumentSectionStatus =>
  status === 'approved' && !studentApproved ? 'needs_review' : status

/**
 * Sections to draft, in drafting order: the conceptual framework (3.3) waits for the research questions and objectives
 * (4.1-4.3) still in the list, so its framework table can name them. Same order as the server's
 * AutonomousChapterCodes.DraftOrder; the document itself still reads 3.3 before 4.1.
 */
export function inDraftOrder(codes: readonly string[]): string[] {
  if (!codes.includes('3.3')) return [...codes]
  const rest = codes.filter(c => c !== '3.3')
  let last = -1
  rest.forEach((c, i) => { if (c === '4.1' || c === '4.2' || c === '4.3') last = i })
  if (last < 0) return [...codes]
  rest.splice(last + 1, 0, '3.3')
  return rest
}

/** A few words for a locked section's outline row; the full reason goes in its tooltip. */
export function shortLockLabel(code: string): string {
  switch (code) {
    case ABSTRACT_CODE: return 'Written last'
    case '6.0':
    case '7.0': return 'After analysis'
    case '8.0': return 'After Discussion'
    case '8.1': return 'After Conclusion'
    default:    return 'Locked'
  }
}

/** A not-started section the agent's current run will draft is shown as up next. */
export const withRunMark = (status: DocumentSectionStatus, inRun: boolean): DocumentSectionStatus =>
  status === 'not_started' && inRun ? 'up_next' : status

/**
 * The status shown for a section: the server-derived status, plus two review marks the student
 * should see. Writing, not started, up next and locked always win (there is no text to review). Stale (a design
 * contract field it states changed) outranks "edited after approval", which only applies while the
 * server still has the section approved or demoted it to Edited after an approval.
 */
export function withReviewMarks(
  status: DocumentSectionStatus, marks: { stale: boolean; editedAfterApproval: boolean },
): DocumentSectionStatus {
  if (!hasSectionBody(status)) return status
  if (marks.stale) return 'stale'
  if (marks.editedAfterApproval) return 'edited_after_approval'
  return status
}

// Shared by every view that reads sections (Guided rail, Guided editor, Document view, exports):
// when the server returns duplicate rows for a code, keep the most advanced status, then the
// longest content, so no two views can resolve "the section for code X" differently.
const SECTION_STATUS_ORDER: Record<SectionStatus, number> =
  { NotStarted: 0, Generating: 1, Draft: 2, Edited: 3, Approved: 4 }

export function dedupeSections(rawSections: readonly ProjectSection[]): ProjectSection[] {
  const best = new Map<string, ProjectSection>()
  for (const s of rawSections) {
    const existing = best.get(s.code)
    if (!existing) { best.set(s.code, s); continue }
    const statusDelta = SECTION_STATUS_ORDER[s.status] - SECTION_STATUS_ORDER[existing.status]
    if (statusDelta > 0 || (statusDelta === 0 && s.content.length > existing.content.length)) {
      best.set(s.code, s)
    }
  }
  return [...best.values()].sort((a, b) => a.order - b.order)
}
