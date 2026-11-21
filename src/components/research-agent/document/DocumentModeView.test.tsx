// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ProjectSection, ResearchProject, SectionStatus } from '../../../types/research'

const renders = new Map<string, number>()
// Flush result each mounted editor reports (true = everything saved).
const flushResult = { value: true }
const flushCalls: string[] = []
vi.mock('./SectionEditor', async () => {
  const { useEffect } = await import('react')
  return {
    SectionEditor: ({ code, content, editable, registerFlush }: { code: string; content: string; editable: boolean; registerFlush: (c: string, f: (() => Promise<boolean>) | null) => void }) => {
      renders.set(content, (renders.get(content) ?? 0) + 1)
      useEffect(() => {
        registerFlush(code, async () => { flushCalls.push(code); return flushResult.value })
        return () => registerFlush(code, null)
      }, [code, registerFlush])
      return <p data-editable={String(editable)}>{content}</p>
    },
  }
})
vi.mock('../../../api/research', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/research')>()
  return { ...actual, researchApi: { ...actual.researchApi, getSectionCitationFlags: vi.fn().mockResolvedValue([]), getLiterature: vi.fn().mockResolvedValue([]) } }
})

vi.mock('../../../lib/liveDraftStore', () => ({
  followDraft: vi.fn(), forgetDraft: vi.fn(),
  useLiveDraft: () => ({ text: '', words: 0, sourcesRead: null, activities: [], streamEnded: false }),
}))
vi.mock('../../../api/proposalJourney', () => ({
  proposalJourneyApi: { current: vi.fn().mockResolvedValue({ summary: { designRequired: false }, readiness: null }) },
}))

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
// Like the real store: the section is Generating (held by its job) by the time the call resolves.
const generateSection = vi.fn(async (projectId: string, code: string) => {
  useResearchStore.setState(st => ({ sections: { ...st.sections, [projectId]: st.sections[projectId].map(x =>
    x.code === code ? { ...x, status: 'Generating' as const, lockedBy: `job-${code}` } : x) } }))
})
const stopSection = vi.fn().mockResolvedValue(undefined)
const cancelGeneration = vi.fn().mockResolvedValue(undefined)

function seed(sections: ProjectSection[]) {
  act(() => { useResearchStore.setState({ sections: { p1: sections }, approveSection, regenerateSection, generateSection, stopSection, cancelGeneration }) })
}

function renderView(onOpenGuided = vi.fn()) {
  render(<MemoryRouter><DocumentModeView project={project} onOpenGuided={onOpenGuided} /></MemoryRouter>)
  return { onOpenGuided }
}

const outline = () => within(screen.getByRole('navigation', { name: 'Outline' }))
const sectionRegion = (code: string) => within(screen.getByRole('region', { name: new RegExp(`^${code.replace('.', '\\.')} `) }))

beforeEach(() => {
  renders.clear()
  flushCalls.length = 0
  flushResult.value = true
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

  it('saves pending edits before approving, and does not approve over an unsaved edit', async () => {
    renderView()
    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: 'Approve' })) })
    expect(flushCalls).toEqual(['1.2'])
    expect(approveSection).toHaveBeenCalledTimes(1)

    flushResult.value = false
    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: 'Approve' })) })
    expect(approveSection).toHaveBeenCalledTimes(1)
  })

  it('makes approved and needs-review text editable, but not a section a run holds', () => {
    seed([section('1.0', 'Approved', 'Approved text.'), section('1.2', 'Draft', 'Held text.', { lockedBy: 'job-9' })])
    renderView()
    expect(screen.getByText('Approved text.').getAttribute('data-editable')).toBe('true')
    expect(screen.getByText('Held text.').getAttribute('data-editable')).toBe('false')
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

  it('drafts a single section that may be drafted, and explains one that may not', async () => {
    seed([section('1.0', 'Approved', 'Intro.'), section('2.0', 'NotStarted'), section('3.1', 'NotStarted')])
    renderView()
    expect((sectionRegion('3.1').getByRole('button', { name: /Draft this section/ }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { fireEvent.click(sectionRegion('2.0').getByRole('button', { name: 'Draft this section' })) })
    expect(generateSection).toHaveBeenCalledWith('p1', '2.0', 500)
  })

  it('drafts a chapter one section at a time, each only after the previous finished', async () => {
    const intro = section('1.0', 'Approved', 'Intro.')
    seed([intro, section('2.0', 'NotStarted'), section('2.1', 'NotStarted')])
    renderView()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Draft Chapter 2 · 2 sections/ })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Draft · \d+ credits/ })) })
    expect(generateSection.mock.calls.map(c => c[1])).toEqual(['2.0'])

    expect(generateSection).toHaveBeenCalledTimes(1)
    await act(async () => { seed([intro, section('2.0', 'Draft', 'Drafted.'), section('2.1', 'NotStarted')]) })
    expect(generateSection.mock.calls.map(c => c[1])).toEqual(['2.0', '2.1'])
  })

  it('stops a section run, keeping its text, and asks before stopping the whole-proposal run', async () => {
    seed([section('1.0', 'Generating', '', { lockedBy: 'job-7' }), section('1.2', 'Generating', '', { lockedBy: 'generation' })])
    renderView()
    await act(async () => { fireEvent.click(sectionRegion('1.0').getByRole('button', { name: /Stop writing/ })) })
    expect(stopSection).toHaveBeenCalledWith('p1', '1.0')

    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: /Stop writing/ })) })
    expect(cancelGeneration).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop the run' })) })
    expect(cancelGeneration).toHaveBeenCalledWith('p1')
  })

  it('asks before turning on draft ahead, then saves it on the project', async () => {
    const setContent = vi.fn()
    const syncProject = vi.fn().mockResolvedValue(undefined)
    act(() => { useResearchStore.setState({ setContent, syncProject }) })
    renderView()
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Draft ahead, review later' })) })
    expect(setContent).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn on' })) })
    expect(setContent).toHaveBeenCalledWith('p1', 'draftAhead', 'on')
    expect(syncProject).toHaveBeenCalledWith('p1')
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
