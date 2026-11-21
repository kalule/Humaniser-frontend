// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ProjectSection, ResearchProject, SectionStatus } from '../../../types/research'

const renders = new Map<string, number>()
vi.mock('../ProposalMarkdown', () => ({
  ProposalMarkdown: ({ content }: { content: string }) => {
    renders.set(content, (renders.get(content) ?? 0) + 1)
    return <p>{content}</p>
  },
}))
vi.mock('../../../api/research', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/research')>()
  return { ...actual, researchApi: { ...actual.researchApi, getSectionCitationFlags: vi.fn().mockResolvedValue([]) } }
})

const { useResearchStore } = await import('../../../store/researchStore')
const { DocumentModeView } = await import('./DocumentModeView')

let order = 0
function section(code: string, status: SectionStatus, content = '', extra: Partial<ProjectSection> = {}): ProjectSection {
  return {
    code, displayCode: code, title: `Title ${code}`, order: order++, content, status, wordCount: content.split(' ').length,
    generatedAt: null, lastEditedAt: null, citationsPendingVerification: false, generationError: null,
    hasUnusedMethodologyAnchor: false, isUnderReferenced: false, citationTarget: 0, resolvedCitationCount: 0,
    citationShortfallRetryAttempted: false, citationTargetResolution: 'exempt', methodologyReviewAdvisory: null,
    requiresReReview: false, reReviewReason: null, isApplicableForMethodology: true, notApplicableReason: null,
    isMethodologyStale: false, methodologyStaleReason: null, lockedBy: null, ...extra,
  }
}

const project = {
  id: 'p1', title: 'Load-shedding', documentType: 'Proposal', documentMode: 'PROPOSAL', generatorMode: 'GENERATOR',
  citationStyle: 'harvard', confirmedMethodology: { id: 'm' }, researchState: 'Proposal',
} as unknown as ResearchProject

const approveSection = vi.fn().mockResolvedValue(undefined)
const regenerateSection = vi.fn().mockResolvedValue(undefined)

function seed(sections: ProjectSection[]) {
  act(() => { useResearchStore.setState({ sections: { p1: sections }, approveSection, regenerateSection }) })
}

function renderView(onOpenGuided = vi.fn()) {
  render(<MemoryRouter><DocumentModeView project={project} onOpenGuided={onOpenGuided} /></MemoryRouter>)
  return { onOpenGuided }
}

const outline = () => within(screen.getByRole('navigation', { name: 'Outline' }))
const sectionRegion = (code: string) => within(screen.getByRole('region', { name: new RegExp(`^${code.replace('.', '\\.')} `) }))

beforeEach(() => {
  renders.clear()
  seed([
    section('1.0', 'Approved', 'Approved introduction text.'),
    section('1.2', 'Draft', 'Background draft text.'),
    section('2.0', 'NotStarted'),
    section('3.1', 'Generating', '', { lockedBy: 'job-7' }),
  ])
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('DocumentModeView', () => {
  it('shows every section with a status that is not conveyed by colour alone', () => {
    renderView()
    expect(outline().getByText('1 of 4 approved')).toBeTruthy()
    for (const [code, status] of [['1.0', 'Approved'], ['1.2', 'Needs review'], ['2.0', 'Queued'], ['3.1', 'Writing']]) {
      expect(outline().getByRole('button', { name: new RegExp(`${status}.*${code.replace('.', '\\.')}`) })).toBeTruthy()
    }
    expect(sectionRegion('1.2').getByText('Needs review')).toBeTruthy()
  })

  it('shows Results, Discussion and Conclusion as locked with what unlocks them', () => {
    renderView()
    expect(outline().getByRole('button', { name: /Results, locked/ })).toBeTruthy()
    expect(screen.getAllByText(/Unlocks after the readiness audit passes/).length).toBeGreaterThan(0)
  })

  it('approves through the same store call Guided uses', async () => {
    renderView()
    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: 'Approve' })) })
    expect(approveSection).toHaveBeenCalledWith('p1', '1.2', false)
  })

  it('explains why a later chapter cannot be drafted yet', () => {
    renderView()
    expect(sectionRegion('2.0').getByText(/Needs Chapter 1 approved first \(1\.2 Title 1\.2/)).toBeTruthy()
  })

  it('blocks rewriting a section whose earlier chapters are unapproved, and says why', () => {
    seed([section('1.0', 'Draft', 'Intro draft.'), section('2.0', 'Draft', 'Review draft.')])
    renderView()
    const rewrite = sectionRegion('2.0').getByRole('button', { name: 'Rewrite' }) as HTMLButtonElement
    expect(rewrite.disabled).toBe(true)
    expect(sectionRegion('2.0').getByText(/Rewrite unavailable: Needs Chapter 1 approved/)).toBeTruthy()
    expect((sectionRegion('1.0').getByRole('button', { name: 'Rewrite' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('offers no actions on a section that is being written', () => {
    renderView()
    expect(sectionRegion('3.1').queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(sectionRegion('3.1').queryByRole('button', { name: 'Rewrite' })).toBeNull()
  })

  it('opens a section in Guided', () => {
    const { onOpenGuided } = renderView()
    fireEvent.click(sectionRegion('1.2').getByRole('button', { name: /Open 1\.2 .* in Guided/ }))
    expect(onOpenGuided).toHaveBeenCalledWith('1.2')
  })

  it('re-renders only the section that changed when a poll replaces every section object', () => {
    renderView()
    const before = renders.get('Approved introduction text.')
    expect(before).toBeGreaterThan(0)
    const current = useResearchStore.getState().sections.p1
    seed(current.map(s => s.code === '1.2' ? { ...s, status: 'Approved' } : { ...s }))
    expect(renders.get('Approved introduction text.')).toBe(before)
    expect(sectionRegion('1.2').getByText('Approved')).toBeTruthy()
  })
})
