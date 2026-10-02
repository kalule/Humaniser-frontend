import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, X as XIcon, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { webLibraryApi } from '../../api/webLibrary'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { CitePopover } from '../../components/webLibrary/CitePopover'
import type { CollectionDetail } from '../../types/webLibrary'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import type { PaperDetails } from '../../types/researchLibrary'

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const removeFromCollection = useWebLibraryStore(s => s.removeFromCollection)

  const [detail, setDetail] = useState<CollectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [query, setQuery]     = useState('')

  useEffect(() => {
    if (!collectionId) return
    setLoading(true)
    setError(null)
    webLibraryApi.getCollectionDetail(collectionId)
      .then(setDetail)
      .catch(() => setError('Could not load this collection.'))
      .finally(() => setLoading(false))
  }, [collectionId])

  const handleRemove = async (documentId: string) => {
    if (!collectionId) return
    try {
      await removeFromCollection(collectionId, documentId)
      setDetail(d => (d ? { ...d, papers: d.papers.filter(p => p.id !== documentId) } : d))
      toast.success('Removed from collection')
    } catch {
      // removeFromCollection already surfaces its own error toast on failure
    }
  }

  const filteredPapers = (detail?.papers ?? []).filter(p => p.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="collections" />

      <div className="border-b border-slate-100 px-5 py-4 shrink-0">
        <button
          onClick={() => navigate('/app/web-library/collections')}
          className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft size={13} /> All collections
        </button>
        {detail && (
          <>
            <h1 className="text-[16px] font-semibold text-slate-800">{detail.name}</h1>
            {detail.description && <p className="text-[13px] text-slate-500 mt-0.5">{detail.description}</p>}
            <p className="text-[12px] text-slate-400 mt-1">{detail.papers.length} paper{detail.papers.length !== 1 ? 's' : ''}</p>
            <div className="relative max-w-sm mt-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search this collection…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-700 placeholder-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && <p className="text-[13px] text-slate-400 text-center py-16">Loading…</p>}
        {!loading && error && <p className="text-[13px] text-red-500 text-center py-16">{error}</p>}
        {!loading && !error && detail && detail.papers.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="text-slate-700 font-medium text-[14px]">This collection has no papers yet</p>
            <p className="text-slate-400 text-[13px] mt-1">Save papers from Find Papers and add them here.</p>
          </div>
        )}
        {!loading && !error && filteredPapers.length > 0 && (
          <div className="space-y-3 max-w-3xl">
            {filteredPapers.map(p => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-[14px] font-semibold text-slate-800 leading-snug">{p.title}</p>
                {p.authors.length > 0 && (
                  <p className="text-[12px] text-slate-600 mt-1">{p.authors.join(', ')}{p.year ? ` (${p.year})` : ''}</p>
                )}
                {p.journal && <p className="text-[12px] text-slate-500 italic mt-0.5">{p.journal}</p>}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  {p.canonicalWorkId && <button onClick={() => { const next = new URLSearchParams(params); next.set('paper', p.canonicalWorkId!); setParams(next, { replace: true }) }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-500 hover:text-violet-700"><Info size={12} /> Details</button>}
                  <CitePopover paper={p} />
                  <button
                    onClick={() => void handleRemove(p.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto"
                  >
                    <XIcon size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PaperDetailsDrawer workId={params.get('paper')} onClose={() => { const next = new URLSearchParams(params); next.delete('paper'); setParams(next, { replace: true }) }} onOpenPdf={(paper: PaperDetails) => navigate(`/app/web-library/papers/${paper.id}/pdf`)} />
    </div>
  )
}
