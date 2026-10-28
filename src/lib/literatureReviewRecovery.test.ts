import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PENDING_MAX_AGE_MS, clearPendingGeneration, interpretOutcome, loadPendingGeneration, savePendingGeneration,
} from './literatureReviewRecovery'
import { parseWriteWithAiSseFrames } from '../hooks/useWriteWithAiStream'

describe('pending generation marker', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })

  it('round-trips and clears', () => {
    savePendingGeneration('doc1', { projectId: 'p1', startedAt: 1000, citationStyle: 'Apa7' })
    expect(loadPendingGeneration('doc1', 2000)).toEqual({ projectId: 'p1', startedAt: 1000, citationStyle: 'Apa7' })
    clearPendingGeneration('doc1')
    expect(loadPendingGeneration('doc1', 2000)).toBeNull()
  })

  it('drops a marker too old to collect', () => {
    savePendingGeneration('doc1', { projectId: 'p1', startedAt: 0, citationStyle: 'Harvard' })
    expect(loadPendingGeneration('doc1', PENDING_MAX_AGE_MS + 1)).toBeNull()
    expect(localStorage.getItem('literatureReview.pending.doc1')).toBeNull()
  })

  it('ignores a corrupt marker', () => {
    localStorage.setItem('literatureReview.pending.doc1', '{not json')
    expect(loadPendingGeneration('doc1')).toBeNull()
  })
})

describe('interpretOutcome', () => {
  it('reports a still-running job with its stage', () => {
    expect(interpretOutcome({ status: 'pending', stage: 'retrieving' })).toEqual({ status: 'pending', stage: 'retrieving' })
  })

  it('extracts the result from the stored frame', () => {
    const frame = JSON.stringify({ result: { title: 'T', content: 'c', isLiteratureReview: true } })
    const out = interpretOutcome({ status: 'complete', frame })
    expect(out.status).toBe('complete')
    if (out.status === 'complete') expect(out.result.title).toBe('T')
  })

  it('surfaces a stored error as a failure', () => {
    expect(interpretOutcome({ status: 'complete', frame: JSON.stringify({ error: 'boom' }) })).toEqual({ status: 'failed', message: 'boom' })
  })

  it('treats anything else as unavailable', () => {
    expect(interpretOutcome(null)).toEqual({ status: 'unavailable' })
    expect(interpretOutcome({ status: 'complete' })).toEqual({ status: 'unavailable' })
  })
})

describe('stream frames added for recovery', () => {
  it('parses the project id frame and the recoverable flag', () => {
    const { events } = parseWriteWithAiSseFrames('', 'data: {"projectId":"p1"}\n\ndata: {"error":"slow","recoverable":true}\n\n')
    expect(events).toEqual([{ projectId: 'p1' }, { error: 'slow', recoverable: true }])
  })
})
