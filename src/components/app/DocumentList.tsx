import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MoreVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tooltip } from '../ui/Tooltip'

export interface DocumentListAction {
  key: string
  icon: ReactNode
  label: string
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
}

export interface DocumentListEntry {
  id: string
  icon: ReactNode
  iconClassName: string
  title: string
  // Compact single-line metadata, e.g. "9 Jul 2026 · MASTERS · APA7" — kept as
  // one scannable line rather than separate table columns, per the AI Thesis
  // + Proposal Studio UX audit.
  metaLine: string
  badges?: { label: string; className: string }[]
  statusBadge?: { label: string; className: string }
  onOpen: () => void
  inlineActions: DocumentListAction[]
  overflowActions: DocumentListAction[]
}

function RowOverflowMenu({ actions }: { actions: DocumentListAction[] }) {
  const [open, setOpen] = useState(false)
  if (actions.length === 0) return null

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <Tooltip label="More actions">
        <button
          onClick={() => setOpen(v => !v)}
          aria-label="More actions"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <MoreVertical size={14} />
        </button>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden py-1"
            >
              {actions.map(a => (
                <button
                  key={a.key}
                  onClick={e => { setOpen(false); a.onClick(e) }}
                  disabled={a.disabled}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function DocumentListRow({ entry }: { entry: DocumentListEntry }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={entry.onOpen}
      className="group flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50/80 cursor-pointer transition-colors"
    >
      <div className={cn('w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center', entry.iconClassName)}>
        {entry.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            title={entry.title}
            className="min-w-0 text-[13px] font-semibold text-slate-800 group-hover:text-orange-600 transition-colors truncate leading-snug"
          >
            {entry.title}
          </p>
          {entry.badges?.map(b => (
            <span key={b.label} className={cn('shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', b.className)}>
              {b.label}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{entry.metaLine}</p>
      </div>

      {entry.statusBadge && (
        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0', entry.statusBadge.className)}>
          {entry.statusBadge.label}
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        {entry.inlineActions.map(a => (
          <Tooltip key={a.key} label={a.label}>
            <button
              onClick={a.onClick}
              disabled={a.disabled}
              aria-label={a.label}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                a.disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:text-[#7c3aed] hover:bg-violet-50',
              )}
            >
              {a.icon}
            </button>
          </Tooltip>
        ))}
        <RowOverflowMenu actions={entry.overflowActions} />
      </div>
    </motion.div>
  )
}

interface DocumentListProps {
  entries: DocumentListEntry[]
  totalCount: number
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filterBar?: ReactNode
  headerRight?: ReactNode
  emptyIcon: ReactNode
  emptyTitle: string
  emptySubtitle: string
  noMatchTitle?: string
  noMatchSubtitle?: string
}

// Shared by AI Thesis's "Generated Documents" list and Proposal Studio's
// "Documents" list — owns search, the compact metadata line, and row
// actions so both stay in sync (see the AI Thesis + Proposal Studio UX audit).
export function DocumentList({
  entries,
  totalCount,
  search,
  onSearchChange,
  searchPlaceholder = 'Search documents...',
  filterBar,
  headerRight,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  noMatchTitle = 'No documents match your search',
  noMatchSubtitle = 'Try a different title or clear the search.',
}: DocumentListProps) {
  const isSearching = search.trim().length > 0
  const isSearchMiss = entries.length === 0 && isSearching && totalCount > 0

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        {filterBar}
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative max-w-xs w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-4 py-2 text-[13px] text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-500"
            />
          </div>
          {headerRight}
        </div>
      </div>

      {/* No overflow-hidden here — RowOverflowMenu's dropdown is an absolutely
          positioned child of the last row and needs to pop out below this
          container's edge. */}
      <div className="border border-slate-200 rounded-xl">
        <AnimatePresence>
          {entries.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                {isSearchMiss ? <Search size={20} className="text-slate-400" /> : emptyIcon}
              </div>
              <p className="text-[14px] text-slate-600 font-medium">{isSearchMiss ? noMatchTitle : emptyTitle}</p>
              <p className="text-[12px] text-slate-400">{isSearchMiss ? noMatchSubtitle : emptySubtitle}</p>
              {isSearchMiss && (
                <button
                  onClick={() => onSearchChange('')}
                  className="mt-1 text-[12px] font-medium text-[#7c3aed] hover:text-[#4c1d95] transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            entries.map(entry => <DocumentListRow key={entry.id} entry={entry} />)
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
