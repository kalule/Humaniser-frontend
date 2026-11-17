import { FileText, Upload } from 'lucide-react'
import { draftUnavailableCopy } from '../../../lib/citationCheckView'

interface Props {
  state: 'gone' | 'error'
  fileName: string | null
  citations: number
  /** When the server deletes the draft, if a report has told us. */
  deleteAfter: string | null
  onRetry: () => void
  onReupload: () => void
}

/**
 * Shown instead of an empty box when the draft text cannot be displayed. It states what the system actually does (the draft is
 * held encrypted on the server until its delete date) and offers only actions that can work: fetching it again when the failure
 * was a connection problem, and uploading the file again.
 */
export function CitationDraftUnavailable({ state, fileName, citations, deleteAfter, onRetry, onReupload }: Props) {
  const copy = draftUnavailableCopy(state, deleteAfter)
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6">
      <div className="max-w-sm w-full rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-center">
        <div className="flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
          <FileText size={14} className="text-slate-600 shrink-0" aria-hidden />
          <span className="text-[13px] font-medium text-slate-900 truncate">{fileName ?? 'Your draft'}</span>
          <span className="text-[11.5px] text-slate-600 shrink-0 tabular-nums">· {citations} {citations === 1 ? 'citation' : 'citations'}</span>
        </div>
        <p className="text-[13px] font-medium text-slate-900">{copy.title}</p>
        <p className="text-[12px] leading-relaxed text-slate-700">{copy.body}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {state === 'error' && (
            <button type="button" onClick={onRetry}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
              Try again
            </button>
          )}
          <button type="button" onClick={onReupload}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-purple-accent text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent focus-visible:ring-offset-1">
            <Upload size={12} aria-hidden /> Re-upload to view highlights
          </button>
        </div>
      </div>
    </div>
  )
}
