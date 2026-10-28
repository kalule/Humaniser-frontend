import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('./client', () => ({ default: mock }))
import { proposalJourneyApi as api } from './proposalJourney'
beforeEach(() => { mock.get.mockReset().mockResolvedValue({ data: [] }); mock.post.mockReset().mockResolvedValue({ data: { summary: { allowedActions: [] } } }) })
describe('owned proposal journey API', () => {
  it('loads all rows with one request and cancellation', async () => { const signal = new AbortController().signal; await api.list(signal); expect(mock.get).toHaveBeenCalledOnce(); expect(mock.get).toHaveBeenCalledWith('/api/v1/research/proposal-journeys', { signal }) })
  it('reads project state without issuing a generation command', async () => { mock.get.mockResolvedValueOnce({ data: { summary: { allowedActions: [] } } }); await api.current('p'); expect(mock.get).toHaveBeenCalledWith('/api/v1/research/proposal-journeys/p', { signal: undefined }); expect(mock.post).not.toHaveBeenCalled() })
  it.each(['Guided','FirstDraft'] as const)('pins %s to the accepted revision and retry key', async mode => { await api.writing('p', mode, 'revision', 'key'); expect(mock.post).toHaveBeenCalledWith('/api/v1/research/proposal-journeys/p/writing-experience', { mode, expectedRevisionId: 'revision', idempotencyKey: 'key' }) })
  it('rejects missing or failed projections instead of showing success', async () => { mock.get.mockResolvedValue({ data: { success: false, data: [] } }); await expect(api.list()).rejects.toThrow(); mock.get.mockResolvedValue({ data: null }); await expect(api.current('p')).rejects.toThrow() })
})
