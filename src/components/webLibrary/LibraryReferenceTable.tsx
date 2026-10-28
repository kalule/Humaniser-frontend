import { Check, ArrowUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getPrimaryRowActions, getOverflowRowActions, type RowActionHandlers } from './libraryRowActions'
import { RowActionBar } from './RowActionBar'
import type { ResearchDocument } from '../../types/webLibrary'

// The "Reference Manager View" toggle used to render the exact same table as
// Library View regardless of which pill was active (confirmed via code read
// — no conditional branched on viewMode anywhere). This is the real, distinct
// dense table it was supposed to be: one row per paper, real metadata columns
// only, no AI-content columns (Research Library UX audit, 2026-10-03).

type SortBy = 'date-added' | 'title-asc' | 'title-desc' | 'year'

export function LibraryReferenceTable({
  docs, selectedRows, onToggleRow, onToggleAll, onOpenDoc, sortBy, onSort, inTrash, handlers,
}: {
  docs:         ResearchDocument[]
  selectedRows: Set<string>
  onToggleRow:  (id: string) => void
  onToggleAll:  () => void
  onOpenDoc:    (doc: ResearchDocument) => void
  sortBy:       string
  onSort:       (v: string) => void
  inTrash:      boolean
  handlers:     RowActionHandlers
}) {
  const sortIndicator = (key: SortBy) => {
    if (sortBy !== key) return undefined
    return key === 'title-desc' ? 'descending' : 'ascending'
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm">
        <tr>
          <th scope="col" className="text-left px-3 py-2 border-b border-slate-200 w-[320px]">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleAll}
                aria-label={selectedRows.size === docs.length && docs.length > 0 ? 'Deselect all' : 'Select all'}
                className={cn(
                  'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                  selectedRows.size === docs.length && docs.length > 0 ? 'border-purple-accent bg-purple-accent' : 'border-slate-300 hover:border-slate-400',
                )}
              >
                {selectedRows.size === docs.length && docs.length > 0 && <Check size={10} className="text-white" />}
              </button>
              <span className="font-semibold text-slate-700">Title</span>
            </div>
          </th>
          <th scope="col" className="text-left px-3 py-2 border-b border-l border-slate-200 font-semibold text-slate-700 w-[200px]">Authors</th>
          <th scope="col" aria-sort={sortIndicator('year')} className="text-left px-3 py-2 border-b border-l border-slate-200 w-[80px]">
            <button onClick={() => onSort('year')} className="flex items-center gap-1 font-semibold text-slate-700">
              Year <ArrowUpDown size={11} className="text-slate-400" />
            </button>
          </th>
          <th scope="col" className="text-left px-3 py-2 border-b border-l border-slate-200 font-semibold text-slate-700 w-[200px]">Journal</th>
          <th scope="col" className="text-left px-3 py-2 border-b border-l border-slate-200 font-semibold text-slate-700 w-[160px]">Tags</th>
          <th scope="col" aria-sort={sortIndicator('date-added')} className="text-left px-3 py-2 border-b border-l border-slate-200 w-[110px]">
            <button onClick={() => onSort('date-added')} className="flex items-center gap-1 font-semibold text-slate-700">
              Added <ArrowUpDown size={11} className="text-slate-400" />
            </button>
          </th>
          <th scope="col" className="text-left px-3 py-2 border-b border-l border-slate-200 font-semibold text-slate-700 w-[110px]">Actions</th>
        </tr>
      </thead>
      <tbody>
        {docs.map(doc => {
          const { open } = getPrimaryRowActions(doc, handlers)
          const overflow = getOverflowRowActions(doc, handlers, inTrash)
          return (
            <tr
              key={doc.id}
              onClick={() => onOpenDoc(doc)}
              className={cn('h-10 border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors', selectedRows.has(doc.id) && 'bg-purple-tint/30')}
            >
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={e => { e.stopPropagation(); onToggleRow(doc.id) }}
                    aria-label={selectedRows.has(doc.id) ? `Deselect ${doc.title}` : `Select ${doc.title}`}
                    className={cn(
                      'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                      selectedRows.has(doc.id) ? 'border-purple-accent bg-purple-accent' : 'border-slate-300 hover:border-slate-400',
                    )}
                  >
                    {selectedRows.has(doc.id) && <Check size={10} className="text-white" />}
                  </button>
                  <span className="truncate text-slate-800 font-medium" title={doc.title}>{doc.title}</span>
                </div>
              </td>
              <td className="px-3 py-1.5 text-slate-600 truncate" title={doc.authors.join(', ')}>{doc.authors.join(', ') || '—'}</td>
              <td className="px-3 py-1.5 text-slate-600">{doc.year ?? '—'}</td>
              <td className="px-3 py-1.5 text-slate-600 truncate" title={doc.journal}>{doc.journal ?? '—'}</td>
              <td className="px-3 py-1.5 text-slate-500 truncate">{doc.tags.length > 0 ? doc.tags.join(', ') : '—'}</td>
              <td className="px-3 py-1.5 text-slate-500">{new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td className="px-3 py-1.5">
                <RowActionBar open={open} overflow={overflow} paper={doc} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
