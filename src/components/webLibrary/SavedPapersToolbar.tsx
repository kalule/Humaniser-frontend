import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Download, LayoutList, Search, SlidersHorizontal, Upload, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { COLUMN_META, ORDERED_COLUMNS, type ColumnKey, type ResearchDocType } from '../../types/webLibrary'
import { SAVED_SORT_OPTIONS, activeSavedFilterCount, type SavedPaperFilters, type SavedSortKey } from '../../lib/savedPaperFilters'
import type { SortDir } from '../../lib/collectionsView'
import { SortControl } from './SortControl'
import { Select } from '../ui/Select'

const DOC_TYPES: ResearchDocType[] = ['Journal Article', 'Book', 'Book Chapter', 'Conference Paper', 'Preprint', 'Report', 'Thesis']

/** A small anchored menu: closes on outside click and Esc, returns focus to its button. */
function Menu({ label, icon, badge, children, align = 'right', buttonClass }: {
  label: ReactNode; icon: ReactNode; badge?: number; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; buttonClass?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus() } }
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onDown) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button ref={btn} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls={id}
        className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
          badge ? 'border-purple-accent bg-purple-tint/40 text-purple-accent' : 'border-slate-200 text-slate-700 hover:bg-slate-50', buttonClass)}>
        {icon}{label}
        {!!badge && <span className="rounded-full bg-purple-accent px-1.5 text-[11px] leading-[18px] text-white">{badge}</span>}
        <ChevronDown size={12} className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={id} className={cn('absolute top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

const menuHeading = 'px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600'
const menuItem = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50'

function Tick({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-purple-accent bg-purple-accent' : 'border-slate-300')}>
      {on && <Check size={10} className="text-white" />}
    </span>
  )
}

const toInt = (v: string) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : null }

export function SavedPapersToolbar({
  heading, count, query, onQuery, filters, onFilters, sortKey, sortDir, onSort,
  viewMode, onViewMode, visibleColumns, onToggleColumn, onExport, exportLabel, onImport,
}: {
  heading: string
  count: number
  query: string
  onQuery: (q: string) => void
  filters: SavedPaperFilters
  onFilters: (f: SavedPaperFilters) => void
  sortKey: SavedSortKey
  sortDir: SortDir
  onSort: (key: SavedSortKey, dir: SortDir) => void
  viewMode: 'library' | 'reference'
  onViewMode: (v: 'library' | 'reference') => void
  visibleColumns: ColumnKey[]
  onToggleColumn: (k: ColumnKey) => void
  onExport: () => void
  exportLabel: string
  onImport: () => void
}) {
  const filterCount = activeSavedFilterCount(filters)
  const yearError = filters.yearFrom != null && filters.yearTo != null && filters.yearFrom > filters.yearTo
  const input = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-800 outline-none focus:border-purple-accent'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 shrink-0">
      {/* Primary: where you are, find within it, narrow it, add to it */}
      <h1 className="mr-1 text-[14px] font-semibold text-slate-900">{heading} <span className="font-normal text-slate-600">· {count}</span></h1>
      <div className="relative min-w-[10rem] flex-1 max-w-sm">
        <Search size={14} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={query} onChange={e => onQuery(e.target.value)} aria-label="Search saved papers"
          placeholder="Search title, author, journal, DOI…"
          className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-7 text-[13px] text-slate-800 placeholder-slate-500 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20" />
        {query && <button onClick={() => onQuery('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-800"><X size={13} /></button>}
      </div>
      <Menu label="Filters" icon={<SlidersHorizontal size={13} />} badge={filterCount} align="left">
        {() => (
          <div className="space-y-3 px-3 py-2">
            <button className={cn(menuItem, 'px-0 hover:bg-transparent')} onClick={() => onFilters({ ...filters, withAbstractOnly: !filters.withAbstractOnly })}>
              <Tick on={!!filters.withAbstractOnly} /> Has an abstract
            </button>
            <button className={cn(menuItem, 'px-0 hover:bg-transparent')} onClick={() => onFilters({ ...filters, withDoiOnly: !filters.withDoiOnly })}>
              <Tick on={!!filters.withDoiOnly} /> Has a DOI
            </button>
            <fieldset>
              <legend className="mb-1 text-[12px] font-medium text-slate-700">Year</legend>
              <div className="flex items-center gap-1.5">
                <input aria-label="From year" type="number" placeholder="From" className={input} value={filters.yearFrom ?? ''} onChange={e => onFilters({ ...filters, yearFrom: toInt(e.target.value) })} />
                <span className="text-slate-500">–</span>
                <input aria-label="To year" type="number" placeholder="To" className={input} value={filters.yearTo ?? ''} onChange={e => onFilters({ ...filters, yearTo: toInt(e.target.value) })} />
              </div>
              {yearError && <p role="alert" className="mt-1 text-[12px] text-red-600">The start year is after the end year.</p>}
            </fieldset>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700" htmlFor="saved-type-filter">Type</label>
              <Select id="saved-type-filter" value={filters.docType ?? ''} onChange={e => onFilters({ ...filters, docType: e.target.value || null })}>
                <option value="">Any type</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            {filterCount > 0 && <button onClick={() => onFilters({})} className="text-[12.5px] font-medium text-slate-600 hover:text-slate-900">Clear filters</button>}
          </div>
        )}
      </Menu>

      <div className="flex-1" />

      {/* Secondary: how the list is shown */}
      <SortControl options={SAVED_SORT_OPTIONS} value={sortKey} dir={sortDir} onChange={onSort} />
      <Menu label="View" icon={<LayoutList size={13} className="text-slate-500" />}>
        {close => (
          <>
            <p className={menuHeading}>Layout</p>
            <div role="radiogroup" aria-label="Layout">
              {([['library', 'Library view', 'Papers with summary columns'], ['reference', 'Reference table', 'Dense metadata table']] as const).map(([v, l, hint]) => (
                <button key={v} role="radio" aria-checked={viewMode === v} className={menuItem} onClick={() => onViewMode(v)}>
                  <span aria-hidden className={cn('h-3.5 w-3.5 shrink-0 rounded-full border', viewMode === v ? 'border-[4px] border-purple-accent' : 'border-slate-300')} />
                  <span><span className="block">{l}</span><span className="block text-[11.5px] text-slate-600">{hint}</span></span>
                </button>
              ))}
            </div>
            {viewMode === 'library' && (
              <>
                <p className={menuHeading}>Summary columns · {visibleColumns.length} of {ORDERED_COLUMNS.length}</p>
                {ORDERED_COLUMNS.map(k => (
                  <button key={k} role="menuitemcheckbox" aria-checked={visibleColumns.includes(k)} className={menuItem} onClick={() => onToggleColumn(k)}>
                    <Tick on={visibleColumns.includes(k)} /> {COLUMN_META[k].label}
                  </button>
                ))}
                <p className="px-3 pb-1 text-[11.5px] text-slate-600">A column only shows once a paper in the list has that summary.</p>
              </>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button className={menuItem} onClick={() => { onExport(); close() }}><Download size={13} className="text-slate-500" /> {exportLabel}</button>
          </>
        )}
      </Menu>
      <button onClick={onImport} className="flex items-center gap-1.5 rounded-lg bg-purple-accent px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-purple-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 focus-visible:ring-offset-2">
        <Upload size={13} /> Import
      </button>
    </div>
  )
}
