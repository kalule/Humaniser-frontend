import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getPrimaryRowActions, getOverflowRowActions, type RowActionHandlers } from './libraryRowActions'
import { RowActionBar } from './RowActionBar'
import type { ResearchDocument } from '../../types/webLibrary'

// Same reading-oriented card row as My Library's Library View, same shared
// action config — used by Collection detail so "the same action behaves the
// same way everywhere" (Research Library UX audit, 2026-10-03).
export function LibraryCardRow({
  doc, selected, onToggle, onOpen, handlers, inTrash,
}: {
  doc: ResearchDocument
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  handlers: RowActionHandlers
  inTrash: boolean
}) {
  const { open } = getPrimaryRowActions(doc, handlers)
  const overflow = getOverflowRowActions(doc, handlers, inTrash)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      aria-label={`Open ${doc.title}`}
      className="flex gap-2.5 p-4 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        aria-label={selected ? `Deselect ${doc.title}` : `Select ${doc.title}`}
        className={cn(
          'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
          selected ? 'border-purple-accent bg-purple-accent' : 'border-slate-300 hover:border-slate-400',
        )}
      >
        {selected && <Check size={10} className="text-white" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[14px] font-semibold text-slate-800 leading-snug line-clamp-2">{doc.title}</p>
        {doc.authors.length > 0 && (
          <p className="text-[12px] text-slate-600">{doc.authors.join(', ')}{doc.year ? ` (${doc.year})` : ''}</p>
        )}
        {doc.journal && <p className="text-[12px] text-slate-500 italic">{doc.journal}</p>}
        <div className="pt-1">
          <RowActionBar open={open} overflow={overflow} paper={doc} />
        </div>
      </div>
    </div>
  )
}
