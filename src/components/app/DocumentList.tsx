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
  /** Optional visible action label; existing icon-only consumers are unchanged. */
  showLabel?: boolean
  // Overflow-menu styling only. Defaults to true so existing delete-only
  // menus (ThesisStudioPage) keep their red styling unchanged; pass false
  // for a non-destructive action sharing the menu, e.g. "Open".
  destructive?: boolean
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
  // progressPct is optional and purely additive — only a caller that has real
  // progress data (Proposal Studio) passes it, which renders a thin bar under
  // the chip; callers with a fixed enum status (ThesisStudioPage) omit it and
  // are unaffected.
  statusBadge?: { label: string; className: string; progressPct?: number }
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
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors disabled:opacity-40',
                    a.destructive === false ? 'text-slate-700 hover:bg-slate-50' : 'text-red-600 hover:bg-red-50',
                  )}
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
      role="button"
      tabIndex={0}
      aria-label={`Open ${entry.title}`}
      onKeyDown={e => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); entry.onOpen() }
      }}
      className="group flex flex-wrap items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50/80 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40 focus-visible:ring-inset"
    >
      <div className={cn('w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center', entry.iconClassName)}>
        {entry.icon}
      </div>

      <div className="min-w-0 flex-1 basis-[180px]">
        <p
          title={entry.title}
          className="min-w-0 text-[13px] font-semibold text-slate-800 group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug"
        >
          {entry.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-[11px] text-slate-500">{entry.metaLine}</p>
          {entry.badges?.map(b => (
            <span key={b.label} className={cn('shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', b.className)}>
              {b.label}
            </span>
          ))}
        </div>
      </div>

      {entry.statusBadge && (
        <div className="flex flex-col items-end justify-center gap-1 shrink-0 min-w-[108px]">
          <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', entry.statusBadge.className)}>
            {entry.statusBadge.label}
          </span>
          {entry.statusBadge.progressPct !== undefined && entry.statusBadge.progressPct > 0 && entry.statusBadge.progressPct < 100 && (
            <div
              role="progressbar"
              aria-valuenow={Math.round(entry.statusBadge.progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-[3px] rounded-full bg-slate-100 overflow-hidden"
            >
              <div className="h-full rounded-full bg-purple-accent" style={{ width: `${entry.statusBadge.progressPct}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
        {entry.inlineActions.map(a => (
          <Tooltip key={a.key} label={a.label}>
            <button
              onClick={a.onClick}
              disabled={a.disabled}
              aria-label={a.label}
              className={cn(
                a.showLabel ? 'px-2 min-h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors' : 'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                a.disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:text-[#7c3aed] hover:bg-violet-50',
              )}
            >
              {a.icon}{a.showLabel && <span>{a.label}</span>}
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
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
      </div>
    </div>
  )
}
