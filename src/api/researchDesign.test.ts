import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('./client', () => ({ default: mock }))
import { researchDesignApi as api } from './researchDesign'
beforeEach(() => { mock.get.mockReset().mockResolvedValue({ data: 'view' }); mock.post.mockReset().mockResolvedValue({ data: 'result' }) })
describe('Phase 6 Research Design API client', () => {
  it('uses the existing v1 API and abort signal', async () => { const signal = new AbortController().signal; expect(await api.current('p', signal)).toBe('view'); expect(mock.get).toHaveBeenCalledWith('/api/v1/research/projects/p/design', { signal }) })
  it('sends only acceptance identifiers with the original idempotency key', async () => { const command = { idempotencyKey: 'key', expectedVersion: 'version', expectedSpecificationRevision: 'revision' }; await api.accept('p', 'r', command); expect(mock.post).toHaveBeenCalledWith('/api/v1/research/projects/p/design/runs/r/accept', command) })
  it('submits typed access confirmations without arbitrary patches', async () => { const command = { idempotencyKey: 'key', expectedVersion: 'v', questionId: 'q', value: { populationAccess: false, dataAvailable: true, permissionsResolved: false } }; await api.input('p', 'r', command); expect(mock.post.mock.calls[0][1]).toEqual(command) })
  it('uses revision endpoint for restart and bounded lazy history', async () => { await api.revise('p', 'r', { idempotencyKey: 'k', expectedVersion: 'v', expectedSpecificationRevision: null }); await api.history('p', 'cursor'); expect(mock.post.mock.calls[0][0]).toContain('/revisions'); expect(mock.get.mock.calls[0][1].params).toEqual({ take: 20, cursor: 'cursor' }) })
})
