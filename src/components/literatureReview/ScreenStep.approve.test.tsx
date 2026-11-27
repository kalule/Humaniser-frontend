// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Review, ScreeningList } from '../../lib/literatureReview'

const counts = { NotScreened: 0, Included: 1, AwaitingFullText: 0, PotentiallyRelevant: 2, NotRelevant: 0, Excluded: 0, UnableToAssess: 0, Suggested: 0 }
const list: ScreeningList = {
  items: [], totalCount: 0, page: 1, pageSize: 25, stateCounts: counts, overallCounts: counts,
  screeningStatus: 'Completed', screeningProgressPct: 100, canApprove: true, databases: ['openalex'], bulkScreening: false, matchingIds: null,
}

const api = {
  screening: vi.fn().mockResolvedValue(list),
  reasons: vi.fn().mockResolvedValue([]),
  extraction: vi.fn().mockResolvedValue({ matrixAvailable: false }),
  approve: vi.fn(),
  decide: vi.fn(), exclusions: vi.fn(), bulkDecide: vi.fn(), undoBulk: vi.fn(), acceptSuggestions: vi.fn(),
}
vi.mock('../../api/literatureReview', () => ({ literatureReviewApi: api }))
vi.mock('../../api/literatureMatrix', () => ({ literatureMatrixApi: {} }))
vi.mock('../../api/research', () => ({ researchApi: {} }))

const { ScreenStep } = await import('./ScreenStep')

afterEach(() => { cleanup(); vi.clearAllMocks() })

const review = { id: 'r1', researchProjectId: 'p1', sourceCount: 1 } as unknown as Review

describe('Screen step approval with undecided records', () => {
  it('explains the refusal and excludes the undecided records as not enough information on request', async () => {
    api.approve
      .mockRejectedValueOnce({ code: 'ERROR', serverCode: 'UNRESOLVED_RECORDS', message: '2 records could not be judged from the title and abstract. Decide each one, or exclude them as "not enough information to judge" and approve.' })
      .mockResolvedValueOnce({ addedToPool: 1, excludedForDateRange: 0, poolSize: 1, status: 'Extracting', excludedUnresolved: 2 })
    render(<MemoryRouter initialEntries={['/app/literature-review/r1?step=screen']}><ScreenStep review={review} onChanged={() => {}} onNext={() => {}} /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Add the included papers to the review' }))
    expect(await screen.findByText(/2 records could not be judged/)).toBeTruthy()
    expect(api.approve).toHaveBeenLastCalledWith('r1', false, false)

    fireEvent.click(screen.getByRole('button', { name: 'Exclude them as not enough information, and add the papers' }))
    await waitFor(() => expect(api.approve).toHaveBeenLastCalledWith('r1', false, true))
    expect(await screen.findByText(/2 that could not be judged were excluded as not enough information/)).toBeTruthy()
    expect(screen.queryByText(/2 records could not be judged/)).toBeNull()
  })

  it('lets the reviewer go back and decide the records', async () => {
    api.approve.mockRejectedValueOnce({ code: 'ERROR', serverCode: 'UNRESOLVED_RECORDS', message: '1 record could not be judged from the title and abstract.' })
    render(<MemoryRouter initialEntries={['/app/literature-review/r1?step=screen']}><ScreenStep review={review} onChanged={() => {}} onNext={() => {}} /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Add the included papers to the review' }))
    fireEvent.click(await screen.findByRole('button', { name: 'I will decide them myself' }))
    expect(screen.queryByText(/1 record could not be judged/)).toBeNull()
    expect(api.approve).toHaveBeenCalledTimes(1)
  })
})
