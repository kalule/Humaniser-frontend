import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Columns3, FileDown, Plus, Sparkles, Trash2 } from 'lucide-react'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import {
  creditEstimate, failureMessage, isRunActive, materialCounts, materialLabel, matchesFilter, matchesSearch, MAX_CELL_CHARS,
  PAGE_SIZE, ROW_FILTERS, runSummary, sortStudies, studyLabel, withCell,
  type Matrix, type MatrixColumn, type MatrixRun, type MatrixStudy, type RowFilter, type SortKey,
} from '../../lib/literatureMatrix'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { AddSourcesDialog } from './AddSourcesDialog'
import { CompareDialog } from './CompareDialog'
import { EvidenceDrawer } from './EvidenceDrawer'
import { ExportMenu } from './ExportMenu'
import { HandOffDialog } from './HandOffDialog'
import { ConsentNotice, Dialog, ErrorAlert, StatusChip, buttonClass } from './parts'

const POLL_MS = 3000

/**
 * One matrix: the table is the screen. Rows are loaded once (a matrix holds at most a few hundred), searched,
 * filtered and sorted here, and shown a page at a time so a 500-row matrix stays quick.
 */
export function MatrixWorkspace({ matrix, onMatrixChange, onDeleted }: { matrix: Matrix; onMatrixChange: (m: Matrix) => void; onDeleted: () => void }) {
  const [rows, setRows] = useState<MatrixStudy[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<RowFilter>('all')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'added', desc: false })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [run, setRun] = useState<MatrixRun | null>(null)
  const [dialog, setDialog] = useState<null | 'add' | 'extract' | 'compare' | 'columns' | 'delete' | 'handoff'>(null)
  const [drawer, setDrawer] = useState<string | null>(null)
  const { confirm: ask, dialog: confirmDialog } = useConfirm()

  const loadRows = useCallback(() => {
    setLoadError(null)
    literatureMatrixApi.studies(matrix.id).then(p => setRows(p.items)).catch(e => setLoadError(failureMessage(e, 'load')))
  }, [matrix.id])
  useEffect(loadRows, [loadRows])
  useEffect(() => { literatureMatrixApi.latestRun(matrix.id).then(setRun).catch(() => setRun(null)) }, [matrix.id])

  // While a run is going, poll it; when it ends, reload the rows once.
  const active = isRunActive(run)
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      literatureMatrixApi.latestRun(matrix.id).then(next => {
        setRun(next)
        if (!isRunActive(next)) loadRows()
      }).catch(() => undefined)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [active, matrix.id, loadRows])

  const visibleColumns = useMemo(() => matrix.columns.filter(c => c.isVisible).sort((a, b) => a.ordinal - b.ordinal), [matrix.columns])
  const shown = useMemo(() => {
    if (!rows) return []
    return sortStudies(rows.filter(r => matchesFilter(r, filter) && matchesSearch(r, search)), sort.key, sort.desc)
  }, [rows, filter, search, sort])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const pageRows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  useEffect(() => setPage(1), [filter, search])

  const replaceRow = (row: MatrixStudy) => setRows(rs => rs?.map(r => r.id === row.id ? row : r) ?? rs)
  const selectedRows = rows?.filter(r => selected.has(r.id)) ?? []
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOnPage = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
  const toggleAll = () => setSelected(s => {
    const n = new Set(s)
    if (allOnPage) pageRows.forEach(r => n.delete(r.id)); else pageRows.forEach(r => n.add(r.id))
    return n
  })

  const act = async (work: () => Promise<string | void>, action: Parameters<typeof failureMessage>[1]) => {
    setActionError(null)
    setNotice(null)
    try {
      const message = await work()
      if (message) setNotice(message)
    } catch (e) {
      setActionError(failureMessage(e, action))
    }
  }

  const bulkVerify = (verified: boolean) => act(async () => {
    const result = await literatureMatrixApi.bulkVerify(matrix.id, [...selected], verified)
    loadRows()
    if (!verified) return `Cleared ${result.changed} ${result.changed === 1 ? 'mark' : 'marks'}.`
    return `Marked ${result.changed} ${result.changed === 1 ? 'value' : 'values'} as verified.` +
      (result.skippedUncertain > 0 ? ` ${result.skippedUncertain} marked "Check this" were left for you to check one at a time.` : '')
  }, 'save')

  const removeSelected = async () => {
    const noun = selected.size === 1 ? 'study' : 'studies'
    const ok = await ask({
      title: `Remove ${selected.size} ${noun} from this matrix?`,
      message: 'Their extracted values and any uploaded text are deleted. Your saved sources are not.',
      confirmLabel: `Remove ${noun}`,
      tone: 'danger',
    })
    if (!ok) return
    act(async () => {
      for (const id of selected) await literatureMatrixApi.removeStudy(id)
      setSelected(new Set())
      loadRows()
      return 'Removed from the matrix.'
    }, 'delete')
  }

  const counts = rows ? materialCounts(rows) : null
  const toggleSort = (key: SortKey) => setSort(s => s.key === key ? { key, desc: !s.desc } : { key, desc: false })

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{matrix.name}</h2>
            {matrix.researchQuestion ? <p className="mt-0.5 max-w-3xl text-[13px] text-slate-700 [overflow-wrap:anywhere]">Research question: {matrix.researchQuestion}</p> : null}
            {counts && rows && rows.length > 0 ? (
              <p className="mt-1 text-[13px] text-slate-700">
                {rows.length} {rows.length === 1 ? 'study' : 'studies'}: {counts.FullText} with full text, {counts.Abstract} abstract only, {counts.Metadata} with details only.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass.secondary} onClick={() => setDialog('add')}><Plus size={15} />Add sources</button>
            <button type="button" className={buttonClass.primary} disabled={!rows?.length || active || !matrix.extractionAvailable} onClick={() => setDialog('extract')}>
              <Sparkles size={15} />{selected.size > 0 ? `Extract ${selected.size} selected` : 'Extract all'}
            </button>
            <ExportMenu matrix={matrix} studyIds={[...selected]} disabled={!rows?.length} onError={m => setActionError(m)} />
            <button type="button" className={buttonClass.secondary} disabled={!rows?.some(r => r.cells.some(c => c.verified))}
              title="Studies with values you checked" onClick={() => setDialog('handoff')}>
              <FileDown size={15} />Use in literature review
            </button>
            <button type="button" className={buttonClass.danger} onClick={() => setDialog('delete')} aria-label="Delete matrix"><Trash2 size={15} /></button>
          </div>
        </div>

        {run ? <RunBanner run={run} /> : null}
        {!matrix.extractionAvailable ? <p className="mt-2 text-[13px] text-slate-700">Extraction is switched off at the moment. You can still add sources and enter values yourself.</p> : null}
        {notice ? <p role="status" className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-[13px] text-emerald-900">{notice}</p> : null}
        {actionError ? <div className="mt-2"><ErrorAlert message={actionError} /></div> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="lm-search">Search the matrix</label>
          <input id="lm-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search studies and values"
            className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] sm:w-64" />
          <label className="sr-only" htmlFor="lm-filter">Show</label>
          <select id="lm-filter" value={filter} onChange={e => setFilter(e.target.value as RowFilter)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[13px]">
            {ROW_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button type="button" className={buttonClass.secondary} onClick={() => setDialog('columns')}><Columns3 size={15} />Columns ({visibleColumns.length} of {matrix.columns.length})</button>
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-[13px]" role="group" aria-label="Selected studies">
              <span className="font-medium text-slate-900">{selected.size} selected</span>
              <button type="button" className={buttonClass.link} onClick={() => bulkVerify(true)}>Mark verified</button>
              <button type="button" className={buttonClass.link} onClick={() => bulkVerify(false)}>Clear marks</button>
              <button type="button" className={buttonClass.link} disabled={selected.size < 2 || selected.size > 3} title={selected.size < 2 || selected.size > 3 ? 'Choose two or three studies to compare' : undefined} aria-label={selected.size >= 2 && selected.size <= 3 ? `Compare ${selected.size} selected studies` : undefined} onClick={() => setDialog('compare')}>Compare</button>
              <button type="button" className={buttonClass.link} onClick={() => void removeSelected()}>Remove</button>
              <button type="button" className={buttonClass.link} onClick={() => setSelected(new Set())}>Clear selection</button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {loadError ? <div className="p-4"><ErrorAlert message={loadError} onRetry={loadRows} /></div>
          : rows === null ? <div className="p-4"><Skeleton lines={8} tone="light" /></div>
          : rows.length === 0 ? <EmptyState onAdd={() => setDialog('add')} />
          : shown.length === 0 ? <p className="p-6 text-[14px] text-slate-700">No study matches this search or filter.</p>
          : (
            <table className="min-w-full border-separate border-spacing-0 text-left text-[13px]">
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr>
                  <th scope="col" className="sticky left-0 z-30 w-9 border-b border-slate-200 bg-slate-50 px-2 py-2">
                    <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all studies on this page" />
                  </th>
                  <SortHeader label="Study" sortKey="study" sort={sort} onSort={toggleSort} className="sticky left-9 z-30 min-w-[220px] max-w-[280px] bg-slate-50" />
                  {visibleColumns.map(c => <SortHeader key={c.id} label={c.label} sortKey={`col:${c.key}`} sort={sort} onSort={toggleSort} interpretation={c.isInterpretation} className="min-w-[200px] max-w-[320px]" />)}
                  <th scope="col" className="min-w-[140px] border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Themes</th>
                  <th scope="col" className="min-w-[140px] border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => (
                  <tr key={row.id} className="align-top">
                    <td className="sticky left-0 z-10 border-b border-slate-200 bg-white px-2 py-2">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${studyLabel(row)}`} />
                    </td>
                    <th scope="row" className="sticky left-9 z-10 min-w-[220px] max-w-[280px] border-b border-slate-200 bg-white px-3 py-2 font-normal">
                      <button type="button" onClick={() => setDrawer(row.id)} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
                        <span className="block font-semibold text-purple-deep underline">{studyLabel(row)}</span>
                        <span className="mt-0.5 line-clamp-2 text-slate-700 [overflow-wrap:anywhere]" title={row.title}>{row.title}</span>
                      </button>
                      <RowState row={row} />
                    </th>
                    {visibleColumns.map(c => (
                      <EditableCell key={c.id} row={row} column={c} onSaved={replaceRow} onError={m => setActionError(m)} />
                    ))}
                    <td className="border-b border-slate-200 px-3 py-2">
                      {row.themes.length > 0 ? <ul className="flex flex-wrap gap-1">{row.themes.map(t => <li key={t} className="rounded-full bg-purple-tint px-2 py-px text-[11px] text-purple-text [overflow-wrap:anywhere]">{t}</li>)}</ul> : <span className="text-slate-500">None</span>}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-slate-800">
                      <span title={materialLabel(row.material).long}>{materialLabel(row.material).short}</span>
                      {row.doi ? <span className="mt-0.5 block text-[11px] text-slate-600 [overflow-wrap:anywhere]">DOI {row.doi}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {rows && shown.length > PAGE_SIZE ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-[13px] text-slate-700">
          <span>Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, shown.length)} of {shown.length}</span>
          <span className="flex gap-2">
            <button type="button" className={buttonClass.secondary} disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button>
            <button type="button" className={buttonClass.secondary} disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button>
          </span>
        </nav>
      ) : null}

      {dialog === 'add' ? <AddSourcesDialog matrix={matrix} onClose={() => setDialog(null)} onAdded={message => { setNotice(message); loadRows(); onMatrixChange({ ...matrix, consentAccepted: true }) }} /> : null}
      {dialog === 'extract' && rows ? (
        <ExtractDialog matrix={matrix} studies={selected.size > 0 ? selectedRows : rows} onClose={() => setDialog(null)}
          onStarted={next => { setRun(next); setDialog(null); setRows(rs => rs?.map(r => (selected.size === 0 || selected.has(r.id)) ? { ...r, extractionState: 'Queued' } : r) ?? rs); onMatrixChange({ ...matrix, consentAccepted: true }) }} />
      ) : null}
      {dialog === 'compare' ? <CompareDialog matrix={matrix} studyIds={[...selected]} onClose={() => setDialog(null)} /> : null}
      {dialog === 'columns' ? <ColumnsDialog matrix={matrix} onChange={onMatrixChange} onClose={() => setDialog(null)} /> : null}
      {dialog === 'delete' ? <DeleteDialog matrix={matrix} onClose={() => setDialog(null)} onDeleted={onDeleted} /> : null}
      {dialog === 'handoff' && rows ? <HandOffDialog matrix={matrix} rows={selected.size > 0 ? selectedRows : rows} onClose={() => setDialog(null)} /> : null}
      {drawer ? (
        <EvidenceDrawer studyId={drawer} matrix={matrix} onClose={() => setDrawer(null)} onRowChange={replaceRow}
          onRemoved={() => { setDrawer(null); loadRows() }} onMatrixChange={onMatrixChange} />
      ) : null}
      {confirmDialog}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <p className="text-[15px] font-semibold text-slate-900">No studies yet</p>
      <p className="mt-1 text-[14px] text-slate-700">Add papers from your saved sources, from a literature search, or upload a PDF or Word file.</p>
      <button type="button" className={cn(buttonClass.primary, 'mt-4')} onClick={onAdd}><Plus size={15} />Add sources</button>
    </div>
  )
}

function SortHeader({ label, sortKey, sort, onSort, className, interpretation }: {
  label: string; sortKey: SortKey; sort: { key: SortKey; desc: boolean }; onSort: (k: SortKey) => void; className?: string; interpretation?: boolean
}) {
  const active = sort.key === sortKey
  return (
    <th scope="col" aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'} className={cn('border-b border-slate-200 px-3 py-2', className)}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-purple-deep">
        <span className="[overflow-wrap:anywhere]">{label}</span>
        {active ? (sort.desc ? <ArrowDown size={13} aria-hidden /> : <ArrowUp size={13} aria-hidden />) : null}
      </button>
      {interpretation ? <span className="block text-[11px] font-normal text-slate-600">AI judgement</span> : null}
    </th>
  )
}

function RowState({ row }: { row: MatrixStudy }) {
  const items: { text: string; tone: string }[] = []
  if (row.extractionState === 'Queued') items.push({ text: 'Waiting to be analysed', tone: 'text-slate-700' })
  if (row.extractionState === 'Failed') items.push({ text: row.extractionError ?? 'Could not be analysed.', tone: 'text-red-700' })
  if (row.possibleDuplicateOfId) items.push({ text: 'Possible duplicate: open to decide', tone: 'text-amber-800' })
  if (row.sourceDeleted) items.push({ text: 'Removed from your saved sources', tone: 'text-slate-700' })
  if (items.length === 0) return null
  return <ul className="mt-1 space-y-0.5 text-[11px]">{items.map(i => <li key={i.text} className={i.tone}>{i.text}</li>)}</ul>
}

/** A cell: click to edit, saved when you leave the field. The extracted value is kept beside yours. */
function EditableCell({ row, column, onSaved, onError }: { row: MatrixStudy; column: MatrixColumn; onSaved: (r: MatrixStudy) => void; onError: (m: string) => void }) {
  const cell = row.cells.find(c => c.columnId === column.id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (editing) area.current?.focus() }, [editing])

  const start = () => { setDraft(cell?.value ?? ''); setEditing(true) }
  const save = async () => {
    setEditing(false)
    const next = draft.trim()
    if (next === (cell?.value ?? '').trim()) return
    if (next.length > MAX_CELL_CHARS) { onError(`A cell can hold up to ${MAX_CELL_CHARS.toLocaleString('en-GB')} characters.`); return }
    // Clearing a cell that holds only an extracted value would remove nothing of yours: there is nothing to save.
    if (next.length === 0 && !cell?.edited) return
    setSaving(true)
    try {
      onSaved(withCell(row, await literatureMatrixApi.updateCell(row.id, column.id, { value: next })))
    } catch (e) {
      onError(failureMessage(e, 'save'))
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <td className="min-w-[200px] max-w-[320px] border-b border-slate-200 bg-purple-tint/20 px-2 py-1.5">
        <label className="sr-only" htmlFor={`cell-${row.id}-${column.id}`}>{column.label} for {studyLabel(row)}</label>
        <textarea id={`cell-${row.id}-${column.id}`} ref={area} rows={4} value={draft} maxLength={MAX_CELL_CHARS} onChange={e => setDraft(e.target.value)} onBlur={save}
          onKeyDown={e => { if (e.key === 'Escape') { setEditing(false) } }}
          className="w-full rounded border border-slate-300 p-1.5 text-[13px]" />
        <p className="text-[11px] text-slate-600">Saved when you leave the box. Esc cancels.{cell?.edited ? ' Empty it to show the extracted value again.' : ''}</p>
      </td>
    )
  }
  return (
    <td className="min-w-[200px] max-w-[320px] border-b border-slate-200 px-3 py-2">
      <button type="button" onClick={start} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40" aria-label={`Edit ${column.label} for ${studyLabel(row)}`}>
        {cell?.value ? <span className="line-clamp-4 text-slate-900 [overflow-wrap:anywhere]" title={cell.value}>{cell.value}</span> : null}
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <StatusChip status={cell?.status} verified={cell?.verified} interpretation={column.isInterpretation} />
          {saving ? <span className="text-[11px] text-slate-600">Saving…</span> : null}
        </span>
      </button>
    </td>
  )
}

function RunBanner({ run }: { run: MatrixRun }) {
  if (isRunActive(run)) {
    const done = run.studiesDone + run.studiesSkipped + run.studiesFailed
    return (
      <div role="status" className="mt-2 rounded-lg border border-sky-300 bg-sky-50 p-2 text-[13px] text-sky-900">
        Extracting: {done} of {run.studiesTotal} studies done. You can leave this page; it carries on.
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-sky-100" aria-hidden><div className="h-full bg-sky-500" style={{ width: `${run.studiesTotal ? Math.round(done / run.studiesTotal * 100) : 0}%` }} /></div>
      </div>
    )
  }
  if (!run.completedAt || Date.now() - new Date(run.completedAt).getTime() > 10 * 60_000) return null
  return (
    <p role="status" className={cn('mt-2 rounded-lg border p-2 text-[13px]', run.status === 'Failed' ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-800')}>
      Last extraction: {runSummary(run)}{run.message ? ` ${run.message}` : ''}
    </p>
  )
}

function ExtractDialog({ matrix, studies, onClose, onStarted }: { matrix: Matrix; studies: MatrixStudy[]; onClose: () => void; onStarted: (r: MatrixRun) => void }) {
  const [consent, setConsent] = useState(false)
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const counts = materialCounts(studies)
  const maxCredits = creditEstimate(studies, matrix.creditsPerStudy)
  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      onStarted(await literatureMatrixApi.startExtraction(matrix.id, { studyIds: studies.map(s => s.id), consentAccepted: consent || matrix.consentAccepted, force }))
    } catch (e) {
      setError(failureMessage(e, 'extract'))
      setBusy(false)
    }
  }
  const blocked = !matrix.consentAccepted && !consent
  return (
    <Dialog title={`Extract ${studies.length} ${studies.length === 1 ? 'study' : 'studies'}`} onClose={onClose}
      footer={<><button type="button" className={buttonClass.secondary} onClick={onClose}>Cancel</button><button type="button" className={buttonClass.primary} disabled={busy || blocked} onClick={start}>{busy ? 'Starting…' : 'Start extraction'}</button></>}>
      <div className="space-y-3 text-[14px] text-slate-800">
        <p>{counts.FullText} with full text, {counts.Abstract} with the abstract only, {counts.Metadata} with details only.</p>
        {counts.Abstract > 0 ? <p className="text-[13px]">From an abstract, methods, sampling and limitations are often not reported. Those cells will say "Not reported", which means not in the abstract, not that the study left them out. Upload the paper to get them from the full text.</p> : null}
        {counts.Metadata > 0 ? <p className="text-[13px]">Studies with details only have no text to read. They are not sent to the AI and cost nothing.</p> : null}
        <p className="font-medium text-slate-900">
          Up to {maxCredits} credits ({matrix.creditsPerStudy} per study). You are charged only for studies analysed successfully; studies that have not changed since they were last analysed are skipped and cost nothing.
        </p>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} className="mt-0.5" />
          Analyse unchanged studies again as well (they will be charged). Your own values are never overwritten.
        </label>
        {!matrix.consentAccepted ? <ConsentNotice checked={consent} onChange={setConsent} retentionDays={matrix.retentionDays} id="lm-extract-consent" /> : null}
        {error ? <ErrorAlert message={error} /> : null}
      </div>
    </Dialog>
  )
}

function ColumnsDialog({ matrix, onChange, onClose }: { matrix: Matrix; onChange: (m: Matrix) => void; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const columns = [...matrix.columns].sort((a, b) => a.ordinal - b.ordinal)
  const { confirm: ask, dialog: confirmDialog } = useConfirm()
  const deleteColumn = async (c: MatrixColumn) => {
    const ok = await ask({ title: `Delete the column “${c.label}”?`, message: 'The column and every value in it are deleted.', confirmLabel: 'Delete column', tone: 'danger' })
    if (ok) void run(() => literatureMatrixApi.deleteColumn(c.id))
  }
  const run = async (work: () => Promise<Matrix>) => {
    setBusy(true)
    setError(null)
    try { onChange(await work()) } catch (e) { setError(failureMessage(e, 'save')) } finally { setBusy(false) }
  }
  return (
    <Dialog title="Columns" onClose={onClose} footer={<button type="button" className={buttonClass.secondary} onClick={onClose}>Done</button>}>
      <p className="text-[13px] text-slate-700">Hidden columns are not shown, exported or extracted. Built-in columns can be hidden but not changed, so they mean the same in every matrix.</p>
      <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
        {columns.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
            <label className="flex min-w-0 flex-1 items-start gap-2">
              <input type="checkbox" checked={c.isVisible} disabled={busy} onChange={e => run(() => literatureMatrixApi.updateColumn(c.id, { isVisible: e.target.checked }))} className="mt-0.5" />
              <span className="min-w-0"><span className="font-medium text-slate-900 [overflow-wrap:anywhere]">{c.label}</span>{c.isCustom ? <span className="ml-1 text-slate-600">(yours)</span> : null}
                <span className="block text-[12px] text-slate-600 [overflow-wrap:anywhere]">{c.instruction}</span></span>
            </label>
            <button type="button" className={buttonClass.link} disabled={busy || i === 0} onClick={() => run(() => literatureMatrixApi.updateColumn(c.id, { ordinal: i }))} aria-label={`Move ${c.label} up`}>Up</button>
            <button type="button" className={buttonClass.link} disabled={busy || i === columns.length - 1} onClick={() => run(() => literatureMatrixApi.updateColumn(c.id, { ordinal: i + 2 }))} aria-label={`Move ${c.label} down`}>Down</button>
            {c.isCustom ? <button type="button" className={buttonClass.link} disabled={busy} onClick={() => void deleteColumn(c)}>Delete</button> : null}
          </li>
        ))}
      </ul>
      <form className="mt-4 space-y-2" onSubmit={e => { e.preventDefault(); run(() => literatureMatrixApi.addColumn(matrix.id, label.trim(), instruction.trim())).then(() => { setLabel(''); setInstruction('') }) }}>
        <p className="text-[14px] font-medium text-slate-900">Add a column of your own</p>
        <label className="block text-[13px]">Name<input value={label} maxLength={80} onChange={e => setLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5" /></label>
        <label className="block text-[13px]">What to look for in each study<textarea value={instruction} maxLength={600} rows={2} onChange={e => setInstruction(e.target.value)}
          placeholder="For example: The country or countries where the data were collected." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5" /></label>
        <button type="submit" className={buttonClass.secondary} disabled={busy || !label.trim() || !instruction.trim()}>Add column</button>
      </form>
      {error ? <div className="mt-3"><ErrorAlert message={error} /></div> : null}
      {confirmDialog}
    </Dialog>
  )
}

function DeleteDialog({ matrix, onClose, onDeleted }: { matrix: Matrix; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    setBusy(true)
    try { await literatureMatrixApi.remove(matrix.id); onDeleted() } catch (e) { setError(failureMessage(e, 'delete')); setBusy(false) }
  }
  return (
    <Dialog title="Delete this matrix?" onClose={onClose}
      footer={<><button type="button" className={buttonClass.secondary} onClick={onClose}>Keep it</button><button type="button" className={buttonClass.danger} disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete everything'}</button></>}>
      <p className="text-[14px] text-slate-800">
        This deletes the matrix, every extracted value, your notes and themes, and the text of any files you uploaded to it, now and for good.
        Your saved sources stay in Saved Sources.
      </p>
      {error ? <div className="mt-3"><ErrorAlert message={error} /></div> : null}
    </Dialog>
  )
}
