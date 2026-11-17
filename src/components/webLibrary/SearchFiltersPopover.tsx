import { useEffect, useId, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Select } from '../ui/Select'
import type { PaperSearchFilters, PaperTypeFilter } from '../../types/webLibrary'
import { TYPE_FILTER_LABELS, activeFilterLabels } from '../../lib/findPapersChips'

const CURRENT_YEAR = new Date().getFullYear()

function toInt(value: string): number | undefined {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

/** Filters button + popover. Edits a draft; nothing is searched until Apply. Every button is
 *  type="button": the popover sits inside the search form, where a bare button submits it. */
export function SearchFiltersPopover({ value, onApply }: { value: PaperSearchFilters; onApply: (f: PaperSearchFilters) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PaperSearchFilters>(value)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const activeCount = activeFilterLabels(value).length
  const yearError = draft.yearFrom != null && draft.yearTo != null && draft.yearFrom > draft.yearTo

  useEffect(() => { if (open) setDraft(value) }, [open, value])

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('input, select')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick) }
  }, [open])

  const apply = () => {
    if (yearError) return
    const clean: PaperSearchFilters = {}
    if (draft.yearFrom != null) clean.yearFrom = draft.yearFrom
    if (draft.yearTo != null) clean.yearTo = draft.yearTo
    if (draft.openAccess) clean.openAccess = true
    if (draft.type) clean.type = draft.type
    if (draft.minCitations != null && draft.minCitations > 0) clean.minCitations = draft.minCitations
    if (draft.field?.trim()) clean.field = draft.field.trim()
    onApply(clean)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const label = 'block text-[12px] font-medium text-slate-700 mb-1'
  const input = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-800 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20'

  return (
    <div className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className={cn(
          'flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
          activeCount > 0 ? 'border-purple-accent text-purple-accent bg-purple-tint/40' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
        )}
      >
        <SlidersHorizontal size={14} /> Filters
        {activeCount > 0 && <span className="rounded-full bg-purple-accent px-1.5 text-[11px] leading-[18px] text-white">{activeCount}</span>}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="dialog"
          aria-label="Search filters"
          className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <div className="space-y-3.5">
            <fieldset>
              <legend className={label}>Publication year</legend>
              <div className="flex items-center gap-2">
                <input aria-label="From year" type="number" inputMode="numeric" min={1800} max={CURRENT_YEAR} placeholder="From" className={input}
                  value={draft.yearFrom ?? ''} onChange={e => setDraft(d => ({ ...d, yearFrom: toInt(e.target.value) }))} />
                <span className="text-slate-500">–</span>
                <input aria-label="To year" type="number" inputMode="numeric" min={1800} max={CURRENT_YEAR} placeholder="To" className={input}
                  value={draft.yearTo ?? ''} onChange={e => setDraft(d => ({ ...d, yearTo: toInt(e.target.value) }))} />
              </div>
              {yearError && <p role="alert" className="mt-1 text-[12px] text-red-600">The start year is after the end year.</p>}
            </fieldset>

            <div>
              <label htmlFor={`${id}-type`} className={label}>Study type</label>
              <Select id={`${id}-type`} value={draft.type ?? ''}
                onChange={e => setDraft(d => ({ ...d, type: (e.target.value || undefined) as PaperTypeFilter | undefined }))}>
                <option value="">Any type</option>
                {(Object.keys(TYPE_FILTER_LABELS) as PaperTypeFilter[]).map(t => <option key={t} value={t}>{TYPE_FILTER_LABELS[t]}</option>)}
              </Select>
            </div>

            <div>
              <label htmlFor={`${id}-field`} className={label}>Field or subject</label>
              <input id={`${id}-field`} className={input} placeholder="e.g. Public health" value={draft.field ?? ''}
                onChange={e => setDraft(d => ({ ...d, field: e.target.value }))} />
              <p className="mt-1 text-[11.5px] text-slate-500">Matches subject tags, which only OpenAlex records carry.</p>
            </div>

            <div>
              <label htmlFor={`${id}-cites`} className={label}>Minimum citations</label>
              <input id={`${id}-cites`} type="number" inputMode="numeric" min={0} className={input} placeholder="0" value={draft.minCitations ?? ''}
                onChange={e => setDraft(d => ({ ...d, minCitations: toInt(e.target.value) }))} />
            </div>

            <label className="flex items-center gap-2 text-[13px] text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-purple-600" checked={!!draft.openAccess}
                onChange={e => setDraft(d => ({ ...d, openAccess: e.target.checked }))} />
              Open access only <span className="text-[11.5px] text-slate-500">(as the database reports it)</span>
            </label>
          </div>

          <p className="mt-4 text-[11.5px] leading-snug text-slate-500">
            Filters narrow the 100 most relevant matches for your search. Records missing a year, type or citation count are left out when you filter on it.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => setDraft({})} className="text-[13px] font-medium text-slate-600 hover:text-slate-900">Reset</button>
            <button type="button" onClick={apply} disabled={yearError}
              className="rounded-lg bg-purple-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-purple-deep disabled:opacity-50">
              Apply filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
