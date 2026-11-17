import { useState } from 'react'
import { AlertTriangle, ExternalLink, BookMarked, Bookmark } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { PaperSearchResult } from '../../types/webLibrary'
import { cautionText, contentLabel, workTypeLabel } from '../../lib/paperSearchLabels'
import { CitePopover } from './CitePopover'

interface PaperSearchResultCardProps {
  result: PaperSearchResult
  /** Best-effort client-side duplicate match (DOI, else normalised title) against
   *  the currently loaded library — the server's own isSaved only reflects an
   *  exact canonical-id match. */
  alreadyInLibrary?: boolean
  /** Unsaved: opens the collection-picker + confirm ("Add to Library") flow.
   *  Already saved: reopens the same picker, pre-checked, to edit collection membership. */
  onSave: () => void
  onDetails: () => void
}

/** One search result as a list row: what it is, who wrote it, where it came from, then the actions. */
export function PaperSearchResultCard({ result, alreadyInLibrary = false, onSave, onDetails }: PaperSearchResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const authorLine = result.authors.slice(0, 6).join(', ') + (result.authors.length > 6 ? ', et al.' : '')
  const isSaved = result.isSaved || alreadyInLibrary
  const type = workTypeLabel(result.workType)
  const content = contentLabel(result.contentLevel)
  const caution = cautionText(result.caution)

  return (
    <article className="py-4">
      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[11px] text-slate-500 mb-1">
        {type && <span className="font-medium text-slate-600">{type}</span>}
        {type && <span aria-hidden className="text-slate-300">·</span>}
        <span title={content.title} className={cn(result.contentLevel === 'metadata' || !result.contentLevel ? 'text-slate-400' : 'text-slate-500')}>{content.label}</span>
        {result.sourceEngine && <><span aria-hidden className="text-slate-300">·</span><span>via {result.sourceEngine}</span></>}
        {result.citationCount != null && <><span aria-hidden className="text-slate-300">·</span><span>Cited by {result.citationCount.toLocaleString()}</span></>}
        {result.isRetracted && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Retracted</span>
        )}
      </div>

      <h3 className="text-[15px] font-semibold leading-snug">
        <button onClick={onDetails} className="text-left text-slate-900 hover:text-purple-deep hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded">
          {result.title}
        </button>
      </h3>
      <p className="text-[12.5px] text-slate-600 mt-1">
        {authorLine || 'Author unknown'}{result.year ? ` · ${result.year}` : ''}
        {result.journal && <span className="text-slate-500 italic"> · {result.journal}</span>}
      </p>

      {caution && (
        <p role="note" className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] leading-snug text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {caution}
        </p>
      )}

      {result.abstract && (
        <div className="mt-2">
          <p className={cn('text-[12.5px] text-slate-600 leading-relaxed', !expanded && 'line-clamp-2')}>
            {result.abstract}
          </p>
          <button
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className="text-[12px] font-medium text-purple-accent hover:text-purple-deep transition-colors mt-0.5"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}

      <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-2.5">
        {result.doi && <span className="text-[11px] text-slate-400 mr-auto truncate max-w-full">DOI {result.doi}</span>}
        {!result.doi && <span className="mr-auto" />}
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ExternalLink size={12} /> View source
          </a>
        )}
        <CitePopover paper={result} warning={caution} />
        {isSaved ? (
          <button
            onClick={onSave}
            title={result.isSaved ? 'In your library. Click to manage collections.' : 'Looks like it is already in your library'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-green-tint text-green-text hover:opacity-80 transition-opacity"
          >
            <BookMarked size={12} /> Saved
          </button>
        ) : (
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-purple-accent hover:bg-purple-deep text-white transition-colors"
          >
            <Bookmark size={12} /> Save
          </button>
        )}
      </div>
    </article>
  )
}
