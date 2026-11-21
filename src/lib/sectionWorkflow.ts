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
 *   NotStarted otherwise   -> queued
 */
export type DocumentSectionStatus = 'queued' | 'writing' | 'needs_review' | 'approved' | 'locked'

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
}

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
  const waiting = unapprovedPrerequisites(section, ctx.sections, ctx.draftAhead)
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
      return lockReason(section, ctx) ? 'locked' : 'queued'
  }
}

/** A section is read-only while a run holds it. */
export const isSectionHeld = (section: Pick<ProjectSection, 'status' | 'lockedBy'>) =>
  section.status === 'Generating' || !!section.lockedBy

export const DOCUMENT_STATUS_LABELS: Record<DocumentSectionStatus, string> = {
  queued:       'Queued',
  writing:      'Writing',
  needs_review: 'Needs review',
  approved:     'Approved',
  locked:       'Locked',
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
