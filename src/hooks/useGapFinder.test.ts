// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ get: vi.fn(), listForProject: vi.fn() }))
vi.mock('../api/gapFinder', () => ({ gapFinderApi: { get: mocks.get, listForProject: mocks.listForProject } }))

const { useGapFinder, nextPollDelayMs, POLL_INITIAL_MS, POLL_MAX_MS, POLL_MAX_CONSECUTIVE_FAILURES } = await import('./useGapFinder')

const runningRun = { id: 'run-1', status: 'running', stage: 'retrieval' }

/** Lets pending promise callbacks run, then advances fake time by `ms`. */
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('gap finder progress polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.get.mockReset()
    mocks.listForProject.mockReset()
    mocks.listForProject.mockResolvedValue([runningRun])
  })
  afterEach(() => { vi.useRealTimers() })

  it('backs off from 1.5 s to a 10 s ceiling', () => {
    expect(nextPollDelayMs(0)).toBe(POLL_INITIAL_MS)
    const delays = Array.from({ length: 10 }, (_, i) => nextPollDelayMs(i))
    for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
    expect(delays[1]).toBeGreaterThan(delays[0])
    expect(Math.max(...delays)).toBe(POLL_MAX_MS)
  })

  it('gives up after repeated failures and shows the retry state instead of polling forever', async () => {
    mocks.get.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useGapFinder('project-1'))
    await advance(0) // restore the running run

    await advance(10 * 60_000)

    expect(result.current.pollStalled).toBe(true)
    expect(result.current.error).toContain('could not check')
    expect(mocks.get).toHaveBeenCalledTimes(POLL_MAX_CONSECUTIVE_FAILURES)

    await advance(10 * 60_000)
    expect(mocks.get).toHaveBeenCalledTimes(POLL_MAX_CONSECUTIVE_FAILURES) // stopped
  })

  it('checks again when the student retries', async () => {
    mocks.get.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useGapFinder('project-1'))
    await advance(0)
    await advance(10 * 60_000)
    expect(result.current.pollStalled).toBe(true)

    mocks.get.mockResolvedValue({ ...runningRun, status: 'completed' })
    act(() => result.current.resumePolling())
    await advance(POLL_INITIAL_MS)

    expect(result.current.pollStalled).toBe(false)
    expect(result.current.run?.status).toBe('completed')
  })

  it('polls less often as the run goes on', async () => {
    mocks.get.mockResolvedValue(runningRun)
    renderHook(() => useGapFinder('project-1'))
    await advance(0)

    await advance(POLL_INITIAL_MS)
    expect(mocks.get).toHaveBeenCalledTimes(1)
    // The second check waits longer than the first.
    await advance(POLL_INITIAL_MS)
    expect(mocks.get).toHaveBeenCalledTimes(1)
    await advance(nextPollDelayMs(1) - POLL_INITIAL_MS)
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })
})
