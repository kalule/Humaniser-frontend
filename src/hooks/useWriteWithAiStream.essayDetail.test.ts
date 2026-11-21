// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { WriteWithAiRequest } from '../types/workbench'

const fetchWithAuth = vi.fn()
vi.mock('../lib/fetchWithAuth', () => ({ fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args) }))

const { useWriteWithAiStream } = await import('./useWriteWithAiStream')

/** A fetch response whose body yields the given SSE frames, one chunk each. */
function streamOf(frames: unknown[]) {
  const chunks = frames.map(f => new TextEncoder().encode(`data: ${JSON.stringify(f)}\n\n`))
  let i = 0
  return {
    ok: true,
    status: 200,
    body: { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }) }) },
  }
}

const request = { documentType: 'Essay', topic: 'Do four-day weeks reduce burnout?' } as unknown as WriteWithAiRequest
const result = { title: 'T', content: 'Body', wordCount: 1 }

afterEach(() => { fetchWithAuth.mockReset() })

describe('useWriteWithAiStream essay detail frames', () => {
  it('passes parts and coverage to onEssayDetail and ignores unknown frames', async () => {
    fetchWithAuth.mockResolvedValue(streamOf([
      { projectId: 'run-1' },
      { stage: 'planning-question' },
      { parts: [{ id: 'C1', label: 'Burnout' }, { id: 'C2', label: 'Productivity' }] },
      { futureFrame: true },
      { stage: 'assessing-evidence:12' },
      { coverage: [{ id: 'C1', state: 'supported' }, { id: 'C2', state: 'whatever' }] },
      { result },
    ]))
    const details: unknown[] = []
    const { result: hook } = renderHook(() => useWriteWithAiStream())
    let out: unknown
    await act(async () => {
      out = await hook.current.generate(request, undefined, undefined, undefined, undefined, undefined, d => details.push(d))
    })
    expect(out).toEqual(result)
    expect(details).toEqual([
      { parts: [{ id: 'C1', label: 'Burnout' }, { id: 'C2', label: 'Productivity' }] },
      { coverage: [{ id: 'C1', state: 'supported' }, { id: 'C2', state: 'unknown' }] },
    ])
  })

  it('works without the new frames or the new callback (older server, older caller)', async () => {
    fetchWithAuth.mockResolvedValue(streamOf([{ stage: 'planning-question' }, { parts: [{ id: 'C1', label: 'A' }] }, { result }]))
    const { result: hook } = renderHook(() => useWriteWithAiStream())
    let out: unknown
    await act(async () => { out = await hook.current.generate(request) })
    expect(out).toEqual(result)
  })

  it('a throwing onEssayDetail does not break the stream', async () => {
    fetchWithAuth.mockResolvedValue(streamOf([{ parts: [{ id: 'C1', label: 'A' }] }, { result }]))
    const { result: hook } = renderHook(() => useWriteWithAiStream())
    let out: unknown
    await act(async () => {
      out = await hook.current.generate(request, undefined, undefined, undefined, undefined, undefined, () => { throw new Error('ui bug') })
    })
    expect(out).toEqual(result)
  })
})
