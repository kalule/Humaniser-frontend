import { describe, expect, it } from 'vitest'
import type { ProjectSection, SectionStatus } from '../types/research'
import { buildOutline } from './documentOutline'
import { nextDraftAction } from './draftPlan'
import type { DraftContext } from './sectionWorkflow'

let order = 0
function section(code: string, status: SectionStatus = 'NotStarted', extra: Partial<ProjectSection> = {}): ProjectSection {
  return {
    code, displayCode: code, title: `Title ${code}`, order: order++, content: status === 'NotStarted' ? '' : 'Text.',
    status, wordCount: 0, generatedAt: null, lastEditedAt: null, citationsPendingVerification: false, generationError: null,
    hasUnusedMethodologyAnchor: false, isUnderReferenced: false, citationTarget: 0, resolvedCitationCount: 0,
    citationShortfallRetryAttempted: false, citationTargetResolution: 'exempt', methodologyReviewAdvisory: null,
    requiresReReview: false, reReviewReason: null, isApplicableForMethodology: true, notApplicableReason: null,
    isMethodologyStale: false, methodologyStaleReason: null, lockedBy: null, ...extra,
  }
}
const plan = (sections: ProjectSection[]) => {
  const ctx: DraftContext = { sections, methodologyConfirmed: true, documentType: 'Proposal', researchState: 'Proposal' }
  return nextDraftAction(buildOutline(sections, 'Proposal'), ctx, 350)
}

describe('nextDraftAction', () => {
  it('offers the next chapter with sections to draft, as one sequential run', () => {
    const action = plan([section('1.0', 'Approved'), section('2.0', 'Approved'),
      section('3.1'), section('3.2'), section('3.3', 'Draft'), section('3.4', 'NotStarted', { isApplicableForMethodology: false })])
    expect(action).toMatchObject({ codes: ['3.1', '3.2'], words: 700, label: 'Draft Chapter 3 · 2 sections, about 700 words' })
    expect(action?.decision.allowed).toBe(true)
  })

  it('offers it disabled, with the reason, when earlier chapters are not approved', () => {
    const action = plan([section('1.0', 'Approved'), section('2.0', 'Draft'), section('3.1'), section('3.2')])
    expect(action?.codes).toEqual(['3.1', '3.2'])
    expect(action?.decision).toMatchObject({ allowed: false, blocker: 'prerequisite' })
    expect(action?.decision.reason).toMatch(/Needs Chapter 2 approved/)
  })

  it('names a single section instead of a chapter', () => {
    expect(plan([section('1.0', 'Approved'), section('1.2')])?.label).toBe('Draft 1.2 Title 1.2 · about 350 words')
  })

  it('with draft ahead on, offers Chapters 1 to 3 as one sequence and nothing beyond', () => {
    const sections = [section('1.0', 'Draft'), section('1.2'), section('2.0'), section('3.1'), section('4.1')]
    const ctx: DraftContext = { sections, methodologyConfirmed: true, documentType: 'Proposal', researchState: 'Proposal', draftAhead: true }
    const action = nextDraftAction(buildOutline(sections, 'Proposal'), ctx, 300)
    expect(action).toMatchObject({ codes: ['1.2', '2.0', '3.1'], label: 'Draft ahead: Chapters 1–3 · 3 sections, about 900 words' })
    expect(action?.decision.allowed).toBe(true)
  })

  it('never offers a section that is already being written or drafted', () => {
    expect(plan([section('1.0', 'Generating'), section('1.2', 'Draft')])).toBeNull()
  })
})
