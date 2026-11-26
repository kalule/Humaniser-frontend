// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Review, ScreeningItem, ScreeningList } from '../../lib/literatureReview'

const item = (n: number, extra: Partial<ScreeningItem> = {}): ScreeningItem => ({
  candidateId: `c${n}`, title: `Paper ${n}`, authors: 'Okello, P.', year: '2023', journal: 'J', doi: '', abstract: '', foundVia: ['openalex'],
  state: 'Included', reasonCode: null, reasonLabel: null, explanation: `AI reason ${n}.`, studentNote: null, relevanceScore: 70, topicMatchScore: 40,
  evidenceLevel: 'AbstractOnly', hasFullText: false, inPool: true, source: 'openalex', citations: 0, aiVerdict: 'Relevant', aiReason: `AI reason ${n}.`,
  removedFromReview: false, ...extra,
})

const counts = { NotScreened: 0, Included: 30, AwaitingFullText: 0, PotentiallyRelevant: 0, NotRelevant: 0, Excluded: 0, UnableToAssess: 0 }
const list = (bulkScreening: boolean): ScreeningList => ({
  items: Array.from({ length: 3 }, (_, i) => item(i + 1)), totalCount: 30, page: 1, pageSize: 25, stateCounts: counts, overallCounts: counts,
  screeningStatus: 'Completed', screeningProgressPct: 100, canApprove: true, databases: ['openalex'], bulkScreening,
  matchingIds: bulkScreening ? Array.from({ length: 30 }, (_, i) => `c${i + 1}`) : null,
})

const api = {
  screening: vi.fn(),
  reasons: vi.fn().mockResolvedValue([{ code: 'TOPIC', label: 'Not about the topic' }, { code: 'OTHER', label: 'Other reason' }, { code: 'NEEDS_FULLTEXT', label: 'Need full text' }]),
  bulkDecide: vi.fn().mockResolvedValue({ batchId: 'b1', changed: 30, unchanged: 0, leftReview: 30, returnedToReview: 0 }),
  undoBulk: vi.fn().mockResolvedValue({ restored: 30, skipped: 0 }),
  extraction: vi.fn().mockResolvedValue({ matrixAvailable: false }),
  decide: vi.fn(), approve: vi.fn(), exclusions: vi.fn(),
  // The source check (server flag off): renders nothing.
  sourceCheck: vi.fn().mockResolvedValue({ enabled: false }),
}
vi.mock('../../api/literatureReview', () => ({ literatureReviewApi: api }))
vi.mock('../../api/literatureMatrix', () => ({ literatureMatrixApi: {} }))
vi.mock('../../api/research', () => ({ researchApi: {} }))

const { ScreenStep } = await import('./ScreenStep')

afterEach(() => { cleanup(); vi.clearAllMocks() })

const review = { id: 'r1', researchProjectId: 'p1', sourceCount: 30 } as unknown as Review
const renderStep = (url = '/app/literature-review/r1?step=screen') =>
  render(<MemoryRouter initialEntries={[url]}><ScreenStep review={review} onChanged={() => {}} onNext={() => {}} /></MemoryRouter>)

describe('Screen step bulk screening', () => {
  it('selects every paper in the view, excludes them with one reason and offers Undo', async () => {
    api.screening.mockResolvedValue(list(true))
    renderStep()
    fireEvent.click(await screen.findByRole('button', { name: 'Select all in this view (30)' }))
    const bar = screen.getByRole('region', { name: 'Bulk actions' })
    expect(within(bar).getByText('30 selected')).toBeTruthy()

    fireEvent.click(within(bar).getByRole('button', { name: 'Exclude…' }))
    const dialog = screen.getByRole('dialog', { name: 'Exclude 30 papers' })
    const confirm = within(dialog).getByRole('button', { name: 'Exclude 30' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(within(dialog).queryByLabelText('Need full text')).toBeNull()
    fireEvent.click(within(dialog).getByLabelText('Other reason'))
    expect(confirm.disabled).toBe(true)   // "Other" needs a few words
    fireEvent.change(within(dialog).getByLabelText('Say what the reason is (required)'), { target: { value: 'Conference abstract' } })
    fireEvent.click(confirm)

    await waitFor(() => expect(api.bulkDecide).toHaveBeenCalledWith('r1', {
      candidateIds: Array.from({ length: 30 }, (_, i) => `c${i + 1}`), decision: 'exclude', reasonCode: 'OTHER', note: 'Conference abstract',
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(api.undoBulk).toHaveBeenCalledWith('r1', 'b1'))
    expect(await screen.findByText(/Undone: 30 papers restored/)).toBeTruthy()
  })

  it('keeps the selection and says nothing changed when a bulk action fails', async () => {
    api.screening.mockResolvedValue(list(true))
    api.bulkDecide.mockRejectedValueOnce(new Error('network'))
    renderStep()
    fireEvent.click(await screen.findByLabelText('Select Paper 1'))
    fireEvent.click(within(screen.getByRole('region', { name: 'Bulk actions' })).getByRole('button', { name: 'Include' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  it('selects a range with Shift+click', async () => {
    api.screening.mockResolvedValue(list(true))
    renderStep()
    fireEvent.click(await screen.findByLabelText('Select Paper 1'))
    fireEvent.click(screen.getByLabelText('Select Paper 3'), { shiftKey: true })
    expect(screen.getByText('3 selected')).toBeTruthy()
  })

  it('says an exclusion reason once and shows the reviewer note', async () => {
    api.screening.mockResolvedValue({ ...list(true), items: [item(1, { state: 'Excluded', reasonCode: 'OPINION', reasonLabel: 'Opinion piece or editorial', explanation: 'Opinion piece or editorial', studentNote: 'An editorial' })] })
    renderStep()
    const text = (await screen.findByText(/Note: An editorial/)).closest('p')!.textContent
    expect(text).toBe('Opinion piece or editorial. Note: An editorial')
  })

  it('shows no checkboxes or bulk controls while the flag is off', async () => {
    api.screening.mockResolvedValue(list(false))
    renderStep()
    await screen.findByText('Paper 1')
    expect(screen.queryByLabelText('Select Paper 1')).toBeNull()
    expect(screen.queryByRole('button', { name: /Select all in this view/ })).toBeNull()
  })

  it('keeps both filters when two change before the page re-renders', async () => {
    api.screening.mockResolvedValue(list(false))
    renderStep()
    await screen.findByText('Paper 1')
    act(() => {
      fireEvent.change(screen.getByLabelText('Abstract', { selector: 'select' }), { target: { value: 'no' } })
      fireEvent.change(screen.getByLabelText('AI verdict', { selector: 'select' }), { target: { value: 'Uncertain' } })
    })
    await waitFor(() => expect(api.screening).toHaveBeenLastCalledWith('r1', { page: 1, pageSize: 25, hasAbstract: false, verdict: 'Uncertain' }, expect.anything()))
  })

  it('reads the search and filters from the URL and sends them to the server', async () => {
    api.screening.mockResolvedValue(list(false))
    renderStep('/app/literature-review/r1?step=screen&q=hallucination&abstract=no&sort=year&page=2')
    await screen.findByText('Paper 1')
    expect(api.screening).toHaveBeenCalledWith('r1', { page: 2, pageSize: 25, search: 'hallucination', hasAbstract: false, sort: 'year' }, expect.anything())
    expect((screen.getByLabelText(/Search titles, authors/) as HTMLInputElement).value).toBe('hallucination')
  })
})
