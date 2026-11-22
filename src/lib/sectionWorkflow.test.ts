import { describe, expect, it } from 'vitest'
import type { ProjectSection, SectionStatus } from '../types/research'
import { canDraft, chapterNumber, documentStatus, isSectionHeld, unapprovedPrerequisites, type DraftContext } from './sectionWorkflow'

let order = 0
function section(code: string, status: SectionStatus = 'NotStarted', extra: Partial<ProjectSection> = {}): ProjectSection {
  return {
    code, displayCode: code, title: `Title ${code}`, order: order++, content: status === 'NotStarted' ? '' : 'Some text.',
    status, wordCount: 0, generatedAt: null, lastEditedAt: null, citationsPendingVerification: false,
    generationError: null, hasUnusedMethodologyAnchor: false, isUnderReferenced: false, citationTarget: 0,
    resolvedCitationCount: 0, citationShortfallRetryAttempted: false, citationTargetResolution: 'exempt',
    methodologyReviewAdvisory: null, requiresReReview: false, reReviewReason: null,
    isApplicableForMethodology: true, notApplicableReason: null, isMethodologyStale: false,
    methodologyStaleReason: null, lockedBy: null, ...extra,
  }
}

const ctx = (sections: ProjectSection[], extra: Partial<DraftContext> = {}): DraftContext =>
  ({ sections, methodologyConfirmed: true, documentType: 'Proposal', researchState: 'Proposal', ...extra })

describe('chapterNumber', () => {
  it('reads the reader-facing chapter, not the stored code', () => {
    expect(chapterNumber(section('5.7a'))).toBe(5)
    expect(chapterNumber(section('6.1', 'NotStarted', { displayCode: 'A.1' }))).toBeNull()
    expect(chapterNumber(section('0.0'))).toBeNull()
  })
})

describe('canDraft', () => {
  it('allows the first chapter of a fresh project', () => {
    const intro = section('1.0')
    expect(canDraft(intro, ctx([intro, section('1.2'), section('2.0')]))).toEqual({ allowed: true, reason: null, blocker: null })
  })

  it('allows any section within a chapter once earlier chapters are approved', () => {
    const sections = [section('1.0', 'Approved'), section('1.2', 'Approved'), section('2.0', 'Approved'),
      section('3.1', 'Draft'), section('3.2'), section('3.3')]
    expect(canDraft(sections[4], ctx(sections)).allowed).toBe(true)
  })

  it('blocks a later chapter until earlier chapters are approved, naming what is waiting', () => {
    const sections = [section('1.0', 'Approved'), section('1.2', 'Draft'), section('2.0', 'Edited'), section('3.1')]
    const decision = canDraft(sections[3], ctx(sections))
    expect(decision.allowed).toBe(false)
    expect(decision.blocker).toBe('prerequisite')
    expect(decision.reason).toBe('Needs Chapters 1 and 2 approved first (1.2 Title 1.2 is not approved yet).')
  })

  it('lets a later chapter be drafted when chapter order is switched off', () => {
    const sections = [section('4.3', 'Approved'), section('4.4'), section('5.1')]
    expect(canDraft(sections[2], ctx(sections)).blocker).toBe('prerequisite')
    expect(canDraft(sections[2], ctx(sections, { chapterOrder: false }))).toEqual({ allowed: true, reason: null, blocker: null })
    // the other gates still apply
    const design = section('5.2')
    expect(canDraft(design, ctx([design], { chapterOrder: false, methodologyConfirmed: false })).blocker).toBe('methodology')
  })

  it('ignores sections that do not apply to the methodology', () => {
    const sections = [section('4.3', 'Approved'), section('4.4', 'NotStarted', { isApplicableForMethodology: false }), section('5.1')]
    expect(canDraft(sections[2], ctx(sections)).allowed).toBe(true)
  })

  it('ignores relocated appendix sections when gating thesis chapters', () => {
    const sections = [section('5.12', 'Approved'), section('6.1', 'Draft', { displayCode: 'A.1' }), section('6.0')]
    expect(unapprovedPrerequisites(sections[2], sections)).toEqual([])
  })

  it('refuses a section that is already being written', () => {
    const s = section('1.0', 'Generating', { lockedBy: 'job-1' })
    expect(canDraft(s, ctx([s]))).toMatchObject({ allowed: false, blocker: 'writing' })
  })

  it('refuses a section that does not apply, with the server reason', () => {
    const s = section('4.4', 'NotStarted', { isApplicableForMethodology: false, notApplicableReason: 'No hypotheses in a qualitative study.' })
    expect(canDraft(s, ctx([s]))).toEqual({ allowed: false, blocker: 'not_applicable', reason: 'No hypotheses in a qualitative study.' })
  })

  it('requires a confirmed methodology for methodology-sensitive sections only', () => {
    const design = section('5.2'); const area = section('5.1')
    expect(canDraft(design, ctx([design, area], { methodologyConfirmed: false })).blocker).toBe('methodology')
    expect(canDraft(area, ctx([design, area], { methodologyConfirmed: false })).allowed).toBe(true)
  })

  it('respects an unaccepted study design but not an unknown one', () => {
    const s = section('1.0')
    expect(canDraft(s, ctx([s], { designReady: false })).blocker).toBe('design')
    expect(canDraft(s, ctx([s], { designReady: undefined })).allowed).toBe(true)
  })

  describe('locked thesis chapters', () => {
    const thesis = (state: string, sections: ProjectSection[]) => ctx(sections, { documentType: 'Thesis', researchState: state })

    it('locks Results and Discussion until analysis is completed', () => {
      const results = section('6.0')
      const decision = canDraft(results, thesis('DataCollection', [section('5.12', 'Draft'), results]))
      expect(decision).toMatchObject({ allowed: false, blocker: 'locked' })
      expect(decision.reason).toMatch(/Analysis Completed/)
    })

    it('does not gate Results on unapproved proposal chapters', () => {
      const results = section('6.0')
      expect(canDraft(results, thesis('AnalysisCompleted', [section('5.12', 'Draft'), results])).allowed).toBe(true)
    })

    it('locks Discussion until Results is approved', () => {
      const results = section('6.0', 'Draft'); const discussion = section('7.0')
      expect(canDraft(discussion, thesis('CompletedResearch', [results, discussion])))
        .toMatchObject({ blocker: 'locked', reason: 'Discussion unlocks after Results (6.0) is approved.' })
      const approved = section('6.0', 'Approved')
      expect(canDraft(discussion, thesis('CompletedResearch', [approved, discussion])).allowed).toBe(true)
    })

    it('never offers Results for a literature-only study', () => {
      const results = section('6.0')
      expect(canDraft(results, thesis('LiteratureOnly', [results])).reason).toMatch(/literature-only/)
    })

    it('leaves Conclusion ungated so literature-only theses can finish', () => {
      const conclusion = section('8.0')
      expect(canDraft(conclusion, thesis('LiteratureOnly', [section('6.0'), section('7.0'), conclusion])).allowed).toBe(true)
    })

    it('locks the proposal Abstract until its source sections are approved', () => {
      const abstract = section('0.0')
      const sections = [abstract, ...['3.1', '3.2', '4.2', '4.3'].map(c => section(c, 'Approved')), section('5.2', 'Draft')]
      expect(canDraft(abstract, ctx(sections)).blocker).toBe('locked')
      sections[5] = section('5.2', 'Approved')
      expect(canDraft(abstract, ctx(sections)).allowed).toBe(true)
    })
  })
})

describe('draft ahead, review later', () => {
  const early = () => [section('1.0', 'Draft'), section('2.0', 'NotStarted'), section('3.1', 'NotStarted'), section('4.1', 'NotStarted')]

  it('lets Chapters 1 to 3 be drafted before earlier chapters are approved', () => {
    const sections = early()
    expect(canDraft(sections[2], ctx(sections)).blocker).toBe('prerequisite')
    expect(canDraft(sections[2], ctx(sections, { draftAhead: true })).allowed).toBe(true)
  })

  it('still makes Chapter 4 onward wait for every earlier chapter', () => {
    const sections = early()
    expect(canDraft(sections[3], ctx(sections, { draftAhead: true }))).toMatchObject({ allowed: false, blocker: 'prerequisite' })
  })

  it('never relaxes locks or the methodology gate', () => {
    const results = section('6.0')
    expect(canDraft(results, ctx([results], { draftAhead: true, documentType: 'Thesis', researchState: 'DataCollection' })).blocker).toBe('locked')
    const framework = section('3.3')
    expect(canDraft(framework, ctx([framework], { draftAhead: true, methodologyConfirmed: false })).blocker).toBe('methodology')
  })
})

describe('documentStatus', () => {
  it('maps server statuses onto the five document states', () => {
    const c = ctx([])
    expect(documentStatus(section('1.0', 'NotStarted'), c)).toBe('queued')
    expect(documentStatus(section('1.0', 'Generating'), c)).toBe('writing')
    expect(documentStatus(section('1.0', 'Draft'), c)).toBe('needs_review')
    expect(documentStatus(section('1.0', 'Edited'), c)).toBe('needs_review')
    expect(documentStatus(section('1.0', 'Approved'), c)).toBe('approved')
  })

  it('shows text left by an interrupted run as needs_review, not queued', () => {
    const s = section('1.0', 'NotStarted', { content: 'Partial text.', generationError: 'Generation was interrupted.' })
    expect(documentStatus(s, ctx([s]))).toBe('needs_review')
  })

  it('shows an empty gated section as locked, and a gated section with text as needs_review', () => {
    const results = section('6.0')
    const c = ctx([results], { documentType: 'Thesis', researchState: 'DataCollection' })
    expect(documentStatus(results, c)).toBe('locked')
    expect(documentStatus(section('6.0', 'Draft'), c)).toBe('needs_review')
  })

  it('does not lock a section that is only waiting on earlier chapters', () => {
    const sections = [section('1.0', 'Draft'), section('2.0')]
    expect(documentStatus(sections[1], ctx(sections))).toBe('queued')
  })
})

describe('isSectionHeld', () => {
  it('holds a section while generating or while a lock id is present', () => {
    expect(isSectionHeld({ status: 'Generating', lockedBy: null })).toBe(true)
    expect(isSectionHeld({ status: 'Draft', lockedBy: 'job-3' })).toBe(true)
    expect(isSectionHeld({ status: 'Approved', lockedBy: null })).toBe(false)
  })
})
