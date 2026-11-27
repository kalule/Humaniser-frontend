import { useEffect, useId, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Dialog } from '../literatureMatrix/parts'
import type { Reason } from '../../lib/literatureReview'
import {
  isFiltered, orderExcludeReasons, OTHER_REASON, SORT_OPTIONS, VERDICT_OPTIONS, type Counters, type ScreeningSort, type ScreeningView,
} from '../../lib/literatureReviewScreening'
import { btn, inputClass } from './styles'
import { cn } from '../../lib/utils'

// Screen step controls: search and filters, the decision counters, the bulk bar and the bulk exclude dialog.

const SEARCH_DEBOUNCE_MS = 300
const selectClass = inputClass + ' py-1.5'

/** Search, filters and sort. Each change goes to the URL (through onChange), so a refresh or a shared link keeps the view. */
export function ScreeningFilters({ view, databases, matches, onChange }: {
  view: ScreeningView; databases: string[]; matches: number | null; onChange: (patch: Partial<ScreeningView>) => void
}) {
  const id = useId()
  const [search, setSearch] = useState(view.search)
  // Follow the URL when it changes from outside (Back, Clear filters), without fighting the reviewer's typing.
  // The URL holds the trimmed text, so an equal-but-for-spaces value is the reviewer's own and is kept.
  useEffect(() => { setSearch(s => s.trim() === view.search.trim() ? s : view.search) }, [view.search])
  useEffect(() => {
    if (search.trim() === view.search.trim()) return
    const t = window.setTimeout(() => onChange({ search }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [search, view.search, onChange])

  const filtered = isFiltered(view)
  return (
    <div className="mb-3 space-y-2" role="search" aria-label="Search and filter the papers">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <label htmlFor={`${id}-q`} className="sr-only">Search titles, authors, abstracts and the AI's reasons</label>
          <input id={`${id}-q`} type="search" value={search} maxLength={200} onChange={e => setSearch(e.target.value)}
            placeholder="Search titles, authors, abstracts, AI reasons" className={inputClass + ' pl-8'} />
        </div>
        <label htmlFor={`${id}-sort`} className="sr-only">Sort</label>
        <select id={`${id}-sort`} value={view.sort} onChange={e => onChange({ sort: e.target.value as ScreeningSort })} className={selectClass + ' w-auto'}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <YearInput label="From year" value={view.yearFrom} onCommit={yearFrom => onChange({ yearFrom })} />
        <YearInput label="To year" value={view.yearTo} onCommit={yearTo => onChange({ yearTo })} />
        <Field label="Database" htmlFor={`${id}-db`}>
          <select id={`${id}-db`} value={view.database} onChange={e => onChange({ database: e.target.value })} className={selectClass}>
            <option value="">Any database</option>
            {databases.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Abstract" htmlFor={`${id}-abs`}>
          <select id={`${id}-abs`} value={view.hasAbstract === null ? '' : view.hasAbstract ? 'yes' : 'no'}
            onChange={e => onChange({ hasAbstract: e.target.value === '' ? null : e.target.value === 'yes' })} className={selectClass}>
            <option value="">With or without</option>
            <option value="yes">Has an abstract</option>
            <option value="no">No abstract</option>
          </select>
        </Field>
        <Field label="AI verdict" htmlFor={`${id}-verdict`}>
          <select id={`${id}-verdict`} value={view.verdict} onChange={e => onChange({ verdict: e.target.value as ScreeningView['verdict'] })} className={selectClass}>
            <option value="">Any verdict</option>
            {VERDICT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      {filtered ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-700">
          <span role="status" aria-live="polite">{matches === null ? 'Searching…' : `${matches} ${matches === 1 ? 'match' : 'matches'}`}</span>
          <button type="button" className={btn.link}
            onClick={() => { setSearch(''); onChange({ search: '', yearFrom: null, yearTo: null, database: '', hasAbstract: null, verdict: '' }) }}>
            Clear search and filters
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-0.5 block text-[12px] font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

/** A year box that commits only a complete four-digit year (or empty), so typing "20" does not filter on year 20. */
function YearInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (year: number | null) => void }) {
  const id = useId()
  const [draft, setDraft] = useState(value?.toString() ?? '')
  useEffect(() => { setDraft(value?.toString() ?? '') }, [value])
  const change = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    setDraft(digits)
    if (digits === '') { if (value !== null) onCommit(null) }
    else if (digits.length === 4 && Number(digits) !== value) onCommit(Number(digits))
  }
  return (
    <Field label={label} htmlFor={id}>
      <input id={id} inputMode="numeric" autoComplete="off" placeholder="Any" value={draft} onChange={e => change(e.target.value)} className={selectClass} />
    </Field>
  )
}

/** Decision counts for the whole review, plus the selection. Announced politely when they change. */
export function ScreeningCounters({ counts, selected, showSelected }: { counts: Counters; selected: number; showSelected: boolean }) {
  const items: [string, number][] = [
    ['Included', counts.included],
    ...(counts.suggested > 0 ? [['Suggested by AI', counts.suggested] as [string, number]] : []),
    ['Needs full text', counts.needsFullText],
    ['Excluded', counts.excluded],
    ['Needs your decision', counts.undecided],
    ['Not screened', counts.notScreened],
  ]
  if (showSelected) items.push(['Selected', selected])
  return (
    <dl aria-live="polite" className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
      {items.map(([label, n]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="text-slate-700">{label}</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{n}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Shown while papers are selected. Sticks to the bottom of the viewport so it stays in reach in a long list. */
export function BulkBar({ count, busy, onInclude, onIncludeNeedsFullText, onExclude, onClear }: {
  count: number; busy: boolean; onInclude: () => void; onIncludeNeedsFullText: () => void; onExclude: () => void; onClear: () => void
}) {
  return (
    <div role="region" aria-label="Bulk actions"
      className="sticky bottom-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-purple-accent/30 bg-purple-tint p-2 text-[13px] shadow-sm">
      <span className="font-medium text-purple-text">{count} selected</span>
      <button type="button" disabled={busy} onClick={onInclude} className={btn.small}>Include</button>
      <button type="button" disabled={busy} onClick={onIncludeNeedsFullText} className={btn.small}>Include, need full text</button>
      <button type="button" disabled={busy} onClick={onExclude} className={btn.small}>Exclude…</button>
      <button type="button" disabled={busy} onClick={onClear} className={cn(btn.small, 'ml-auto')}><X size={13} aria-hidden />Clear selection</button>
    </div>
  )
}

/** One reason for every selected paper. "Other" needs a few words, so the methods section can say why. */
export function BulkExcludeDialog({ count, reasons, busy, onCancel, onConfirm }: {
  count: number; reasons: Reason[]; busy: boolean; onCancel: () => void; onConfirm: (reasonCode: string, note: string | undefined) => void
}) {
  const id = useId()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const needsNote = reason === OTHER_REASON
  const valid = !!reason && (!needsNote || note.trim().length > 0)
  const submit = () => { if (valid) onConfirm(reason, note.trim() || undefined) }
  return (
    <Dialog title={`Exclude ${count} ${count === 1 ? 'paper' : 'papers'}`} onClose={onCancel}
      footer={<>
        <button type="button" onClick={onCancel} className={btn.secondary}>Cancel</button>
        <button type="button" onClick={submit} disabled={!valid || busy} className={btn.primary}>{busy ? 'Excluding…' : `Exclude ${count}`}</button>
      </>}>
      <fieldset>
        <legend className="mb-2 text-[14px] font-medium text-slate-900">Why are these papers excluded?</legend>
        <div className="space-y-1.5">
          {orderExcludeReasons(reasons).map(r => (
            <label key={r.code} className="flex items-center gap-2 text-[14px] text-slate-800">
              <input type="radio" name={`${id}-reason`} value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${id}-note`} className="mt-3 block text-[13px] font-medium text-slate-800">
        {needsNote ? 'Say what the reason is (required)' : 'Note (optional)'}
      </label>
      <textarea id={`${id}-note`} value={note} maxLength={500} rows={2} onChange={e => setNote(e.target.value)} className={inputClass} aria-required={needsNote} />
      <p className="mt-2 text-[12px] text-slate-600">
        The reason is saved on every paper and used in the methods section. Papers already in the review are taken out of it; anything extracted from them is kept. You can undo this straight after.
      </p>
    </Dialog>
  )
}
