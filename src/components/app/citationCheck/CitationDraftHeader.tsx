import { AlertTriangle, FileText, RefreshCw, Trash2 } from 'lucide-react'

interface Props {
  fileName: string | null
  /** Null while the draft is still loading. */
  words: number | null
  citations: number
  /** Notes from reading the file; shown below the strip and never block anything. */
  warnings: string[]
  busy: boolean
  onReplace: () => void
  onClear: () => void
}

/** What was checked: file name, words, citations, and the two ways to start over. */
export function CitationDraftHeader({ fileName, words, citations, warnings, busy, onReplace, onClear }: Props) {
  return (
    <div className="border-b border-[#e0e0da] shrink-0">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center" aria-hidden>
          <FileText size={14} className="text-slate-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-slate-900 truncate" title={fileName ?? undefined}>{fileName ?? 'Pasted text'}</p>
          <p className="text-[11.5px] text-slate-600 tabular-nums">
            {words === null ? 'Loading…' : `${words.toLocaleString()} words`} · {citations.toLocaleString()} {citations === 1 ? 'citation' : 'citations'}
          </p>
        </div>
        <button type="button" onClick={onReplace} disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-purple-text disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent rounded">
          <RefreshCw size={12} aria-hidden /> Replace file
        </button>
        <button type="button" onClick={onClear} disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-red-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent rounded">
          <Trash2 size={12} aria-hidden /> Clear
        </button>
      </div>
      {warnings.map(w => (
        <p key={w} className="px-4 pb-2 text-[12px] text-amber-800 flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> <span>{w}</span>
        </p>
      ))}
    </div>
  )
}
