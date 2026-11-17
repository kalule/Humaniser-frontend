import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { citationCheckApi } from '../api/citationCheck'
import type { CitationCheckEstimate, CitationCheckReport, CitationDraft } from '../types/citationCheck'
import { abortableSleep, pollUntilDone } from '../lib/citationCheckPolling'
import { forgetRun, recallRun, recallRunMeta, rememberRun, rememberRunMeta } from '../lib/citationCheckRun'

/**
 * idle      nothing in progress; the input is shown
 * starting  the draft is being sent
 * running   a check exists and is being followed (report may still be null for the first moment of a resume)
 * finished  the check completed or failed; the report says which
 * lost      we stopped being able to reach the server; the check may still be running there
 */
export type CheckPhase = 'idle' | 'starting' | 'running' | 'finished' | 'lost'

/**
 * none     no run, so no draft
 * loading  fetching the text the run was started from
 * ready    the text is here: the document pane can show it with highlights
 * gone     the server no longer has it (deleted or expired): only a re-upload can bring it back
 * error    we could not reach the server for it just now: trying again can work
 */
export type DraftState = 'none' | 'loading' | 'ready' | 'gone' | 'error'

const message = (e: unknown, fallback: string): string =>
  e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string' && (e as { message: string }).message
    ? (e as { message: string }).message
    : fallback

interface Started { runId: string; fileName: string | null; warnings: string[] }

/** What is waiting for the writer's go-ahead: the source, and what starting it would involve. */
export type PendingCheck =
  | { kind: 'text'; text: string; estimate: CitationCheckEstimate }
  | { kind: 'file'; file: File; estimate: CitationCheckEstimate }

/** Small, fully-covered checks start straight away; anything large, plan-limited or with notes about how it was read asks first. */
export const AUTO_START_MAX_CITATIONS = 25
export const needsConfirmation = (e: CitationCheckEstimate): boolean =>
  e.citationCount > AUTO_START_MAX_CITATIONS || e.locked > 0 || e.warnings.length > 0

export function useCitationCheck() {
  const [phase, setPhase] = useState<CheckPhase>('idle')
  const [report, setReport] = useState<CitationCheckReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** When we first saw the run waiting to start, on OUR clock: comparing against the server's timestamp would trust two clocks to agree. */
  const [queuedSince, setQueuedSince] = useState<number | null>(null)
  const [draft, setDraft] = useState<CitationDraft | null>(null)
  const [draftState, setDraftState] = useState<DraftState>('none')
  const [fileName, setFileName] = useState<string | null>(null)
  /** Notes from reading an uploaded file (e.g. a PDF whose columns may be out of order). Never blocking. */
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([])
  const [pending, setPending] = useState<PendingCheck | null>(null)
  const [preparing, setPreparing] = useState(false)
  const controller = useRef<AbortController | null>(null)
  /** The run being followed, kept apart from the report: a dropped connection can happen before the first report ever arrives. */
  const currentRun = useRef<string | null>(null)

  const stopWatching = useCallback(() => { controller.current?.abort(); controller.current = null }, [])

  /** The text the check was started from, held in memory for this session only. */
  const loadDraft = useCallback(async (runId: string) => {
    setDraftState('loading')
    try {
      const d = await citationCheckApi.getDraft(runId)
      if (currentRun.current !== runId) return   // the user moved on while it loaded
      if (d) { setDraft(d); setDraftState('ready') } else { setDraft(null); setDraftState('gone') }
    } catch {
      if (currentRun.current === runId) setDraftState('error')
    }
  }, [])

  /** Follow a run until it finishes. `resumed` is true when the id came from memory rather than from just starting it. */
  const watch = useCallback(async (runId: string, resumed: boolean) => {
    stopWatching()
    currentRun.current = runId
    const mine = new AbortController()
    controller.current = mine
    setPhase('running')
    setError(null)

    const outcome = await pollUntilDone({
      fetchReport: () => citationCheckApi.get(runId),
      sleep: abortableSleep,
      onUpdate: (r) => {
        if (mine.signal.aborted) return
        setReport(r)
        setQueuedSince(prev => (r.status === 'Queued' ? (prev ?? Date.now()) : null))
      },
    }, mine.signal)

    if (mine.signal.aborted) return
    switch (outcome.kind) {
      case 'done':
        setReport(outcome.report); setQueuedSince(null); setPhase('finished')
        break
      case 'gone':
        // A remembered id that no longer exists is just stale memory: start clean without alarming anyone.
        // A run that vanishes while we were watching it is worth saying so.
        forgetRun(); currentRun.current = null; setReport(null); setQueuedSince(null); setPhase('idle')
        setDraft(null); setDraftState('none'); setFileName(null); setExtractionWarnings([])
        if (!resumed) setError('This check was deleted or has expired.')
        break
      case 'error':
        setError(outcome.message); setPhase('lost')
        break
      case 'aborted':
        break
    }
  }, [stopWatching])

  // Land back on the check the user was looking at before a refresh or a return visit.
  useEffect(() => {
    const remembered = recallRun()
    if (remembered) {
      const meta = recallRunMeta(remembered)
      setFileName(meta?.fileName ?? null)
      setExtractionWarnings(meta?.warnings ?? [])
      currentRun.current = remembered
      void loadDraft(remembered)
      void watch(remembered, true)
    }
    return stopWatching
  }, [watch, loadDraft, stopWatching])

  const clearDraft = () => { setDraft(null); setDraftState('none'); setFileName(null); setExtractionWarnings([]) }

  const begin = useCallback(async (send: () => Promise<Started>) => {
    stopWatching()
    setPhase('starting'); setError(null); setReport(null); setQueuedSince(null); clearDraft()
    try {
      const started = await send()
      rememberRun(started.runId)
      rememberRunMeta({ id: started.runId, fileName: started.fileName, warnings: started.warnings })
      setFileName(started.fileName)
      setExtractionWarnings(started.warnings)
      currentRun.current = started.runId
      void loadDraft(started.runId)
      void watch(started.runId, false)
    } catch (e) {
      setPhase('idle')
      setError(message(e, 'We could not start the check. Please try again.'))
    }
  }, [stopWatching, watch, loadDraft])

  const startText = useCallback((text: string) =>
    begin(async () => ({ runId: await citationCheckApi.start(text), fileName: null, warnings: [] })), [begin])
  const startFile = useCallback((file: File) =>
    begin(async () => {
      const { runId, warnings } = await citationCheckApi.uploadFile(file)
      return { runId, fileName: file.name, warnings }
    }), [begin])

  /**
   * Work out what a check would involve BEFORE anything is stored or paid for, apply the plan limit, and either start (small, fully
   * covered) or hold for the writer's go-ahead (large, plan-limited, or with notes about how the file was read).
   */
  const prepare = useCallback(async (source: { kind: 'text'; text: string } | { kind: 'file'; file: File }) => {
    setPreparing(true); setError(null); setPending(null)
    try {
      const estimate = source.kind === 'text' ? await citationCheckApi.estimateText(source.text) : await citationCheckApi.estimateFile(source.file)
      if (!estimate.canStart) { setError(estimate.reason ?? 'This draft cannot be checked.'); return }
      if (needsConfirmation(estimate)) { setPending({ ...source, estimate } as PendingCheck); return }
      if (source.kind === 'text') await startText(source.text); else await startFile(source.file)
    } catch (e) {
      setError(message(e, 'We could not read that. Please try again.'))
    } finally {
      setPreparing(false)
    }
  }, [startText, startFile])

  const prepareText = useCallback((text: string) => prepare({ kind: 'text', text }), [prepare])
  const prepareFile = useCallback((file: File) => prepare({ kind: 'file', file }), [prepare])
  const confirmPending = useCallback(async () => {
    const p = pending
    if (!p) return
    setPending(null)
    if (p.kind === 'text') await startText(p.text); else await startFile(p.file)
  }, [pending, startText, startFile])
  const cancelPending = useCallback(() => setPending(null), [])

  /** Run again only what failed, then follow the run: every finished result stays as it is. */
  const retryFailed = useCallback(async (citationIds?: string[]) => {
    const runId = currentRun.current
    if (!runId) return
    try {
      const n = await citationCheckApi.retryFailed(runId, citationIds)
      if (n === 0) { toast('Nothing needed retrying.'); return }
      toast.success(n === 1 ? 'Retrying 1 citation.' : `Retrying ${n} citations.`)
      void watch(runId, false)
    } catch (e) {
      toast.error(message(e, 'Could not retry. Please try again.'))
    }
  }, [watch])

  /** Back to the input. The check stays on the server until it expires; use `remove` to delete it now. */
  const reset = useCallback(() => {
    stopWatching(); forgetRun(); currentRun.current = null
    setPhase('idle'); setReport(null); setError(null); setQueuedSince(null); clearDraft(); setPending(null)
  }, [stopWatching])

  /** Delete the draft and every result from the server, then go back to the input. */
  const remove = useCallback(async () => {
    const runId = currentRun.current
    if (!runId) return reset()
    stopWatching()
    try {
      await citationCheckApi.remove(runId)
    } catch (e) {
      toast.error(message(e, 'Could not delete the check. Please try again.'))
      void watch(runId, false)   // it still exists: keep following it
      return
    }
    forgetRun(); currentRun.current = null
    setPhase('idle'); setReport(null); setError(null); setQueuedSince(null); clearDraft()
    toast.success('Your draft and results were deleted.')
  }, [reset, stopWatching, watch])

  /** Resume following the current check after a connection problem. */
  const retryWatch = useCallback(() => { if (currentRun.current) void watch(currentRun.current, false) }, [watch])

  /** Try again to fetch the draft after a connection problem. */
  const retryDraft = useCallback(() => { if (currentRun.current) void loadDraft(currentRun.current) }, [loadDraft])

  return {
    phase, report, error, queuedSince, draft, draftState, fileName, extractionWarnings,
    startText, startFile, reset, remove, retryWatch, retryDraft,
    pending, preparing, prepareText, prepareFile, confirmPending, cancelPending, retryFailed,
    currentRunId: () => currentRun.current,
  }
}
