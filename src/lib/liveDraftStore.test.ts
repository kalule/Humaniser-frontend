// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const fetchWithAuth = vi.fn()
vi.mock('./fetchWithAuth', () => ({ fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args) }))

const { FLUSH_MS, followDraft, forgetDraft, parseDraftFrames, resetLiveDrafts, useLiveDraft } = await import('./liveDraftStore')

/** A controllable SSE body: push frames, then end it cleanly or break it. */
function sseBody() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c } })
  const enc = new TextEncoder()
  return {
    response: new Response(body, { status: 200 }),
    send: (frame: object) => controller.enqueue(enc.encode(`data: ${JSON.stringify(frame)}\n\n`)),
    end: () => controller.close(),
    fail: () => controller.error(new Error('network')),
  }
}

beforeEach(() => { vi.useFakeTimers(); fetchWithAuth.mockReset() })
afterEach(() => { resetLiveDrafts(); vi.useRealTimers() })

const tick = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('parseDraftFrames', () => {
  it('reads text and activity frames and carries a split frame over', () => {
    const a = parseDraftFrames('', 'data: {"activity":"Read 6 sources","sourcesRead":6}\n\ndata: {"delta":"Hel')
    expect(a.frames).toEqual([{ activity: 'Read 6 sources', sourcesRead: 6 }])
    const b = parseDraftFrames(a.remainder, 'lo"}\n\n')
    expect(b.frames).toEqual([{ delta: 'Hello' }])
  })
})

describe('live drafts', () => {
  it('publishes streamed text in batches, not once per token', async () => {
    const stream = sseBody()
    fetchWithAuth.mockResolvedValue(stream.response)
    let renders = 0
    const { result } = renderHook(() => { renders++; return useLiveDraft('p', '3.3') })
    followDraft('p', '3.3')
    await tick()
    const before = renders
    for (let i = 0; i < 50; i++) stream.send({ delta: 'word ' })
    await tick(FLUSH_MS)
    expect(result.current.words).toBe(50)
    expect(renders - before).toBeLessThanOrEqual(3)
  })

  it('records sources read and marks the end of the text stream', async () => {
    const stream = sseBody()
    fetchWithAuth.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useLiveDraft('p', '3.3'))
    followDraft('p', '3.3')
    await tick()
    stream.send({ activity: 'Read 6 sources', sourcesRead: 6 })
    stream.send({ delta: 'Purposive sampling is used.' })
    stream.end()
    await tick(FLUSH_MS)
    expect(result.current).toMatchObject({ text: 'Purposive sampling is used.', sourcesRead: 6, activities: ['Read 6 sources'], streamEnded: true })
  })

  it('reconnects after a dropped connection and replaces the text with the server catch-up', async () => {
    const first = sseBody(), second = sseBody()
    fetchWithAuth.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response)
    const { result } = renderHook(() => useLiveDraft('p', '3.3'))
    followDraft('p', '3.3')
    await tick()
    first.send({ delta: 'Partial ' })
    await tick(FLUSH_MS)
    first.fail()
    await tick(2000)
    second.send({ delta: 'Partial text continues.' })
    await tick(FLUSH_MS)
    expect(fetchWithAuth).toHaveBeenCalledTimes(2)
    expect(result.current.text).toBe('Partial text continues.')
    expect(result.current.streamEnded).toBe(false)
  })

  it('keeps asking while the server has nothing to stream yet (204), then streams', async () => {
    const stream = sseBody()
    fetchWithAuth.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(stream.response)
    const { result } = renderHook(() => useLiveDraft('p', '3.3'))
    followDraft('p', '3.3')
    await tick()
    expect(result.current.streamEnded).toBe(false)
    await tick(1500)
    stream.send({ delta: 'Now it streams.' })
    await tick(FLUSH_MS)
    expect(fetchWithAuth).toHaveBeenCalledTimes(2)
    expect(result.current.text).toBe('Now it streams.')
  })

  it('stops asking once the section is no longer followed', async () => {
    fetchWithAuth.mockResolvedValue(new Response(null, { status: 204 }))
    followDraft('p', '3.3')
    await tick()
    forgetDraft('p', '3.3')
    await tick(10_000)
    expect(fetchWithAuth).toHaveBeenCalledTimes(1)
  })

  it('forgets a finished draft so the next run starts clean', async () => {
    const stream = sseBody()
    fetchWithAuth.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useLiveDraft('p', '3.3'))
    followDraft('p', '3.3')
    await tick()
    stream.send({ delta: 'Old run.' })
    await tick(FLUSH_MS)
    act(() => forgetDraft('p', '3.3'))
    expect(result.current.text).toBe('')
  })

  it('keeps sections separate', async () => {
    const a = sseBody(), b = sseBody()
    fetchWithAuth.mockResolvedValueOnce(a.response).mockResolvedValueOnce(b.response)
    let otherRenders = 0
    renderHook(() => { otherRenders++; return useLiveDraft('p', '3.4') })
    followDraft('p', '3.3')
    await tick()
    const before = otherRenders
    a.send({ delta: 'Only 3.3 changes.' })
    await tick(FLUSH_MS)
    expect(otherRenders).toBe(before)
  })
})
