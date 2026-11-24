import { useCallback, useEffect, useRef, useState } from 'react'
import { useResearchStore } from '../store/researchStore'
import type { GenerationStatus } from '../types/research'

// The automatic whole-proposal run (ProposalGenerationJob), seen from inside the document. The job is
// server-side; this only polls its status so the Document view can show it live, the way an
// "agent writes in your document" editor does: sections fill in place while the run moves on.

const ACTIVE_POLL_MS = 2500

export const isRunActive = (s: GenerationStatus | null | undefined) =>
  s?.status === 'Starting' || s?.status === 'Generating'

/** A run worth showing: anything except "never started". */
export const isRunVisible = (s: GenerationStatus | null | undefined) =>
  !!s && s.status !== 'NotStarted'

export interface ProposalRun {
  status:   GenerationStatus | null
  resuming: boolean
  stopping: boolean
  refresh:  () => void
  resume:   (targetWords: number) => Promise<void>
  stop:     () => Promise<void>
}

/**
 * Polls the run while it is active and reloads the sections on every tick, so a section the run
 * starts appears as "writing" (and streams in) even between sections, when no section is Generating.
 */
export function useProposalRun(projectId: string, initial?: GenerationStatus | null): ProposalRun {
  const [status, setStatus] = useState<GenerationStatus | null>(initial ?? null)
  const [resuming, setResuming] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [revision, setRevision] = useState(0)
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    let failures = 0
    const store = useResearchStore.getState()
    const poll = async () => {
      try {
        const next = await store.getGenerationStatus(projectId)
        if (cancelled) return
        failures = 0
        setStatus(next)
        if (isRunActive(next)) {
          store.loadSections(projectId).catch(() => {})
          timer = window.setTimeout(poll, ACTIVE_POLL_MS)
        } else {
          // One last section read so the final state (approved, needs review) lands in place.
          store.loadSections(projectId).catch(() => {})
        }
      } catch {
        if (cancelled) return
        if (++failures < 3) timer = window.setTimeout(poll, ACTIVE_POLL_MS * 2)
      }
    }
    void poll()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [projectId, revision])

  const refresh = useCallback(() => setRevision(v => v + 1), [])

  const resume = useCallback(async (targetWords: number) => {
    if (busy.current) return
    busy.current = true
    setResuming(true)
    try {
      const next = await useResearchStore.getState().generateAutonomous(projectId, targetWords)
      setStatus(next)
      setRevision(v => v + 1)
    } finally {
      busy.current = false
      setResuming(false)
    }
  }, [projectId])

  const stop = useCallback(async () => {
    setStopping(true)
    try {
      const next = await useResearchStore.getState().cancelGeneration(projectId)
      setStatus(next)
      setRevision(v => v + 1)
    } finally {
      setStopping(false)
    }
  }, [projectId])

  return { status, resuming, stopping, refresh, resume, stop }
}
