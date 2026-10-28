import { FolderPlus, Download, Trash2, X } from 'lucide-react'

// Row checkboxes already existed with no consequence — this is the missing
// listener (Research Library UX audit, 2026-10-03). Only actions with a real,
// existing handler are offered; "Cite" is deliberately not a bulk action here
// since there's no existing "combined reference list" format to produce.
export function BulkActionBar({
  count, onAddToCollection, onExport, onTrash, onClear, trashLabel = 'Move to Trash',
}: {
  count: number
  onAddToCollection?: () => void
  onExport:          () => void
  onTrash:           () => void
  onClear:           () => void
  /** Override for contexts where the destructive bulk action isn't Trash
   *  (e.g. Collection detail's "Remove" — removing membership, not the paper). */
  trashLabel?:       string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-purple-tint bg-purple-tint/40 shrink-0">
      <span className="text-[13px] font-medium text-purple-text">{count} selected</span>
      <div className="flex items-center gap-1.5">
        {onAddToCollection && (
          <button onClick={onAddToCollection} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-slate-600 hover:bg-white transition-colors">
            <FolderPlus size={13} /> Add to collection
          </button>
        )}
        <button onClick={onExport} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-slate-600 hover:bg-white transition-colors">
          <Download size={13} /> Export
        </button>
        <button onClick={onTrash} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-red-600 hover:bg-white transition-colors">
          <Trash2 size={13} /> {trashLabel}
        </button>
      </div>
      <div className="flex-1" />
      <button onClick={onClear} aria-label="Clear selection" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
