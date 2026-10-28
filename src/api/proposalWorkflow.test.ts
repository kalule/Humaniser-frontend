import { beforeEach, describe, expect, it, vi } from 'vitest'
import client from './client'
import { proposalWorkflowApi as api } from './proposalWorkflow'

vi.mock('./client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../lib/utils', () => ({ downloadBlob: vi.fn() }))
describe('proposal workflow API contracts', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(client.post).mockResolvedValue({ data: {} }); vi.mocked(client.get).mockResolvedValue({ data: {} }) })
  it('returns the workflow already unwrapped by the shared client', async () => {
    const state = { accepted: null, fingerprint: 'current' }
    vi.mocked(client.get).mockResolvedValue({ data: state })
    expect(await api.state('project')).toBe(state)
  })
  it('pins generation to the read content version and caller retry key', async () => {
    await api.generate('project', '5.7a', 'content-version', 'retry-key')
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/generate', { sectionCode: '5.7a', expectedContentVersion: 'content-version', idempotencyKey: 'retry-key' }, { timeout: 180_000 })
  })
  it('pins canonical generation to the accepted revision and requires explicit replacement', async () => {
    await api.generate('project', '5.7a', 'version', 'key', 'revision', true)
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/generate', { sectionCode: '5.7a', expectedContentVersion: 'version', idempotencyKey: 'key', expectedSpecificationRevision: 'revision', replaceExistingContent: true }, { timeout: 180_000 })
  })
  it('reads readiness without issuing a generation command', async () => {
    const signal = new AbortController().signal
    await api.readiness('project', signal)
    expect(client.get).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/readiness', { signal })
    expect(client.post).not.toHaveBeenCalled()
  })
  it('requires expected old and current revisions for explicit design adoption', async () => {
    await api.bindDesign('project', 'new', 'old', 'same-key')
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/design-binding', { expectedRevisionId: 'new', expectedBoundRevisionId: 'old', idempotencyKey: 'same-key' })
  })
  it('requests a version-bound repair preview without saving a section', async () => {
    await api.repairPreview('project', '5.7a', 'revision', 'version')
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/sections/repair-preview', { sectionCode: '5.7a', expectedRevisionId: 'revision', expectedContentVersion: 'version' })
  })
  it('pins explicit reconciliation to the accepted revision and retry key', async () => {
    await api.reconcileSection('project', '1.0', 'version', 'Student content', ['evidence'], 'revision', 'key')
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/sections/reconcile', { sectionCode: '1.0', expectedContentVersion: 'version', content: 'Student content', evidenceIds: ['evidence'], expectedSpecificationRevision: 'revision', idempotencyKey: 'key' })
  })
  it('requires finalization to evaluate the fingerprint the user reviewed', async () => {
    await api.finalize('project', 'reviewed-fingerprint')
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/finalize', { expectedFingerprint: 'reviewed-fingerprint' })
  })
  it('preserves exact passage offsets and whitespace without declaring support', async () => {
    const request = { sectionCode: '1.0', claim: 'An exact claim.', literatureId: 'source', coverage: 'FullText', start: 73, length: 12, quote: 'A\n passage. ', purpose: 'Support' }
    await api.evidence('project', request)
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/evidence', request, { timeout: 120_000 })
    expect(request).not.toHaveProperty('status')
  })
  it('preserves blockers rather than proceeding to download', async () => {
    const blocker = new Error('A stale review blocks finalization')
    vi.mocked(client.post).mockRejectedValue(blocker)
    await expect(api.finalize('project', 'stale-fingerprint')).rejects.toBe(blocker)
    expect(client.get).not.toHaveBeenCalled()
  })
  it('pins researcher edits to the loaded version and explicit claim bindings', async () => {
    await api.reconcileSection('project', '1.0', 'loaded-version', 'Revised content', ['exact-evidence'])
    expect(client.post).toHaveBeenCalledWith('/api/v1/research/projects/project/proposal-workflow/sections/reconcile', { sectionCode: '1.0', expectedContentVersion: 'loaded-version', content: 'Revised content', evidenceIds: ['exact-evidence'] })
  })
})
