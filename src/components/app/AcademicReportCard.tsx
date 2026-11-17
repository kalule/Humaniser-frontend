import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { deepResearchApi, type AcademicReport } from '../../api/deepResearch'
import { apiErrorMessage } from '../../lib/deepResearch'

const POLL_MS = 5000

/**
 * The full academic report for a finished session. Written on request (it costs credits and takes a few minutes), kept with
 * the session, and downloadable as Word. It rests only on the session's verified sources; the notes say what limits it.
 */
export function AcademicReportCard({ sessionId, canWrite }: { sessionId: string; canWrite: boolean }) {
  const [report, setReport] = useState<AcademicReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback(async () => {
    try { const r = await deepResearchApi.academicReport(sessionId); if (alive.current) setReport(r) } catch { /* the card simply offers the button */ }
  }, [sessionId])
  useEffect(() => { setReport(null); setOpen(false); void load() }, [load])

  // While it is being written, check back until it is Ready or Failed.
  useEffect(() => {
    if (report?.status !== 'Writing') return
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [report?.status, load])

  const request = async (regenerate: boolean) => {
    if (busy) return
    setBusy(true)
    try { setReport(await deepResearchApi.requestAcademicReport(sessionId, regenerate)) }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not start the report.')) }
    finally { setBusy(false) }
  }
  const download = async () => {
    if (exporting) return
    setExporting(true)
    try { await deepResearchApi.exportAcademicReportDocx(sessionId) }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not download the report.')) }
    finally { setExporting(false) }
  }

  return <AcademicReportView report={report} canWrite={canWrite} busy={busy} exporting={exporting} open={open}
    onRequest={r => void request(r)} onDownload={() => void download()} onToggle={() => setOpen(o => !o)} />
}

export interface ViewProps {
  report: AcademicReport | null
  canWrite: boolean
  busy: boolean
  exporting: boolean
  open: boolean
  onRequest: (regenerate: boolean) => void
  onDownload: () => void
  onToggle: () => void
}

/** The card's states, with no state of its own, so each can be rendered and tested directly. */
export function AcademicReportView({ report, canWrite, busy, exporting, open, onRequest, onDownload, onToggle }: ViewProps) {
  const status = report?.status ?? 'NotStarted'
  if (!canWrite && status === 'NotStarted') return null
  const btn = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/50'
  const primary = `${btn} bg-purple-accent text-white hover:bg-purple-deep disabled:opacity-60`
  const secondary = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60`

  return (
    <section aria-labelledby="academic-report" className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="academic-report">
      <h3 id="academic-report" className="font-serif text-[18px] font-semibold text-slate-900">Full academic report</h3>

      {status === 'NotStarted' && (
        <>
          <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-slate-700">
            A postgraduate-style report (abstract, methodology, critical literature review, cross-study synthesis with an evidence table, research gaps, discussion,
            recommendations and APA references) written only from this session&rsquo;s verified sources. It is a structured literature review, not a systematic review.
            It takes a few minutes and uses {report?.credits ?? 5} credits.
          </p>
          <div className="mt-3">
            <button type="button" className={primary} onClick={() => onRequest(false)} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} aria-hidden="true" />} Write full report
            </button>
          </div>
        </>
      )}

      {status === 'Writing' && (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-slate-700" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Writing the report. This takes a few minutes; you can leave this page and come back.
        </p>
      )}

      {status === 'Failed' && (
        <>
          <p className="mt-2 text-[13px] text-red-700" role="alert">{report?.error ?? 'The report could not be written.'}</p>
          {canWrite && <div className="mt-3"><button type="button" className={primary} onClick={() => onRequest(false)} disabled={busy}>Try again</button></div>}
        </>
      )}

      {status === 'Ready' && report?.markdown && (
        <>
          <p className="mt-1 text-[13px] text-slate-700">
            {report.wordCount.toLocaleString('en-US')} words from {report.keptSources} verified sources ({(report.tier ?? 'Full').toLowerCase()} evidence).
          </p>
          {report.notes.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900" aria-label="Limits of this report">
              {report.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => onDownload()} disabled={exporting}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} aria-hidden="true" />} Download Word
            </button>
            <button type="button" className={secondary} onClick={() => onToggle()} aria-expanded={open}>{open ? 'Hide report' : 'Read here'}</button>
            {canWrite && (
              <button type="button" className={secondary} onClick={() => onRequest(true)} disabled={busy} title={`Writes a new version for ${report.credits} credits`}>
                <RefreshCw size={14} aria-hidden="true" /> Write again
              </button>
            )}
          </div>
          {open && (
            <article className="mt-4 max-w-[78ch] text-[15px] leading-[1.75] text-slate-800 [&_h1]:mb-3 [&_h1]:font-serif [&_h1]:text-[24px] [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-[19px] [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-[16px] [&_h3]:font-semibold [&_p]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12px] [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-1.5 [&_th]:text-left [&_td]:border [&_td]:border-slate-200 [&_td]:p-1.5 [&_td]:align-top">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown}</ReactMarkdown>
            </article>
          )}
        </>
      )}
    </section>
  )
}
