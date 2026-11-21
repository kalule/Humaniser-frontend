import { afterEach, describe, expect, it } from 'vitest'
import type { AlignmentIssue, CitationFlag, ProjectSection, SectionStatus } from '../types/research'
import { buildOutline, guidedParamsFor, outlineProgress, sectionFlags, THESIS_UNLOCK_REASON } from './documentOutline'
import { readStoredView, resolveView, storeView } from './researchAgentView'

let order = 0
function section(code: string, status: SectionStatus = 'NotStarted', extra: Partial<ProjectSection> = {}): ProjectSection {
  return {
    code, displayCode: code, title: `Title ${code}`, order: order++, content: '', status, wordCount: 0,
    generatedAt: null, lastEditedAt: null, citationsPendingVerification: false, generationError: null,
    hasUnusedMethodologyAnchor: false, isUnderReferenced: false, citationTarget: 0, resolvedCitationCount: 0,
    citationShortfallRetryAttempted: false, citationTargetResolution: 'exempt', methodologyReviewAdvisory: null,
    requiresReReview: false, reReviewReason: null, isApplicableForMethodology: true, notApplicableReason: null,
    isMethodologyStale: false, methodologyStaleReason: null, lockedBy: null, ...extra,
  }
}

function flag(sectionCode: string, extra: Partial<CitationFlag> = {}): CitationFlag {
  return {
    id: `f-${sectionCode}`, sectionCode, doi: '', citationRawText: '(Braun & Clarke, 2006)', claimSentence: '',
    mismatchTypes: ['ClaimContentMismatch'], confidence: 0.8, status: 'Open', createdAt: '', ...extra,
  }
}

describe('buildOutline', () => {
  it('groups by reader-facing chapter in presentation order and titles chapters from their N.0 section', () => {
    const sections = [section('0.0'), section('1.0'), section('1.2'), section('3.1'), section('3.2'), section('2.0')]
    const outline = buildOutline(sections, 'Proposal')
    expect(outline.map(c => c.key).slice(0, 4)).toEqual(['abstract', 'chapter-1', 'chapter-2', 'chapter-3'])
    expect(outline[1].title).toBe('Title 1.0')
    expect(outline[3].title).toBe('Chapter 3')
    expect(outline[3].sections.map(s => s.code)).toEqual(['3.1', '3.2'])
  })

  it('shows Results, Discussion and Conclusion as locked chapters for a proposal', () => {
    const locked = buildOutline([section('1.0')], 'Proposal').filter(c => c.lockedReason)
    expect(locked.map(c => c.title)).toEqual(['Results', 'Discussion', 'Conclusion'])
    expect(locked.every(c => c.sections.length === 0 && c.lockedReason === THESIS_UNLOCK_REASON)).toBe(true)
  })

  it('uses the real thesis sections, and puts relocated proposal sections in an appendix', () => {
    const outline = buildOutline([section('5.12'), section('6.0'), section('6.1', 'Draft', { displayCode: 'A.1' })], 'Thesis')
    expect(outline.some(c => c.lockedReason)).toBe(false)
    expect(outline.find(c => c.number === 6)?.sections.map(s => s.code)).toEqual(['6.0'])
    expect(outline.at(-1)).toMatchObject({ key: 'appendix', sections: [expect.objectContaining({ code: '6.1' })] })
  })
})

describe('outlineProgress', () => {
  it('counts applicable sections only', () => {
    expect(outlineProgress([section('1.0', 'Approved'), section('1.2', 'Draft'),
      section('4.4', 'NotStarted', { isApplicableForMethodology: false })])).toEqual({ approved: 1, total: 2 })
  })
})

describe('sectionFlags', () => {
  it('collects open citation flags, alignment issues, re-review notices and interrupted runs', () => {
    const s = section('5.2', 'Draft', { generationError: 'Generation timed out — please try again.', requiresReReview: true, reReviewReason: 'Research State moved back.' })
    const issues: AlignmentIssue[] = [{ sectionCode: '5.2', issue: 'Abstract says 12 participants.', suggestion: '', source: 'LlmJudged' },
      { sectionCode: '5.3', issue: 'Other section.', suggestion: '', source: 'LlmJudged' }]
    const flags = sectionFlags(s, [flag('5.2'), flag('5.2', { id: 'closed', status: 'Dismissed' })], issues)
    expect(flags.map(f => f.kind)).toEqual(['interrupted', 'alignment', 'alignment', 'citation'])
    expect(flags[3].message).toBe('(Braun & Clarke, 2006): the source may not support the claim.')
  })

  it('reports a stop by the student as stopped, not as a failure', () => {
    const flags = sectionFlags(section('3.2', 'Draft', { generationError: 'Stopped before the draft was finished. The partial text is kept for you to review.' }), [], [])
    expect(flags).toEqual([expect.objectContaining({ kind: 'stopped', message: 'Stopped before the draft was finished. The partial text is kept for you to review.' })])
  })

  it('does not report an old error while the section is being rewritten', () => {
    expect(sectionFlags(section('1.0', 'Generating', { generationError: 'old' }), [], [])).toEqual([])
  })
})

describe('guidedParamsFor', () => {
  it('opens proposal sections by step and thesis sections by code', () => {
    expect(guidedParamsFor('5.7a')).toEqual({ step: expect.any(String) })
    expect(guidedParamsFor('6.0')).toEqual({ section: '6.0' })
  })
})

describe('research agent view preference', () => {
  afterEach(() => localStorage.clear())

  it('defaults to guided, remembers per user, and lets ?view= win', () => {
    expect(readStoredView('u1')).toBe('guided')
    storeView('u1', 'document')
    expect(readStoredView('u1')).toBe('document')
    expect(readStoredView('u2')).toBe('guided')
    expect(resolveView('guided', 'u1')).toBe('guided')
    expect(resolveView('nonsense', 'u1')).toBe('document')
  })
})
