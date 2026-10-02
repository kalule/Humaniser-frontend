import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronDown, FileUp, Loader2, Search, Unplug, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { referenceManagerApi } from '../../api/referenceManager'
import type { ExternalReferenceCollection, ExternalReferencePreview, ReferenceImport, ReferenceManagerConnection, ReferenceManagerProvider } from '../../types/referenceManager'
import type { Collection } from '../../types/webLibrary'

type Tab = 'upload' | ReferenceManagerProvider
export function ImportSourcesModal({ open, collections: destinations, onClose, onUploadPdf, onImported }: { open: boolean; collections: Collection[]; onClose: () => void; onUploadPdf: () => void; onImported: () => void }) {
  const [tab, setTab] = useState<Tab>('upload')
  const [connections, setConnections] = useState<ReferenceManagerConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [externalCollections, setExternalCollections] = useState<ExternalReferenceCollection[]>([])
  const [externalCollectionId, setExternalCollectionId] = useState('')
  const [items, setItems] = useState<ExternalReferencePreview[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [destinationCollectionId, setDestinationCollectionId] = useState('')
  const [newCollectionName, setNewCollectionName] = useState('')
  const [includePdfs, setIncludePdfs] = useState(false)
  const [job, setJob] = useState<ReferenceImport | null>(null)
  const provider = tab === 'zotero' || tab === 'mendeley' ? tab : null
  const providerState = useMemo(() => connections.find(c => c.provider.toLowerCase() === provider), [connections, provider])
  const connection = providerState?.status.toLowerCase() === 'connected' ? providerState : undefined

  useEffect(() => { if (open) void referenceManagerApi.connections().then(setConnections).catch(() => setConnections([])) }, [open])
  useEffect(() => {
    if (!provider || !connection || connection.status.toLowerCase() !== 'connected') return
    setLoading(true)
    Promise.all([referenceManagerApi.collections(provider), referenceManagerApi.items(provider, { pageSize: 50 })])
      .then(([cols, page]) => { setExternalCollections(cols); setItems(page.items); setSelected(new Set()) })
      .catch(() => toast.error(`Could not load your ${provider === 'zotero' ? 'Zotero' : 'Mendeley'} library.`))
      .finally(() => setLoading(false))
  }, [provider, connection?.id])
  useEffect(() => {
    if (!job || ['Completed', 'CompletedWithErrors', 'Failed', 'Cancelled'].includes(job.status)) return
    const id = window.setInterval(() => referenceManagerApi.importStatus(job.id).then(next => {
      setJob(next)
      if (next.status === 'Completed' || next.status === 'CompletedWithErrors') onImported()
    }).catch(() => {}), 2000)
    return () => window.clearInterval(id)
  }, [job?.id, job?.status, onImported])
  if (!open) return null

  const connect = async (p: ReferenceManagerProvider) => {
    try { const result = await referenceManagerApi.connect(p); window.location.assign(result.authorizationUrl) }
    catch { toast.error(`${p === 'zotero' ? 'Zotero' : 'Mendeley'} is not configured yet.`) }
  }
  const loadItems = async () => {
    if (!provider) return
    setLoading(true)
    try { setItems((await referenceManagerApi.items(provider, { externalCollectionId: externalCollectionId || undefined, query: query || undefined, pageSize: 50 })).items); setSelected(new Set()) }
    catch { toast.error('Could not load references.') } finally { setLoading(false) }
  }
  const startImport = async () => {
    if (!provider || !connection || selected.size === 0) return
    try {
      setJob(await referenceManagerApi.startImport({ provider, connectionId: connection.id, externalItemIds: [...selected], externalCollectionId: externalCollectionId || null, destinationCollectionId: newCollectionName.trim() ? null : (destinationCollectionId || null), newCollectionName: newCollectionName.trim() || null, includePdfAttachments: includePdfs, preserveExternalFolderStructure: false }))
    } catch { toast.error('Could not start the import.') }
  }
  const terminal = job && ['Completed', 'CompletedWithErrors', 'Failed', 'Cancelled'].includes(job.status)

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="import-sources-title">
    <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h2 id="import-sources-title" className="text-base font-semibold text-slate-900">Import sources</h2><p className="mt-0.5 text-xs text-slate-500">Bring references into your HumaniserAI Research Library.</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></header>
      <nav className="flex border-b border-slate-200 px-5" aria-label="Import source">
        {([['upload','Upload PDFs'],['zotero','Zotero'],['mendeley','Mendeley']] as [Tab,string][]).map(([id,label]) => <button key={id} onClick={() => { setTab(id); setJob(null) }} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
      </nav>
      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        {tab === 'upload' && <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center"><FileUp className="mb-3 text-violet-600"/><h3 className="font-semibold text-slate-900">Upload files from your computer</h3><p className="mt-1 max-w-md text-sm text-slate-500">Upload PDFs and documents using the existing secure library workflow.</p><button onClick={() => { onClose(); onUploadPdf() }} className="mt-5 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Choose files</button></div>}
        {provider && !connection && <div className="flex min-h-72 flex-col items-center justify-center text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><BookOpen/></div><h3 className="text-lg font-semibold text-slate-900">Connect {provider === 'zotero' ? 'Zotero' : 'Mendeley'}</h3><p className="mt-2 max-w-lg text-sm text-slate-500">Import references with read-only access. HumaniserAI cannot edit or delete anything in your external library.</p>{providerState && !providerState.isConfigured && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">An administrator must configure this provider before it can be connected.</p>}<button disabled={providerState ? !providerState.isConfigured : false} onClick={() => connect(provider)} className="mt-5 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">Connect {provider === 'zotero' ? 'Zotero' : 'Mendeley'}</button></div>}
        {provider && connection && !job && <div>
          <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white"><Check size={16}/></span><div><p className="text-sm font-semibold text-emerald-900">Connected as {connection.displayName || connection.email || provider}</p><p className="text-xs text-emerald-700">Read-only access</p></div></div><button onClick={() => referenceManagerApi.disconnect(provider).then(() => setConnections(v => v.filter(c => c.id !== connection.id)))} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-600"><Unplug size={14}/>Disconnect</button></div>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"><div className="relative"><select value={externalCollectionId} onChange={e => setExternalCollectionId(e.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm"><option value="">All references</option>{externalCollections.map(c => <option key={c.id} value={c.id}>{c.name}{c.itemCount != null ? ` (${c.itemCount})` : ''}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400"/></div><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && void loadItems()} placeholder="Search connected library" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm"/></div><button onClick={loadItems} className="rounded-lg border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50">Refresh</button></div>
          {loading ? <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-violet-600"/></div> : <div className="overflow-hidden rounded-xl border border-slate-200"><label className="flex items-center gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700"><input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={e => setSelected(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}/>Select all visible <span className="ml-auto font-normal text-slate-500">{items.length} references</span></label><div className="max-h-80 divide-y overflow-y-auto">{items.map(item => <label key={item.id} className="flex cursor-pointer gap-3 px-4 py-3 hover:bg-slate-50"><input type="checkbox" className="mt-1" checked={selected.has(item.id)} onChange={() => setSelected(s => { const n = new Set(s); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}/><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{item.title}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.authors.join(', ')}{item.year ? ` · ${item.year}` : ''}{item.source ? ` · ${item.source}` : ''}</p><div className="mt-1 flex gap-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{item.classification}</span>{item.hasPdf && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">PDF available</span>}</div></div></label>)}</div></div>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label className="block text-xs font-medium text-slate-700">Destination collection<select disabled={Boolean(newCollectionName.trim())} value={destinationCollectionId} onChange={e => setDestinationCollectionId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"><option value="">All files</option>{destinations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block text-xs font-medium text-slate-700">Or create a collection<input maxLength={200} value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} placeholder="New collection name" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></label></div><label className="flex h-10 items-center gap-2 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400" title="Available after durable scanned PDF storage is configured"><input type="checkbox" disabled checked={includePdfs} onChange={e => setIncludePdfs(e.target.checked)}/>Include PDFs (requires secure storage)</label></div>
        </div>}
        {job && <div className="mx-auto max-w-xl py-10 text-center"><Loader2 className={`mx-auto mb-4 text-violet-600 ${terminal ? '' : 'animate-spin'}`}/><h3 className="text-lg font-semibold text-slate-900">{terminal ? job.status.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Importing references…'}</h3><p className="mt-1 text-sm text-slate-500">{job.processed} of {job.totalSelected} processed{job.currentItem ? ` · ${job.currentItem}` : ''}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-violet-600 transition-all" style={{ width: `${job.totalSelected ? Math.round(job.processed / job.totalSelected * 100) : 0}%` }}/></div><div className="mt-6 grid grid-cols-3 gap-3 text-sm"><Summary label="Imported" value={job.imported}/><Summary label="Already present" value={job.alreadyPresent}/><Summary label="Failed" value={job.referencesFailed}/></div>{terminal && job.referencesFailed > 0 && <button onClick={async () => { try { setJob(await referenceManagerApi.retryImport(job.id)) } catch { toast.error('Could not retry the failed references.') } }} className="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Retry failed references</button>}</div>}
      </main>
      {provider && connection && !job && <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4"><span className="text-sm text-slate-500">{selected.size} selected</span><div className="flex gap-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">Cancel</button><button disabled={!selected.size} onClick={startImport} className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">Import selected</button></div></footer>}
    </div>
  </div>
}
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div> }
