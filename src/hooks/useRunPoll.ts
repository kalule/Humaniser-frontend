import { useCallback, useEffect, useRef, useState } from 'react'
import { isRunActive, type ReviewRun } from '../lib/literatureReview'

/** Polls a run every 3 seconds while it is queued or running, then calls onFinished once. */
export function useRunPoll(fetchRun: () => Promise<ReviewRun | null>, onFinished: () => void) {
  const [run, setRun] = useState<ReviewRun | null>(null)
  const finished = useRef(onFinished)
  useEffect(() => { finished.current = onFinished }, [onFinished])
  const refresh = useCallback(async () => {
    try { const r = await fetchRun(); setRun(r); return r } catch { return null }
  }, [fetchRun])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!isRunActive(run)) return
    const timer = window.setTimeout(async () => {
      const next = await refresh()
      if (next && !isRunActive(next)) finished.current()
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [run, refresh])
  return { run, setRun, refresh }
}
