import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { getQualityReport, type ProposalQualityReport } from '../../api/qualityReport'
import { issueLabel } from './FixIssuesPanel'

/**
 * PR 11 (2026-11-25): the quality report shown before export. A rubric-style estimate from the automatic checks (no model
 * call) with the checks that failed; it says plainly that it is an estimate and how well it agreed with marked proposals.
 */
/** `compact`: one column and no outer margin, for the Document view's narrow Agent panel. */
export function QualityReportCard({ projectId, refreshKey, compact = false }: { projectId: string; refreshKey?: unknown; compact?: boolean }) {
  const [report, setReport] = useState<ProposalQualityReport | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let live = true
    setFailed(false)
    getQualityReport(projectId).then(r => { if (live) setReport(r) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [projectId, refreshKey])

  if (failed || !report) return null
  const blocking = report.failedChecks.filter(i => i.severity === 'Blocking').length
  const warnings = report.failedChecks.length - blocking

  return (
    <section aria-label="Quality report" className={`${compact ? '' : 'mb-6 '}rounded-xl border border-slate-200 bg-white p-4`}>
      <div className="flex items-start gap-3">
        <Gauge size={18} className="text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-slate-800">Quality estimate</span>
            <span className="text-[20px] font-bold text-slate-900" data-testid="quality-total">{report.total}</span>
            <span className="text-[12px] text-slate-500">/ 100</span>
          </div>
          <p className="m-0 text-[11.5px] text-slate-500 leading-relaxed">{report.calibration.note}</p>
        </div>
      </div>
      <ul className={`mt-3 grid grid-cols-1 ${compact ? '' : 'sm:grid-cols-2 '}gap-x-6 gap-y-1.5 list-none p-0 m-0`}>
        {report.criteria.map(c => (
          <li key={c.id} className="text-[12px] text-slate-700">
            <div className="flex justify-between"><span>{c.label}</span><span className="tabular-nums">{c.score} / {c.max}</span></div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${Math.round((c.score / c.max) * 100)}%`, background: c.score / c.max >= 0.7 ? '#059669' : c.score / c.max >= 0.5 ? '#d97706' : '#dc2626' }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-[12px] text-slate-600">
        {report.failedChecks.length === 0
          ? 'No automatic check failed.'
          : <>{blocking} blocking and {warnings} to review{report.dismissedCount > 0 ? `, ${report.dismissedCount} dismissed` : ''}.{' '}
              <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                className="font-medium text-slate-700 underline underline-offset-2">{open ? 'Hide failed checks' : 'Show failed checks'}</button></>}
      </div>
      {open && (
        <ul className="mt-2 max-h-64 overflow-y-auto list-none p-0 m-0 flex flex-col gap-1" aria-label="Failed checks">
          {report.failedChecks.map((i, n) => (
            <li key={`${i.type}-${i.sectionKey}-${n}`} className="text-[12px] text-slate-600">
              <span className={i.severity === 'Blocking' ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>{i.severity === 'Blocking' ? 'Blocking' : 'Review'}</span>
              {' · '}<span className="font-medium text-slate-700">{issueLabel(i.type)}</span> · {i.sectionKey} · {i.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
