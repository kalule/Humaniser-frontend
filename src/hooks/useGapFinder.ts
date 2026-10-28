import { useCallback, useEffect, useRef, useState } from 'react'
import { gapFinderApi } from '../api/gapFinder'
import type { ConfirmGapScopePayload, GapRun, UseGapResult } from '../types/gapFinder'

const POLL_MS = 1500

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
  useEffect(() => {
    if (!runId || !active) return
    const timer = window.setInterval(async () => {
      try {
        const next = await gapFinderApi.get(runId)
        if (alive.current) setRun(next)
      } catch (e) {
        if (alive.current) setError(gapErrorMessage(e))
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [runId, active])

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

  return { run, busy, error, start, confirmScope, cancel, retry, editCorpus, chooseGap, dismiss }
}
