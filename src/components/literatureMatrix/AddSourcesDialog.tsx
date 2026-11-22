import { useEffect, useMemo, useState } from 'react'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { webLibraryApi } from '../../api/webLibrary'
import { failureMessage, validateUpload, type AddSourcesResult, type Matrix } from '../../lib/literatureMatrix'
import type { PaperSearchResult, ResearchDocument } from '../../types/webLibrary'
import { Skeleton } from '../ui/Skeleton'
import { ConsentNotice, Dialog, ErrorAlert, buttonClass } from './parts'

type Tab = 'project' | 'saved' | 'search' | 'upload'

/** What happened, in one sentence, with merges and possible duplicates named. */
export function resultMessage(r: AddSourcesResult): string {
  const parts: string[] = []
  if (r.added) parts.push(`${r.added} added`)
  if (r.merged) parts.push(`${r.merged} merged with a study already in the matrix`)
  if (r.flagged) parts.push(`${r.flagged} added and marked as a possible duplicate for you to check`)
  if (r.skipped) parts.push(`${r.skipped} not added`)
  const reasons = [...new Set(r.outcomes.filter(o => o.outcome === 'skipped' && o.reason).map(o => o.reason as string))]
  return (parts.length ? parts.join(', ') + '.' : 'Nothing was added.') + (reasons.length ? ' ' + reasons.join(' ') : '')
}

export function AddSourcesDialog({ matrix, onClose, onAdded }: { matrix: Matrix; onClose: () => void; onAdded: (message: string) => void }) {
  // A matrix linked to a project starts on that project's papers, so they are not re-found by hand (W1.2).
  const linked = Boolean(matrix.researchProjectId)
  const [tab, setTab] = useState<Tab>(linked ? 'project' : 'saved')
  const tabs: { id: Tab; label: string }[] = [
    ...(linked ? [{ id: 'project' as Tab, label: 'From your project' }] : []),
    { id: 'saved', label: 'Saved Sources' }, { id: 'search', label: 'Search' }, { id: 'upload', label: 'Upload a file' },
  ]
  const done = (r: AddSourcesResult) => { onAdded(resultMessage(r)); onClose() }
  return (
    <Dialog title="Add sources" onClose={onClose}>
      <div role="tablist" aria-label="Where from" className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" id={`lm-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`lm-panel-${t.id}`} onClick={() => setTab(t.id)}
            className={'-mb-px border-b-2 px-3 py-1.5 text-[13px] font-medium ' + (tab === t.id ? 'border-purple-accent text-purple-deep' : 'border-transparent text-slate-700 hover:text-slate-900')}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`lm-panel-${tab}`} aria-labelledby={`lm-tab-${tab}`}>
        {tab === 'project' ? <ProjectTab matrixId={matrix.id} onDone={done} /> : tab === 'saved' ? <SavedTab matrixId={matrix.id} onDone={done} /> : tab === 'search' ? <SearchTab matrixId={matrix.id} onDone={done} /> : <UploadTab matrix={matrix} onDone={done} />}
      </div>
    </Dialog>
  )
}

function ProjectTab({ matrixId, onDone }: { matrixId: string; onDone: (r: AddSourcesResult) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const add = async () => {
    setBusy(true)
    setError(null)
    try { onDone(await literatureMatrixApi.addProject(matrixId)) } catch (e) { setError(failureMessage(e, 'add')); setBusy(false) }
  }
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-800">
        Adds every paper you included in the linked project. Papers already in this matrix are merged, not repeated. Where your project already holds a paper's full text, it comes along.
      </p>
      <p className="text-[12px] text-slate-600">A paper that is not in your Saved Sources yet is saved there too, because every matrix row is a saved source.</p>
      {error ? <ErrorAlert message={error} /> : null}
      <button type="button" disabled={busy} onClick={add} className={buttonClass.primary}>{busy ? 'Adding…' : 'Add project papers'}</button>
    </div>
  )
}

function SavedTab({ matrixId, onDone }: { matrixId: string; onDone: (r: AddSourcesResult) => void }) {
  const [docs, setDocs] = useState<ResearchDocument[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    webLibraryApi.getDocuments().then(d => setDocs(d.filter(x => x.folderId !== '__trash__'))).catch(e => setError(failureMessage(e, 'load')))
  }, [])
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (docs ?? []).filter(d => !q || d.title.toLowerCase().includes(q) || d.authors.some(a => a.toLowerCase().includes(q)) || String(d.year ?? '').includes(q))
  }, [docs, filter])
  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const add = async () => {
    setBusy(true)
    setError(null)
    try { onDone(await literatureMatrixApi.addSaved(matrixId, [...picked])) } catch (e) { setError(failureMessage(e, 'add')); setBusy(false) }
  }

  if (error && !docs) return <ErrorAlert message={error} />
  if (!docs) return <Skeleton lines={5} tone="light" />
  if (docs.length === 0) return <p className="text-[14px] text-slate-700">You have no saved sources yet. Use the Search tab, or save papers in Saved Sources first.</p>
  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="lm-saved-filter">Filter saved sources</label>
      <input id="lm-saved-filter" type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by title, author or year" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
      <div className="flex items-center justify-between text-[12px] text-slate-700">
        <span>{picked.size} chosen</span>
        <span className="flex gap-3">
          <button type="button" className={buttonClass.link} onClick={() => setPicked(new Set([...picked, ...shown.map(d => d.id)]))}>Choose all shown ({shown.length})</button>
          <button type="button" className={buttonClass.link} onClick={() => setPicked(new Set())}>Clear</button>
        </span>
      </div>
      <ul className="max-h-[50vh] divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200">
        {shown.map(d => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-[13px] hover:bg-slate-50">
              <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block font-medium text-slate-900 [overflow-wrap:anywhere]">{d.title}</span>
                <span className="block text-slate-700 [overflow-wrap:anywhere]">{d.authors.slice(0, 3).join(', ')}{d.authors.length > 3 ? ' et al.' : ''}{d.year ? ` · ${d.year}` : ''}{d.abstract ? '' : ' · no abstract'}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error ? <ErrorAlert message={error} /> : null}
      <button type="button" className={buttonClass.primary} disabled={busy || picked.size === 0} onClick={add}>{busy ? 'Adding…' : `Add ${picked.size || ''} to the matrix`}</button>
    </div>
  )
}

function SearchTab({ matrixId, onDone }: { matrixId: string; onDone: (r: AddSourcesResult) => void }) {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [results, setResults] = useState<PaperSearchResult[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await webLibraryApi.searchPapers(query.trim(), 1, 25)
      setResults(res.results)
      setSearched(query.trim())
      setPicked(new Set())
    } catch (err) { setError(failureMessage(err, 'load')) } finally { setBusy(false) }
  }
  const add = async () => {
    if (!results) return
    setBusy(true)
    setError(null)
    try { onDone(await literatureMatrixApi.addSearch(matrixId, searched, results.filter(r => picked.has(r.canonicalId)))) } catch (err) { setError(failureMessage(err, 'add')); setBusy(false) }
  }
  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <div className="space-y-2">
      <form onSubmit={search} className="flex gap-2">
        <label className="sr-only" htmlFor="lm-search-q">Search for papers</label>
        <input id="lm-search-q" value={query} onChange={e => setQuery(e.target.value)} placeholder="For example: digital learning adoption university students" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" />
        <button type="submit" className={buttonClass.secondary} disabled={busy || !query.trim()}>Search</button>
      </form>
      <p className="text-[12px] text-slate-600">Results are papers from scholarly databases. The search query is kept with each paper you add, so you can see later how you found it.</p>
      {results === null ? null : results.length === 0 ? <p className="text-[13px] text-slate-700">No papers found. Try fewer or different words.</p> : (
        <ul className="max-h-[45vh] divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200">
          {results.map(r => (
            <li key={r.canonicalId}>
              <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-[13px] hover:bg-slate-50">
                <input type="checkbox" checked={picked.has(r.canonicalId)} onChange={() => toggle(r.canonicalId)} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900 [overflow-wrap:anywhere]">{r.title}{r.isRetracted ? <span className="ml-1 rounded bg-red-100 px-1 text-[11px] text-red-800">Retracted</span> : null}</span>
                  <span className="block text-slate-700 [overflow-wrap:anywhere]">{r.authors.slice(0, 3).join(', ')}{r.authors.length > 3 ? ' et al.' : ''}{r.year ? ` · ${r.year}` : ''}{r.journal ? ` · ${r.journal}` : ''}{r.abstract ? '' : ' · no abstract'}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error ? <ErrorAlert message={error} /> : null}
      {results && results.length > 0 ? <button type="button" className={buttonClass.primary} disabled={busy || picked.size === 0} onClick={add}>{busy ? 'Adding…' : `Add ${picked.size || ''} to the matrix`}</button> : null}
    </div>
  )
}

function UploadTab({ matrix, onDone }: { matrix: Matrix; onDone: (r: AddSourcesResult) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const upload = async () => {
    if (!file) return
    const problem = validateUpload(file)
    if (problem) { setError(problem); return }
    setBusy(true)
    setError(null)
    try { onDone(await literatureMatrixApi.upload(matrix.id, file, consent || matrix.consentAccepted, title.trim() || undefined)) } catch (e) { setError(failureMessage(e, 'upload')); setBusy(false) }
  }
  return (
    <div className="space-y-3 text-[13px]">
      <p className="text-slate-800">A PDF or Word (.docx) file, up to 50 MB. The text is read on the server; scanned PDFs cannot be read. Authors, year and DOI are not guessed from the file: add them in Saved Sources if you need them in exports.</p>
      <label className="block">File<input type="file" accept=".pdf,.docx" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null) }} className="mt-1 block w-full text-[13px]" /></label>
      <label className="block">Title <span className="text-slate-600">(optional; the file name is used otherwise)</span>
        <input value={title} maxLength={500} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5" />
      </label>
      {!matrix.consentAccepted ? <ConsentNotice checked={consent} onChange={setConsent} retentionDays={matrix.retentionDays} id="lm-upload-consent" /> : null}
      {error ? <ErrorAlert message={error} /> : null}
      <button type="button" className={buttonClass.primary} disabled={busy || !file || (!matrix.consentAccepted && !consent)} onClick={upload}>{busy ? 'Uploading…' : 'Upload and add'}</button>
    </div>
  )
}
