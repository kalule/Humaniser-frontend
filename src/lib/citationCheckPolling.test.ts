import { describe, expect, it } from 'vitest'
import type { CitationCheckReport } from '../types/citationCheck'
import { abortableSleep, LOST_TOUCH_MESSAGE, MAX_TRANSIENT_FAILURES, pollDelayMs, pollUntilDone, type PollDeps } from './citationCheckPolling'

const report = (status: string, o: Partial<CitationCheckReport> = {}): CitationCheckReport => ({
  runId: 'r', status, stage: status === 'Completed' ? 'Done' : 'Judging', citationCount: 4, citationsDone: 0, limitReached: false, fullCheckLimit: null,
  error: null, warnings: [], unusedReferences: [],
  summary: { total: 4, checked: 0, supported: 0, partiallySupported: 0, notSupported: 0, contradicted: 0, cannotVerify: 0, locked: 0, integrityScore: null, orphanCitations: 0, ambiguousCitations: 0, unusedReferences: 0, sourcesNotFound: 0, metadataMismatches: 0 },
  cards: [], createdAt: '', deleteAfter: '', ...o,
})

type Step = CitationCheckReport | null | Error

function harness(steps: Step[], controller = new AbortController()) {
  const delays: number[] = []
  const updates: CitationCheckReport[] = []
  let calls = 0
  const deps: PollDeps = {
    fetchReport: async () => {
      const step = steps[Math.min(calls++, steps.length - 1)]
      if (step instanceof Error) throw step
      return step
    },
    sleep: async (ms) => { delays.push(ms) },
    onUpdate: (r) => updates.push(r),
  }
  return { deps, delays, updates, controller, calls: () => calls }
}

describe('pollUntilDone', () => {
  it('returns at once when the run has already finished', async () => {
    const h = harness([report('Completed')])
    const outcome = await pollUntilDone(h.deps, h.controller.signal)
    expect(outcome.kind).toBe('done')
    expect(h.delays).toEqual([])           // no pointless wait after the answer
    expect(h.updates).toHaveLength(1)
  })

  it('reports every intermediate result so partial findings appear as they arrive', async () => {
    const h = harness([report('Queued'), report('Running', { citationsDone: 1 }), report('Running', { citationsDone: 3 }), report('Completed', { citationsDone: 4 })])
    const outcome = await pollUntilDone(h.deps, h.controller.signal)
    expect(outcome).toMatchObject({ kind: 'done', report: { citationsDone: 4 } })
    expect(h.updates.map(u => u.citationsDone)).toEqual([0, 1, 3, 4])
    expect(h.delays).toHaveLength(3)
  })

  it('treats a Failed run as finished, not as an error: the report carries the reason', async () => {
    const h = harness([report('Failed', { error: 'The draft has too many citations.' })])
    const outcome = await pollUntilDone(h.deps, h.controller.signal)
    expect(outcome).toMatchObject({ kind: 'done', report: { status: 'Failed', error: 'The draft has too many citations.' } })
  })

  it('stops with "gone" when the server no longer has the run', async () => {
    const h = harness([report('Running'), null])
    expect(await pollUntilDone(h.deps, h.controller.signal)).toEqual({ kind: 'gone' })
    expect(h.updates).toHaveLength(1)
  })

  it('stops with "gone" immediately when the very first lookup finds nothing (a stale remembered run)', async () => {
    const h = harness([null])
    expect(await pollUntilDone(h.deps, h.controller.signal)).toEqual({ kind: 'gone' })
    expect(h.updates).toHaveLength(0)
  })

  it('survives a dropped request and carries on', async () => {
    const h = harness([report('Running'), new Error('network'), report('Completed')])
    const outcome = await pollUntilDone(h.deps, h.controller.signal)
    expect(outcome.kind).toBe('done')
    expect(h.delays[1]).toBe(2000)   // the first retry backs off
  })

  it('resets the failure count after a success, so scattered blips never add up to giving up', async () => {
    const blips: Step[] = []
    for (let i = 0; i < MAX_TRANSIENT_FAILURES * 2; i++) blips.push(new Error('blip'), report('Running'))
    blips.push(report('Completed'))
    const h = harness(blips)
    expect((await pollUntilDone(h.deps, h.controller.signal)).kind).toBe('done')
  })

  it('gives up after repeated failures with a message that says the check may still be running', async () => {
    const h = harness([report('Running'), new Error('down')])
    const outcome = await pollUntilDone(h.deps, h.controller.signal)
    expect(outcome).toEqual({ kind: 'error', message: LOST_TOUCH_MESSAGE })
    expect(LOST_TOUCH_MESSAGE).toMatch(/may still be running/)
    expect(h.calls()).toBe(1 + MAX_TRANSIENT_FAILURES + 1)
  })

  it('backs off between failures, with a ceiling', async () => {
    const h = harness([new Error('down')])
    await pollUntilDone(h.deps, h.controller.signal)
    expect(h.delays).toEqual([2000, 4000, 8000, 15000, 15000])
  })

  it('stops when the caller aborts during a wait', async () => {
    const controller = new AbortController()
    const h = harness([report('Running')], controller)
    h.deps.sleep = async () => { controller.abort() }
    expect(await pollUntilDone(h.deps, controller.signal)).toEqual({ kind: 'aborted' })
    expect(h.calls()).toBe(1)
  })

  it('does not even ask if it was aborted before it began', async () => {
    const controller = new AbortController()
    controller.abort()
    const h = harness([report('Completed')], controller)
    expect(await pollUntilDone(h.deps, controller.signal)).toEqual({ kind: 'aborted' })
    expect(h.calls()).toBe(0)
  })

  it('discards an answer that arrives after the caller aborted, instead of updating a page that has moved on', async () => {
    const controller = new AbortController()
    const h = harness([report('Running')], controller)
    h.deps.fetchReport = async () => { controller.abort(); return report('Completed') }
    expect(await pollUntilDone(h.deps, controller.signal)).toEqual({ kind: 'aborted' })
    expect(h.updates).toHaveLength(0)
  })

  it('does not report a failure as an error when the abort is what caused it', async () => {
    const controller = new AbortController()
    const h = harness([report('Running')], controller)
    h.deps.fetchReport = async () => { controller.abort(); throw new Error('cancelled') }
    expect(await pollUntilDone(h.deps, controller.signal)).toEqual({ kind: 'aborted' })
  })
})

describe('pollDelayMs', () => {
  it('is quick at first, slower for a long run, and slower still while merely queued', () => {
    expect(pollDelayMs(0, 'Running')).toBe(1500)
    expect(pollDelayMs(0, 'Queued')).toBe(2500)
    expect(pollDelayMs(10, 'Running')).toBe(3000)
    expect(pollDelayMs(40, 'Running')).toBe(5000)
    expect(pollDelayMs(500, 'Queued')).toBe(5000)
  })

  it('never gets faster as time goes on', () => {
    const delays = Array.from({ length: 60 }, (_, i) => pollDelayMs(i, 'Running'))
    expect([...delays].sort((a, b) => a - b)).toEqual(delays)
  })
})

describe('abortableSleep', () => {
  it('waits the full time when not aborted', async () => {
    const started = Date.now()
    await abortableSleep(40, new AbortController().signal)
    expect(Date.now() - started).toBeGreaterThanOrEqual(35)
  })

  it('ends early, without rejecting, when aborted', async () => {
    const controller = new AbortController()
    const started = Date.now()
    const sleeping = abortableSleep(5000, controller.signal)
    controller.abort()
    await expect(sleeping).resolves.toBeUndefined()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('returns at once if already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const started = Date.now()
    await abortableSleep(5000, controller.signal)
    expect(Date.now() - started).toBeLessThan(500)
  })
})
