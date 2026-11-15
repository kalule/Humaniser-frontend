import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { studyDesignApi, type ConsistencyFinding, type ConsistencyResult } from '../../api/studyDesign'
import { Skeleton } from '../ui/Skeleton'

interface ApiFailure { code?: string; details?: { message: string }[]; response?: { status?: number } }

/**
 * Consistency checks for one project. Every finding, value and sentence is produced on the server; this component
 * lays them out and computes nothing. It never says the project is consistent: an empty list is described as
 * "nothing found", with the server's own note on what that does and does not mean.
 */
export function ConsistencyTab({ projectId, active }: { projectId: string; active: boolean }) {
  const [result, setResult] = useState<ConsistencyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [actionFailure, setActionFailure] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const run = useCallback(() => {
    if (!projectId) { setResult(null); return }
    setLoading(true); setFailure(null); setActionFailure(null)
    let cancelled = false
    studyDesignApi.consistency(projectId)
      .then(r => { if (!cancelled) setResult(r) })
      .catch((e: ApiFailure) => { if (!cancelled) { setResult(null); setFailure(e?.response?.status === 429 ? 'Too many requests in a short time. Wait a minute and check again.' : 'The checks could not be run. Check your connection and try again.') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])
  // Other tabs change what is compared (a saved calculation, the questionnaire), so the checks run again each time this tab is opened.
  useEffect(() => { if (active) return run() }, [active, run])

  const act = async (key: string, action: 'dismiss' | 'restore') => {
    setBusyKey(key); setActionFailure(null)
    try { setResult(action === 'dismiss' ? await studyDesignApi.dismissFinding(projectId, key) : await studyDesignApi.restoreFinding(projectId, key)) }
    catch (err) {
      const e = err as ApiFailure
      setActionFailure(e?.details?.[0]?.message ?? (e?.code === 'STUDY_DESIGN_NOT_FOUND' ? 'That finding has changed. The list has been refreshed.' : 'That could not be done. Try again.'))
      if (e?.code === 'STUDY_DESIGN_NOT_FOUND') run()
    } finally { setBusyKey(null) }
  }

  if (!projectId) return <p className="text-[14px] text-slate-800">Choose a project above to check it for contradictions.</p>
  if (failure) {
    return <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800">
      {failure} <button type="button" onClick={() => run()} className="font-semibold underline">Try again</button>
    </div>
  }
  if (!result) return <Skeleton lines={6} tone="light" />

  const { report } = result
  const conditional = report.notes.filter(n => n.code.startsWith('NO_'))
  const fixed = report.notes.filter(n => !n.code.startsWith('NO_'))

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-slate-800">
          Compares what your project says about its sample, design and instrument with your saved calculation and questionnaire, and with itself.
        </p>
        <button type="button" disabled={loading} onClick={() => run()}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-purple-accent px-3 text-[13px] font-semibold text-purple-deep hover:bg-purple-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? 'Checking…' : 'Check again'}
        </button>
      </div>
      <p className="text-[12px] text-slate-600">
        Checked {new Date(result.checkedAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {report.sectionsRead} section{report.sectionsRead === 1 ? '' : 's'} read · rules {report.rulesVersion}
      </p>

      {conditional.map(n => (
        <p key={n.code} className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-950">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{n.text}</span>
        </p>
      ))}
      {actionFailure ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-[13px] font-medium text-red-800">{actionFailure}</p> : null}

      <section aria-label="Findings" aria-live="polite">
        <h2 className="text-[15px] font-semibold text-slate-900">Findings ({report.findings.length})</h2>
        {report.findings.length === 0
          ? <p className="mt-1 text-[14px] text-slate-800">These checks found nothing to report.</p>
          : <ul className="mt-2 space-y-3">{report.findings.map(f => <FindingCard key={f.key} finding={f} busy={busyKey === f.key} onAction={f.canDismiss ? () => void act(f.key, 'dismiss') : null} actionLabel="Dismiss" />)}</ul>}
      </section>

      {report.dismissed.length > 0 ? (
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-[14px] font-semibold text-slate-900">Dismissed ({report.dismissed.length})</summary>
          <ul className="mt-2 space-y-3">{report.dismissed.map(f => <FindingCard key={f.key} finding={f} busy={busyKey === f.key} onAction={() => void act(f.key, 'restore')} actionLabel="Restore" />)}</ul>
        </details>
      ) : null}

      <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-slate-700">{fixed.map(n => <li key={n.code}>{n.text}</li>)}</ul>
    </div>
  )
}

export function FindingCard({ finding: f, busy, onAction, actionLabel }: { finding: ConsistencyFinding; busy: boolean; onAction: (() => void) | null; actionLabel: string }) {
  const warning = f.severity === 'warning'
  return (
    <li className={`rounded-xl border p-3 ${warning ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
      <div className="flex items-start gap-2">
        {warning ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" /> : <Info size={16} className="mt-0.5 shrink-0 text-slate-600" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-slate-600">
            <span className="sr-only">{warning ? 'Check: ' : 'Note: '}</span>
            <span className="font-mono">{f.code}</span> · {warning ? 'Check this' : 'Note'}{f.foundInText ? ' · found in text' : ''}
          </p>
          <p className="mt-0.5 text-[14px] leading-snug text-slate-900">{f.message}</p>
          <dl className="mt-2 space-y-1 text-[13px]">
            {f.values.map((v, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="text-slate-600 sm:w-56 sm:shrink-0">{v.label}</dt>
                <dd className="min-w-0 break-words text-slate-900"><strong>{v.value}</strong> <span className="text-slate-600">({v.source})</span></dd>
              </div>
            ))}
          </dl>
          {f.quote ? <blockquote className="mt-2 border-l-2 border-slate-300 pl-2 text-[13px] italic leading-snug text-slate-700">{f.quote}</blockquote> : null}
          {onAction ? (
            <button type="button" disabled={busy} onClick={onAction} aria-label={`${actionLabel} finding ${f.code}: ${f.message}`}
              className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:opacity-50">
              {busy ? 'Working…' : actionLabel}
            </button>
          ) : !f.canDismiss ? <p className="mt-2 text-[12px] text-slate-600">Compares stored values, so it cannot be dismissed. It goes away when the values agree.</p> : null}
        </div>
      </div>
    </li>
  )
}
