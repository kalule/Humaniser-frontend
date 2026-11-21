import { useCallback, useEffect, useRef, useState } from 'react'
import { gapFinderApi } from '../api/gapFinder'
import type { ConfirmGapScopePayload, GapRun, UseGapResult } from '../types/gapFinder'

/** Progress polling starts at 1.5 s and backs off to 10 s: a run takes minutes, so later checks need not be frequent. */
export const POLL_INITIAL_MS = 1500
export const POLL_MAX_MS = 10_000
/** Polling stops (with a visible "retry" state) after this many failed checks in a row ... */
export const POLL_MAX_CONSECUTIVE_FAILURES = 5
/** ... or after this long, so a run that never settles cannot keep a browser tab polling forever. */
export const POLL_MAX_DURATION_MS = 30 * 60_000

/** Delay before poll number `attempt` (0-based): 1.5 s growing by half each time, capped at 10 s. */
export function nextPollDelayMs(attempt: number): number {
  return Math.min(POLL_MAX_MS, Math.round(POLL_INITIAL_MS * Math.pow(1.5, Math.max(0, attempt))))
}

export function gapErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { error?: string; message?: string } }; message?: string }
  return err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? 'Something went wrong. Please try again.'
}

/** True while the server is still working and the client should keep polling. */
export const isGapRunActive = (run: GapRun | null): boolean =>
  run?.status === 'queued' || run?.status === 'running'

/**
 * One gap-finder run for a project. Resumes the latest run after a refresh, polls while the server is
 * working (the app has no push channel), and exposes each action with a shared busy/error state.
 */
export function useGapFinder(projectId: string) {
  const [run, setRun] = useState<GapRun | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // Restore the most recent run so a refresh does not lose a search in progress or its results.
  useEffect(() => {
    let cancelled = false
    gapFinderApi.listForProject(projectId, 1)
      .then(runs => {
        const latest = runs[0]
        if (!cancelled && latest && latest.status !== 'cancelled') setRun(latest)
      })
      .catch(() => { /* no history is fine; the panel simply starts empty */ })
    return () => { cancelled = true }
  }, [projectId])

  const runId = run?.id
  const active = isGapRunActive(run)
  // True when polling gave up (repeated failures or the time limit). The run may still be working on the server;
  // resumePolling() checks again.
  const [pollStalled, setPollStalled] = useState(false)
  const [pollEpoch, setPollEpoch] = useState(0)
  useEffect(() => {
    if (!runId || !active) return
    let cancelled = false
    let timer: number | undefined
    let attempt = 0
    let failures = 0
    const startedAt = Date.now()
    const schedule = () => { timer = window.setTimeout(tick, nextPollDelayMs(attempt++)) }
    const tick = async () => {
      try {
        const next = await gapFinderApi.get(runId)
        if (cancelled || !alive.current) return
        failures = 0
        setRun(next)
      } catch (e) {
        if (cancelled || !alive.current) return
        failures++
        if (failures >= POLL_MAX_CONSECUTIVE_FAILURES) {
          setPollStalled(true)
          setError(`We could not check the search's progress (${gapErrorMessage(e)}). It may still be running.`)
          return
        }
      }
      if (cancelled) return
      if (Date.now() - startedAt >= POLL_MAX_DURATION_MS) {
        setPollStalled(true)
        return
      }
      schedule()
    }
    setPollStalled(false)
    schedule()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [runId, active, pollEpoch])

  const resumePolling = useCallback(() => {
    setPollStalled(false)
    setError(null)
    setPollEpoch(e => e + 1)
  }, [])

  const guard = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setError(null)
    try {
      return await action()
    } catch (e) {
      if (alive.current) setError(gapErrorMessage(e))
      return null
    } finally {
      if (alive.current) setBusy(false)
    }
  }, [])

  const start = useCallback(async (topic: string) => {
    const next = await guard(() => gapFinderApi.start(projectId, topic))
    if (next && alive.current) setRun(next)
  }, [guard, projectId])

  const confirmScope = useCallback(async (payload: ConfirmGapScopePayload) => {
    if (!runId) return
    const next = await guard(() => gapFinderApi.confirmScope(runId, payload))
    if (next && alive.current) setRun(next)
  }, [guard, runId])

  const cancel = useCallback(async () => {
    if (!runId) return
    const next = await guard(() => gapFinderApi.cancel(runId))
    if (next && alive.current) setRun(next)
  }, [guard, runId])

  const retry = useCallback(async () => {
    if (!runId) return
    const next = await guard(() => gapFinderApi.retry(runId))
    if (next && alive.current) setRun(next)
  }, [guard, runId])

  const editCorpus = useCallback(async (removeWorkIds: string[], addDois: string[]) => {
    if (!runId) return
    const next = await guard(() => gapFinderApi.editCorpus(runId, removeWorkIds, addDois))
    if (next && alive.current) setRun(next)
  }, [guard, runId])

  const chooseGap = useCallback(async (gapId: string, researchQuestion?: string): Promise<UseGapResult | null> => {
    if (!runId) return null
    const result = await guard(() => gapFinderApi.selectGap(runId, gapId, researchQuestion))
    if (result && alive.current) setRun(r => (r ? { ...r, usedGapId: gapId } : r))
    return result
  }, [guard, runId])

  const dismiss = useCallback(() => { setRun(null); setError(null) }, [])

  return { run, busy, error, pollStalled, resumePolling, start, confirmScope, cancel, retry, editCorpus, chooseGap, dismiss }
}
