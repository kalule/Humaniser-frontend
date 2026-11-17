// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { DeepResearchSessionSummary, VerifiedEvidencePackage } from '../../api/deepResearch'

const summary = (patch: Partial<DeepResearchSessionSummary> & { id: string }): DeepResearchSessionSummary => ({
  projectId: 'p1', researchQuestion: 'What structural barriers most significantly impede low-income families?', mode: 'TopicExploration',
  status: 'Completed', isFinished: true, canResume: false, message: '', acceptedSources: 20,
  createdAt: '2026-11-10T08:00:00Z', updatedAt: '2026-11-10T08:30:00Z', ...patch,
})

const SESSIONS = [
  summary({ id: 's1', createdAt: '2026-11-10T08:00:00Z' }),
  summary({ id: 's2', createdAt: '2026-11-10T09:00:00Z', status: 'NeedsReview' }),
  summary({ id: 's3', createdAt: '2026-11-10T10:00:00Z', status: 'Stopped' }),
  summary({ id: 'm1', researchQuestion: 'Does microfinance increase women’s income?', createdAt: '2026-11-09T10:00:00Z' }),
]

const PACKAGE: VerifiedEvidencePackage = {
  schemaVersion: '1', sessionId: 's3', projectId: 'p1', contentHash: 'abc', researchQuestion: SESSIONS[2].researchQuestion,
  scope: { topic: SESSIONS[2].researchQuestion, relationship: null, concepts: [], population: [], geography: [], timePeriod: null, academicField: null, minYear: null, maxYear: null },
  evidenceQuestions: [
    { id: 'q1', type: 'Definition', question: 'What counts as a structural barrier?', status: 'Resolved', sufficiency: 'Sufficient', reasons: [] },
    { id: 'q2', type: 'Effect', question: 'Which barriers matter most?', status: 'Exhausted', sufficiency: 'Insufficient', reasons: ['Needs 1 accepted source(s); has 0.'] },
  ],
  keyFindings: [], acceptedEvidence: [], potentialResearchGaps: [], insufficientEvidence: [], contradictions: [], limitations: [],
  searchCoverage: [], providerCoverage: [], completionReason: 'BudgetIterations', evidenceSufficient: false,
  usage: { searches: 14, providerCalls: 30, llmCalls: 40, inputTokens: 1000, outputTokens: 500, estimatedLlmCostUsd: 0.4321, elapsedSeconds: 312 },
}

const api = vi.hoisted(() => ({
  list: vi.fn(), evidencePackage: vi.fn(), followUpQuote: vi.fn(), get: vi.fn(), start: vi.fn(), resume: vi.fn(), exportReportDocx: vi.fn(),
}))
vi.mock('../../api/deepResearch', () => ({ deepResearchApi: api }))
vi.mock('../../api/webLibrary', () => ({ webLibraryApi: { getCollections: vi.fn(async () => []) } }))
vi.mock('../../api/research', () => ({ researchApi: { list: vi.fn(async () => [{ id: 'p1', title: 'Thesis' }]) } }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const { default: EvidencePackagesPage } = await import('./EvidencePackagesPage')
const { useAuthStore } = await import('../../store/authStore')

const RAW = ['NeedsReview', 'BudgetExhausted', 'SearchesExhausted', 'PartiallySufficient', 'Insufficient', 'Exhausted', 'Resolved', 'BudgetIterations', 'accepted source(s)']

const renderPage = async (entry = '/app/web-library/packages') => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[entry]}><EvidencePackagesPage /></MemoryRouter>)
  await screen.findAllByText(/structural barriers/)
  return user
}

beforeEach(() => {
  api.list.mockResolvedValue(SESSIONS)
  api.evidencePackage.mockResolvedValue(PACKAGE)
  api.followUpQuote.mockResolvedValue({ canRetryFree: true })
  api.get.mockResolvedValue({ ...SESSIONS[1], depth: 'standard' })
  api.start.mockResolvedValue({ id: 'new-run' })
  useAuthStore.setState({ user: null })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('Evidence packages list', () => {
  it('groups repeated runs into one package and shows humanised status chips', async () => {
    const user = await renderPage()
    expect(screen.getByText('2 packages from 4 sessions')).toBeTruthy()
    const card = screen.getByText('3 runs of this question').closest('li')!
    expect(within(card).getByText('Stopped at its limit')).toBeTruthy()
    expect(within(card).getByText('20 sources')).toBeTruthy()

    await user.click(within(card).getByRole('button', { name: /3 runs of this question/ }))
    expect(within(card).getByText('Run 1')).toBeTruthy()
    expect(within(card).getByText('Off-topic results')).toBeTruthy()
    for (const raw of RAW) expect(document.body.textContent).not.toContain(raw)
  })
})

describe('Evidence package detail', () => {
  it('summarises questions, rewrites reasons, hides a scope that repeats the title, and keeps telemetry out of sight', async () => {
    await renderPage('/app/web-library/packages?session=s3')
    expect(await screen.findByText('1 of 2')).toBeTruthy()
    expect(screen.getByText('Needs 1 more source (has 0)')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Scope' })).toBeNull()
    expect(screen.getByRole('link', { name: /Reuse in Proposal Studio/ }).className).toContain('bg-purple-accent')
    expect(screen.getByRole('button', { name: /Download report \(Word\)/ })).toBeTruthy()
    // Partial run: says why and what to do next.
    expect(screen.getByText(/Stopped after its research rounds ran out/)).toBeTruthy()
    expect(screen.getByText(/work on the unanswered questions/)).toBeTruthy()
    // Cost is admin-only even inside Technical details.
    expect(document.body.textContent).not.toContain('0.4321')
    for (const raw of RAW) expect(document.body.textContent).not.toContain(raw)
  })

  it('shows the model cost to admins inside Technical details', async () => {
    useAuthStore.setState({ user: { role: 'Admin' } as never })
    await renderPage('/app/web-library/packages?session=s3')
    await screen.findByText('1 of 2')
    expect(document.body.textContent).toContain('$0.4321')
  })

  it('offers a free retry for an off-topic run, using the same retry request as Deep Research', async () => {
    // Seen in real data: the run ended "SearchesExhausted", then the session was marked off-topic.
    api.evidencePackage.mockResolvedValue({ ...PACKAGE, sessionId: 's2', completionReason: 'SearchesExhausted' })
    const user = await renderPage('/app/web-library/packages?session=s2')
    const retry = await screen.findByRole('button', { name: /Retry for free/ })
    expect(screen.getByText(/rephrase the question/)).toBeTruthy()
    expect(screen.getByText(/Most searches returned papers about a different subject/)).toBeTruthy()
    expect(screen.queryByText(/Every search was tried/)).toBeNull()
    await user.click(retry)
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ retryOfSessionId: 's2', depth: 'standard', projectId: 'p1' }))
  })

  it('on a narrow screen shows the open package alone, with a way back to the list', async () => {
    const user = await renderPage('/app/web-library/packages?session=s3')
    await screen.findByText('1 of 2')
    const list = screen.getByText('2 packages from 4 sessions').closest('aside')!
    expect(list.className).toMatch(/(^|\s)hidden(\s|$)/)
    await user.click(screen.getByRole('button', { name: /Back to packages/ }))
    expect(list.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    expect(screen.getByText('Select a package to see its findings, sources and coverage.').closest('main')!.className).toMatch(/(^|\s)hidden(\s|$)/)
  })

  it('a running session says so and the list auto-updates instead of a Refresh button', async () => {
    api.list.mockResolvedValue([summary({ id: 'r1', status: 'Running', isFinished: false })])
    await renderPage('/app/web-library/packages?session=r1')
    expect(screen.getByText('Updating while research runs…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
    expect(screen.getByRole('link', { name: /Watch it in Deep Research/ })).toBeTruthy()
    expect(api.evidencePackage).not.toHaveBeenCalled()
  })
})
