import { useState } from 'react'
import { ExternalLink, BookMarked, Bookmark, Info } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { PaperSearchResult } from '../../types/webLibrary'
import { CitePopover } from './CitePopover'

interface PaperSearchResultCardProps {
  result: PaperSearchResult
  /** Unsaved: opens the collection-picker + confirm ("Add to Library") flow.
   *  Already saved: reopens the same picker, pre-checked, to edit collection membership. */
  onSave: () => void
  onDetails: () => void
}

export function PaperSearchResultCard({ result, onSave, onDetails }: PaperSearchResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const authorLine = result.authors.slice(0, 6).join(', ') + (result.authors.length > 6 ? ', et al.' : '')

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      {(result.citationCount != null || result.isRetracted) && (
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {result.citationCount != null && (
            <span className="text-[11px] text-slate-400">Cited by {result.citationCount.toLocaleString()}</span>
          )}
          {result.isRetracted && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Retracted</span>
          )}
        </div>
      )}

      <p className="text-[14px] font-semibold text-slate-800 leading-snug">{result.title}</p>
      <p className="text-[12px] text-slate-600 mt-1">
        {authorLine}{result.year ? ` (${result.year})` : ''}
      </p>
      {result.journal && <p className="text-[12px] text-slate-500 italic mt-0.5">{result.journal}</p>}

      {result.abstract && (
        <div className="mt-2">
          <p className={cn('text-[12px] text-slate-600 leading-relaxed', !expanded && 'line-clamp-2')}>
            {result.abstract}
          </p>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[12px] font-medium text-[#7c3aed] hover:text-[#4c1d95] transition-colors mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
        {result.doi && <span className="text-[11px] text-slate-400 mr-auto truncate">DOI: {result.doi}</span>}
        <button onClick={onDetails} className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors"><Info size={12} /> Details</button>
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
        <CitePopover paper={result} />
        {result.isSaved ? (
          <button
            onClick={onSave}
            title="Saved to your library — click to manage collections"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <BookMarked size={12} /> Library Source
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
    </div>
  )
}
