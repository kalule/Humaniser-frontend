// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ProjectSection, ResearchProject, SectionStatus } from '../../../types/research'

const renders = new Map<string, number>()
// Flush result each mounted editor reports (true = everything saved).
const flushResult = { value: true }
const flushCalls: string[] = []
// The research agent's activity list makes its own request; off here, as when the agent is disabled.
vi.mock('../../../api/proposalAgent', () => ({ proposalAgentApi: { activity: vi.fn().mockResolvedValue(null) } }))
vi.mock('../../../api/frameworkFigure', () => ({ getFrameworkFigure: vi.fn().mockResolvedValue({ stored: false, figure: null, reason: null }) }))
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
  return { ...actual, researchApi: { ...actual.researchApi, getSectionCitationFlags: vi.fn().mockResolvedValue([]), getLiterature: vi.fn().mockResolvedValue([]),
    getBibliography: vi.fn().mockResolvedValue({ entries: [] }), getProposalIssues: vi.fn(async () => proposalIssues.value) } }
})

const confirmIssues = { value: false }
const proposalIssues: { value: { issues: unknown[]; blockingCount: number; repairsAvailable: boolean; repairsUnavailableReason: null } } =
  { value: { issues: [], blockingCount: 0, repairsAvailable: false, repairsUnavailableReason: null } }
vi.mock('../../../config/features', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../config/features')>()
  // The chapter-order gate is exercised here, so these tests run with it on.
  return { ...actual, get CONFIRM_APPROVAL_ISSUES() { return confirmIssues.value }, REQUIRE_CHAPTER_ORDER: true }
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
  // Every key study decision set, so tests of the other drafting gates are not held at the decisions gate.
  sectionContent: {
    designContract: JSON.stringify({ designType: 'Survey', studySetting: 'The named city', dataSources: 'Questionnaire', populationDefinition: 'Registered owners', samplingMethod: 'Purposive sampling', sampleSize: '384', sampleSizeBasis: 'Cochran formula', analysisApproach: 'Regression', software: 'SPSS', dataCollector: 'The researcher' }),
    // The student approved 1.0 and 1.2 (generatedAt null in these fixtures), so a server Approved shows as Approved.
    studentApproved: JSON.stringify({ '1.0': '', '1.2': '' }),
  },
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
const idleRun = { status: 'NotStarted', completedCount: 0, totalCount: 0, currentSection: null, wordsWritten: 0, failedCount: 0 }
const getGenerationStatus = vi.fn().mockResolvedValue(idleRun)
const generateAutonomous = vi.fn().mockResolvedValue({ ...idleRun, status: 'Starting' })
const loadSections = vi.fn().mockResolvedValue(undefined)

function seed(sections: ProjectSection[]) {
  act(() => { useResearchStore.setState({ sections: { p1: sections }, approveSection, regenerateSection, generateSection, stopSection, cancelGeneration, getGenerationStatus, generateAutonomous, loadSections }) })
}

function renderView(onOpenGuided = vi.fn(), p: ResearchProject = project) {
  render(<MemoryRouter><DocumentModeView project={p} onOpenGuided={onOpenGuided} /></MemoryRouter>)
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
afterEach(() => { cleanup(); vi.clearAllMocks(); getGenerationStatus.mockResolvedValue(idleRun) })

describe('DocumentModeView', () => {
  it('shows no drafting card when nothing is being drafted or paused', async () => {
    seed([section('1.0', 'Approved', 'Intro.'), section('1.2', 'Draft', 'Background.')])
    renderView()
    await act(async () => {})
    expect(screen.queryAllByRole('region', { name: 'Drafting' })).toHaveLength(0)
  })

  it('shows a running whole-proposal run in the compact drafting card, counted like the outline, with one Pause', async () => {
    getGenerationStatus.mockResolvedValue({ ...idleRun, status: 'Generating', completedCount: 1, totalCount: 25, currentSection: '3.1', wordsWritten: 480 })
    renderView()
    const card = within((await screen.findAllByRole('region', { name: 'Drafting' }, { timeout: 5000 }))[0])
    // The document's own count (4 sections, 2 with text), not the run's 25.
    expect(card.getByText(/2 of 4 drafted/)).toBeTruthy()
    expect(card.getByRole('button', { name: '3.1 Title 3.1' })).toBeTruthy()
    expect(outline().getByText('1 approved · 1 to review · 2 to go')).toBeTruthy()
    // One Pause in the panel, plus Stop on the section being streamed.
    expect(card.getByRole('button', { name: 'Pause drafting' })).toBeTruthy()
    expect(sectionRegion('3.1').getByRole('button', { name: /Stop writing/ })).toBeTruthy()
    expect(loadSections).toHaveBeenCalledWith('p1')
  })

  it('Pause cancels the run and stops every section the run does not hold', async () => {
    getGenerationStatus.mockResolvedValue({ ...idleRun, status: 'Generating', completedCount: 0, totalCount: 25, currentSection: '1.2', wordsWritten: 0 })
    seed([section('1.0', 'Generating', '', { lockedBy: 'job-7' }), section('1.2', 'Generating', '', { lockedBy: 'generation' })])
    renderView()
    await screen.findAllByRole('region', { name: 'Drafting' }, { timeout: 5000 })
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Pause drafting' })[0]) })
    expect(cancelGeneration).toHaveBeenCalledWith('p1')
    expect(stopSection).toHaveBeenCalledWith('p1', '1.0')
    expect(stopSection).not.toHaveBeenCalledWith('p1', '1.2')
  })

  it('a run paused for review: the next step is that review, and Resume stays reachable at the project word target', async () => {
    getGenerationStatus.mockResolvedValue({ ...idleRun, status: 'NeedsReview', completedCount: 1, totalCount: 25, currentSection: '1.2', wordsWritten: 500 })
    seed([section('1.0', 'Approved', 'Intro.'), section('1.2', 'Draft', 'Background.'), section('2.0', 'NotStarted')])
    renderView()
    const card = within((await screen.findAllByRole('region', { name: 'Drafting' }, { timeout: 5000 }))[0])
    expect(card.getByText('Paused for your review')).toBeTruthy()
    const next = within(screen.getAllByRole('region', { name: 'Next step' })[0])
    expect(next.getByText('Review 1.2 Title 1.2')).toBeTruthy()
    await act(async () => { fireEvent.click(card.getByRole('button', { name: 'Resume drafting' })) })
    expect(generateAutonomous).toHaveBeenCalledWith('p1', 400)
  })

  it('never shows more than one primary button in the agent panel', async () => {
    const cases = [
      [section('1.0', 'Approved', 'Intro.'), section('2.0', 'NotStarted')],
      [section('1.0', 'Approved', 'Intro.'), section('1.2', 'Draft', 'Background.'), section('2.0', 'NotStarted')],
      [section('1.0', 'Approved', 'Intro.'), section('1.2', 'Approved', 'Background.')],
    ]
    for (const sections of cases) {
      seed(sections)
      const { unmount } = render(<MemoryRouter><DocumentModeView project={project} onOpenGuided={vi.fn()} /></MemoryRouter>)
      await act(async () => {})
      const panel = screen.getAllByRole('complementary', { name: 'Agent' })[0]
      const primaries = Array.from(panel.querySelectorAll('button')).filter(b => b.style.background.includes('--color-purple') && !b.getAttribute('role'))
      expect(primaries.length).toBe(1)
      unmount()
    }
  })

  it('shows every section with a status that is not conveyed by colour alone', () => {
    renderView()
    expect(outline().getByText('1 approved · 1 to review · 2 to go')).toBeTruthy()
    for (const [code, status] of [['1.0', 'Approved'], ['1.2', 'Ready for review'], ['2.0', 'Not started'], ['3.1', 'Writing']]) {
      expect(outline().getByRole('button', { name: new RegExp(`${status}.*${code.replace('.', '\\.')}`) })).toBeTruthy()
    }
    expect(sectionRegion('1.2').getByText('Ready for review')).toBeTruthy()
  })

  it('shows Results, Discussion and Conclusion as one locked row with what unlocks them', () => {
    renderView()
    expect(outline().getByRole('button', { name: /Results · Discussion · Conclusion, locked/ })).toBeTruthy()
    expect(screen.getAllByText(/after the readiness audit passes/).length).toBe(2)
  })

  it('ends the document with progress and the next thing to do', () => {
    renderView()
    const end = within(screen.getByRole('region', { name: 'End of document' }))
    expect(end.getByText(/1 of 4 sections approved/)).toBeTruthy()
    expect(end.getByRole('button', { name: /^Review 1\.2/ })).toBeTruthy()
    expect(end.getByRole('button', { name: /Export \.docx/ })).toBeTruthy()
  })

  it('approves straight away (acknowledged) when issue confirmation is off', async () => {
    renderView()
    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: 'Approve' })) })
    expect(approveSection).toHaveBeenCalledWith('p1', '1.2', true)
  })

  it('offers Approve anyway on an overridable refusal and retries as acknowledged', async () => {
    confirmIssues.value = true
    approveSection.mockRejectedValueOnce({ code: 'CITATION_INTEGRITY_BLOCKED', message: 'blocked' })
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
    const { Toaster } = await import('react-hot-toast')
    render(<Toaster />)
    renderView()
    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: 'Approve' })) })
    const anyway = await screen.findByRole('button', { name: 'Approve anyway' })
    await act(async () => { fireEvent.click(anyway) })
    expect(approveSection).toHaveBeenCalledWith('p1', '1.2', false)
    expect(approveSection).toHaveBeenLastCalledWith('p1', '1.2', true)
    confirmIssues.value = false
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

  it('shows a section the study does not need as a note, with no Draft button', () => {
    seed([
      section('1.0', 'Approved', 'Approved introduction text.'),
      section('4.4', 'NotStarted', '', { isApplicableForMethodology: false, notApplicableReason: 'This study is descriptive and exploratory, so hypotheses are not required.' }),
    ])
    renderView()
    expect(sectionRegion('4.4').getByText(/hypotheses are not required/)).toBeTruthy()
    expect(sectionRegion('4.4').queryByRole('button', { name: 'Draft this section' })).toBeNull()
    expect(outline().getByText('Not needed')).toBeTruthy()
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
    expect(generateSection).toHaveBeenCalledWith('p1', '2.0', 1400)
  })

  it('drafts the remaining sections one at a time, each only after the previous finished', async () => {
    const intro = section('1.0', 'Approved', 'Intro.')
    seed([intro, section('2.0', 'NotStarted'), section('2.1', 'NotStarted')])
    renderView()
    const next = within(screen.getAllByRole('region', { name: 'Next step' })[0])
    expect(next.getByText('2 sections still to draft')).toBeTruthy()
    await act(async () => { fireEvent.click(next.getByRole('button', { name: 'Draft all remaining' })) })
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

  it('shows "Edited after approval" on an approved section the student edited, and Approve again clears it', async () => {
    const setContent = vi.fn()
    const syncProject = vi.fn().mockResolvedValue(undefined)
    act(() => { useResearchStore.setState({ setContent, syncProject }) })
    renderView(vi.fn(), { ...project, sectionContent: { editedAfterApproval: JSON.stringify(['1.0']) } } as ResearchProject)
    expect(sectionRegion('1.0').getByText('Edited after approval')).toBeTruthy()
    expect(outline().getByRole('button', { name: /Edited after approval/ })).toBeTruthy()
    await act(async () => { fireEvent.click(sectionRegion('1.0').getByRole('button', { name: 'Approve again' })) })
    expect(approveSection).toHaveBeenCalledWith('p1', '1.0', true)
    expect(setContent).toHaveBeenCalledWith('p1', 'editedAfterApproval', '[]')
  })

  it('marks dependent sections stale when a study decision changes, without touching their text', async () => {
    const setContent = vi.fn()
    const syncProject = vi.fn().mockResolvedValue(undefined)
    const saveSection = vi.fn()
    seed([section('5.5', 'Draft', 'A sample of 300.'), section('5.10', 'Approved', 'Analysed in SPSS.'), section('6.2', 'NotStarted')])
    act(() => { useResearchStore.setState({ setContent, syncProject, saveSection }) })
    renderView(vi.fn(), { ...project, sectionContent: { designContract: JSON.stringify({ sampleSize: '300' }) } } as ResearchProject)
    const contract = within(screen.getAllByRole('region', { name: 'Study decisions' })[0])
    fireEvent.click(contract.getByRole('button', { name: 'Sample size: 300. Edit' }))
    expect(document.activeElement).toBe(contract.getByLabelText('Sample size'))
    fireEvent.change(contract.getByLabelText('Sample size'), { target: { value: '384' } })
    await act(async () => { fireEvent.click(contract.getByRole('button', { name: 'Save decisions' })) })
    const staleCall = setContent.mock.calls.find(c => c[1] === 'designContractStale')
    expect(JSON.parse(staleCall![2])).toEqual({ '5.5': ['Sample size'], '5.10': ['Sample size'] })
    expect(JSON.parse(setContent.mock.calls.find(c => c[1] === 'designContract')![2])).toEqual({ sampleSize: '384' })
    expect(syncProject).toHaveBeenCalledWith('p1')
    expect(saveSection).not.toHaveBeenCalled()
  })

  it('shows a stale section with the changed fields, and "Still matches" clears it', async () => {
    const setContent = vi.fn()
    const syncProject = vi.fn().mockResolvedValue(undefined)
    act(() => { useResearchStore.setState({ setContent, syncProject }) })
    renderView(vi.fn(), { ...project, sectionContent: { designContractStale: JSON.stringify({ '1.2': ['Analysis software'] }) } } as ResearchProject)
    expect(sectionRegion('1.2').getByText('May be out of date')).toBeTruthy()
    expect(sectionRegion('1.2').getByText(/the study decisions changed \(Analysis software\)/)).toBeTruthy()
    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: 'Still matches' })) })
    expect(setContent).toHaveBeenCalledWith('p1', 'designContractStale', '{}')
  })

  it('gates export on open review issues, and an explicit override exports and is logged', async () => {
    proposalIssues.value = { issues: [], blockingCount: 0, repairsAvailable: false, repairsUnavailableReason: null }
    const exportDocx = vi.fn().mockResolvedValue(undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    seed([section('1.0', 'Approved', 'Approved text.'), section('5.7', 'Draft', 'Exposure is (PrimaryExposure Definition).')])
    act(() => { useResearchStore.setState({ exportDocx }) })
    renderView()
    const end = () => within(screen.getByRole('region', { name: 'End of document' }))
    await act(async () => { fireEvent.click(end().getByRole('button', { name: /Export \.docx/ })) })
    expect(await screen.findByText('1 open review issue')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    expect(exportDocx).not.toHaveBeenCalled()

    await act(async () => { fireEvent.click(end().getByRole('button', { name: /Export \.docx/ })) })
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Export anyway' })) })
    expect(exportDocx).toHaveBeenCalledWith('p1')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('override'), expect.objectContaining({ open: 1 }))
    warn.mockRestore()
  })

  it('Review lists placeholders anchored to their section', async () => {
    seed([section('1.0', 'Approved', 'Approved text.'), section('5.7', 'Draft', 'Duration is TBD.')])
    renderView()
    // Every section is drafted, so the whole-document review is the next step.
    const review = within(screen.getAllByRole('group', { name: 'Review' })[0])
    await act(async () => { fireEvent.click(review.getByRole('button', { name: 'Run review' })) })
    expect(review.getByText('Review found 1 open issue')).toBeTruthy()
    expect(review.getByRole('button', { name: /5\.7 Title 5\.7.*TBD/ })).toBeTruthy()
  })

  it('a rewrite over edited text keeps the student text and asks, per change, what to accept', async () => {
    localStorage.clear()
    const saveSection = vi.fn().mockResolvedValue(undefined)
    const confirmedIntro = section('1.0', 'Approved', 'Intro.')
    seed([confirmedIntro, section('1.2', 'Edited', 'Keep this.\n\nMy edited claim.', { lastEditedAt: '2026-11-23T10:00:00Z' })])
    act(() => { useResearchStore.setState({ saveSection }) })
    renderView()
    await act(async () => { fireEvent.click(sectionRegion('1.2').getByRole('button', { name: 'Rewrite' })) })
    expect(screen.getByText(/Your edited text stays in place/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Rewrite · \d+ credits/ })) })
    expect(regenerateSection).toHaveBeenCalledWith('p1', '1.2')

    // The agent writes, then lands its version.
    await act(async () => { seed([confirmedIntro, section('1.2', 'Generating', '', { lockedBy: 'job-1' })]) })
    await act(async () => { seed([confirmedIntro, section('1.2', 'Draft', 'Keep this.\n\nThe rewritten claim.', { generatedAt: new Date(Date.now() + 1000).toISOString() })]) })
    // The student's text is put back; the rewrite waits in the review dialog.
    expect(saveSection).toHaveBeenCalledWith('p1', '1.2', 'Keep this.\n\nMy edited claim.')
    const dialog = within(await screen.findByRole('dialog', { name: /Review the rewrite of 1\.2/ }))
    expect(dialog.getByText('1 change. Each one keeps your version unless you accept it.')).toBeTruthy()
    fireEvent.click(dialog.getByLabelText('Accept rewrite'))
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Apply' })) })
    expect(saveSection).toHaveBeenLastCalledWith('p1', '1.2', 'Keep this.\n\nThe rewritten claim.')
    expect(screen.queryByRole('dialog', { name: /Review the rewrite/ })).toBeNull()
  })
  describe('study decisions', () => {
    const KEY_SET = { designType: 'Cross-sectional survey', studySetting: 'The named city', dataSources: 'Questionnaire', populationDefinition: 'Registered owners', samplingMethod: 'Purposive sampling', sampleSize: '384', sampleSizeBasis: 'Cochran formula', analysisApproach: 'Regression', software: 'SPSS', dataCollector: 'The researcher' }

    it('holds every section after 1.1 until the key decisions are set, and shows them as the next step', async () => {
      seed([section('1.0', 'Approved', 'Intro.'), section('1.2', 'NotStarted'), section('2.0', 'NotStarted')])
      renderView(vi.fn(), { ...project, sectionContent: { designContract: JSON.stringify({ software: 'SPSS', sampleSize: '384' }) } } as ResearchProject)
      await act(async () => {})
      const card = within(screen.getAllByRole('region', { name: 'Study decisions' })[0])
      expect(card.getByText('NEXT STEP')).toBeTruthy()
      expect(card.getByText(/2 of 10 set/)).toBeTruthy()
      expect(card.getByRole('button', { name: 'Design type: not set. Edit' })).toBeTruthy()
      // 1.1 Background (code 1.2) may still be drafted; 2.0 waits.
      expect((sectionRegion('1.2').getByRole('button', { name: /^Draft/ }) as HTMLButtonElement).disabled).toBe(false)
      const blocked = sectionRegion('2.0').getByRole('button', { name: /^Draft/ }) as HTMLButtonElement
      expect(blocked.disabled).toBe(true)
      expect(sectionRegion('2.0').getByText(/Set the key study decisions first/)).toBeTruthy()
      fireEvent.click(blocked)
      expect(generateSection).not.toHaveBeenCalled()
    })

    it('lets drafting past 1.1 go ahead once every key decision is set', async () => {
      seed([section('1.0', 'Approved', 'Intro.'), section('1.2', 'Approved', 'Background.'), section('2.0', 'NotStarted')])
      renderView(vi.fn(), { ...project, sectionContent: { designContract: JSON.stringify(KEY_SET) } } as ResearchProject)
      await act(async () => {})
      expect(screen.queryAllByRole('region', { name: 'Study decisions' }).every(r => !r.textContent?.includes('NEXT STEP'))).toBe(true)
      expect((sectionRegion('2.0').getByRole('button', { name: /^Draft/ }) as HTMLButtonElement).disabled).toBe(false)
    })

    it('"Use suggested defaults" writes explicit values for every missing key decision and keeps the ones set', async () => {
      const setContent = vi.fn()
      const syncProject = vi.fn().mockResolvedValue(undefined)
      seed([section('1.0', 'Approved', 'Intro.'), section('2.0', 'NotStarted')])
      act(() => { useResearchStore.setState({ setContent, syncProject }) })
      renderView(vi.fn(), { ...project, methodologyType: 'Quantitative', studyLocation: 'The named city', studyPopulation: 'Registered owners',
        sectionContent: { designContract: JSON.stringify({ software: 'Stata' }) } } as unknown as ResearchProject)
      const card = within(screen.getAllByRole('region', { name: 'Study decisions' })[0])
      await act(async () => { fireEvent.click(card.getByRole('button', { name: 'Use suggested defaults' })) })
      const saved = JSON.parse(setContent.mock.calls.find(c => c[1] === 'designContract')![2])
      expect(saved).toEqual({
        designType: 'Cross-sectional survey', studySetting: 'The named city', dataSources: 'Structured questionnaire',
        populationDefinition: 'Registered owners', samplingMethod: 'Non-probability purposive sampling of eligible respondents',
        sampleSize: '384 respondents', sampleSizeBasis: 'Cochran formula: 95% confidence, 5% margin of error, p = 0.5',
        analysisApproach: 'Descriptive statistics, correlation and multiple regression',
        software: 'Stata', dataCollector: 'The researcher, personally',
      })
      expect(syncProject).toHaveBeenCalledWith('p1')
    })
  })
  describe('up next and not started', () => {
    it('"Draft all remaining" queues every remaining section in order: the running one drafts, the rest show Up next with Draft now', async () => {
      seed([section('1.0', 'Approved', 'Intro.'), section('2.0', 'NotStarted'), section('2.1', 'NotStarted'), section('2.2', 'NotStarted')])
      renderView()
      for (const code of ['2.0', '2.1', '2.2']) expect(outline().getByRole('button', { name: new RegExp(`Not started.*${code.replace('.', '\\.')}`) })).toBeTruthy()
      // Not started sections offer the compact draft button; nothing is up next yet.
      expect(sectionRegion('2.1').getByRole('button', { name: 'Draft this section' })).toBeTruthy()
      expect(within(screen.getAllByRole('region', { name: 'Next step' })[0]).getByText('3 sections still to draft')).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Draft all remaining' })[0]) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Draft · \d+ credits/ })) })
      expect(generateSection.mock.calls.map(c => c[1])).toEqual(['2.0'])
      expect(outline().getByRole('button', { name: /Up next.*2\.1/ })).toBeTruthy()
      expect(sectionRegion('2.1').queryByRole('button', { name: 'Draft this section' })).toBeNull()
      // Draft now starts an up-next section straight away and takes it out of the queue.
      await act(async () => { fireEvent.click(sectionRegion('2.2').getByRole('button', { name: 'Draft 2.2 Title 2.2 now' })) })
      expect(generateSection.mock.calls.map(c => c[1])).toEqual(['2.0', '2.2'])
    })

    it('Pause turns the queue back into Not started, and Resume puts it back in the run', async () => {
      seed([section('1.0', 'Approved', 'Intro.'), section('2.0', 'NotStarted'), section('2.1', 'NotStarted')])
      renderView()
      await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Draft all remaining' })[0]) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Draft · \d+ credits/ })) })
      expect(outline().getByRole('button', { name: /Up next.*2\.1/ })).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Pause drafting' })[0]) })
      expect(stopSection).toHaveBeenCalledWith('p1', '2.0')
      // The stopped section reverts; 2.1 is outside the run now.
      await act(async () => { seed([section('1.0', 'Approved', 'Intro.'), section('2.0', 'NotStarted'), section('2.1', 'NotStarted')]) })
      expect(outline().getByRole('button', { name: /Not started.*2\.1/ })).toBeTruthy()
      generateSection.mockClear()
      await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Resume drafting' })[0]) })
      expect(generateSection.mock.calls.map(c => c[1])).toEqual(['2.1'])
    })
  })
  describe('approved vs ready for review', () => {
    it('a section the whole-proposal run approved shows Ready for review until the student approves it', async () => {
      seed([section('1.0', 'Approved', 'Run-approved intro.', { generatedAt: '2026-11-24T08:00:00Z' }), section('1.2', 'Approved', 'Student-approved background.')])
      renderView()
      expect(outline().getByRole('button', { name: /Ready for review.*1\.0/ })).toBeTruthy()
      expect(outline().getByRole('button', { name: /Approved.*1\.2/ })).toBeTruthy()
      expect(outline().getByText('1 approved · 1 to review · 0 to go')).toBeTruthy()
      expect(sectionRegion('1.0').getByRole('button', { name: 'Approve' })).toBeTruthy()
    })

    it('a rewrite after the student approved needs their approval again', () => {
      // studentApproved records 1.2 with generatedAt '' (the fixture); a newer draft has a new generatedAt.
      seed([section('1.0', 'Approved', 'Intro.'), section('1.2', 'Approved', 'Redrafted background.', { generatedAt: '2026-11-24T09:00:00Z' })])
      renderView()
      expect(outline().getByRole('button', { name: /Ready for review.*1\.2/ })).toBeTruthy()
    })

    it('shows a locked section with a short reason, the full one in its tooltip, and a key of every state', () => {
      seed([section('0.0', 'NotStarted'), section('1.0', 'Approved', 'Intro.'), section('3.1', 'NotStarted')])
      renderView()
      const row = outline().getByRole('button', { name: /Locked.*0\.0.*Unlocks after/ })
      expect(row.getAttribute('title')).toMatch(/^Unlocks after/)
      expect(within(row).getByText('Written last')).toBeTruthy()
      const key = within(screen.getByRole('list', { name: 'Status key' }))
      for (const label of ['Approved', 'Ready for review', 'Writing', 'Up next', 'Not started', 'Locked', 'Edited after approval', 'May be out of date']) {
        expect(key.getAllByText(label).some(el => el.className.includes('truncate'))).toBe(true)
      }
    })
  })
  it('explains Guided and Document once, until dismissed', () => {
    localStorage.removeItem('dm.modeHint.dismissed')
    renderView()
    const hint = within(screen.getByRole('complementary', { name: 'About this view' }))
    expect(hint.getByText(/one section at a time/)).toBeTruthy()
    fireEvent.click(hint.getByRole('button', { name: 'Dismiss this tip' }))
    expect(screen.queryByRole('complementary', { name: 'About this view' })).toBeNull()
    expect(localStorage.getItem('dm.modeHint.dismissed')).toBe('1')
    cleanup()
    renderView()
    expect(screen.queryByRole('complementary', { name: 'About this view' })).toBeNull()
  })
})
