import { useEffect, useState } from 'react'
import { cancelPaperRun, clearPaper, getPaperRun, pendingPaper, retryPaperRun, type PaperRun } from '../../lib/researchPaperRuns'
import type { EssayCitationStyle, WriteWithAiResponse } from '../../types/workbench'

export function ResearchPaperRecovery({ documentId, busy, onRecovered }: { documentId: string; busy: boolean; onRecovered: (result: WriteWithAiResponse, style: EssayCitationStyle) => boolean | Promise<boolean> }) {
  const [run, setRun] = useState<PaperRun | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setRun(null); setError('')
    if (busy) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      const pending = pendingPaper(documentId)
      if (!pending) { setRun(null); return }
      try {
        const state = await getPaperRun(pending.runId, controller.signal)
        if (controller.signal.aborted) return
        setRun(state); setError('')
        // Completed results wait for an explicit insert, preserving existing edits on recovery.
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Could not check the paper. Retrying shortly.')
      }
      timer = setTimeout(poll, 5000)
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [documentId, busy])
  if (busy || (!run && !error)) return null
  const action = async (kind: 'retry' | 'cancel' | 'insert') => {
    const pending = pendingPaper(documentId)
    if (!pending) return
    try {
      if (kind === 'insert' && run?.result && run.runId === pending.runId) { if (await onRecovered(run.result, pending.citationStyle)) { clearPaper(documentId); setRun(null) } }
      else if (kind === 'retry') { await retryPaperRun(pending.runId); setRun({ ...run!, status: 'Queued', stage: 'queued', error: '' }) }
      else if (kind === 'cancel') { await cancelPaperRun(pending.runId); clearPaper(documentId); setRun(null) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the paper.') }
  }
  const stopped = run && ['Failed', 'Interrupted', 'Cancelled'].includes(run.status)
  const incomplete = run?.result?.completionStatus === 'Incomplete' || run?.result?.researchPaperFlags?.some(flag => flag.code === 'ModeMismatch')
  return <div className="fixed bottom-6 right-6 z-40 max-w-lg rounded-xl border border-purple-200 bg-white p-4 shadow-lg" role="status">
    <p className="text-sm text-slate-700">{error || (incomplete ? 'Your draft is incomplete. Retry the missing sections using the saved evidence.' : run?.status === 'Completed' ? 'Your research paper is ready to insert.' : stopped ? run.error || 'Writing stopped. Saved sections can be reused.' : `Research paper: ${run?.stage?.replaceAll(':', ' ') ?? 'queued'} (${run?.completedSections ?? 0} sections saved)`)}</p>
    <div className="mt-2 flex gap-4 text-sm text-purple-700">
      {run?.status === 'Completed' && <button onClick={() => void action('insert')}>Insert draft</button>}
      {(stopped || incomplete) && <button onClick={() => void action('retry')}>Resume writing</button>}
      <button onClick={() => void action('cancel')}>{run?.status === 'Completed' || stopped ? 'Dismiss' : 'Cancel generation'}</button>
    </div>
  </div>
}
