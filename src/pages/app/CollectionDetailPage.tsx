import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import { webLibraryApi } from '../../api/webLibrary'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { LibraryCardRow } from '../../components/webLibrary/LibraryCardRow'
import { BulkActionBar } from '../../components/webLibrary/BulkActionBar'
import { AddToCollectionModal } from '../../components/webLibrary/AddToCollectionModal'
import { MoveToFolderModal } from '../../components/webLibrary/MoveToFolderModal'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import type { RowActionHandlers } from '../../components/webLibrary/libraryRowActions'
import { exportPapersToCsv } from '../../lib/libraryCsvExport'
import type { CollectionDetail, ResearchDocument } from '../../types/webLibrary'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import type { PaperDetails } from '../../types/researchLibrary'

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { folders, updateDocument, trashDocument, removeFromCollection } = useWebLibraryStore()

  const [detail, setDetail] = useState<CollectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [query, setQuery]     = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [collectionModalDocIds, setCollectionModalDocIds] = useState<string[]>([])
  const [moveFolderDoc, setMoveFolderDoc] = useState<ResearchDocument | null>(null)
  const [pendingTrash, setPendingTrash] = useState<ResearchDocument | null>(null)
  const [pendingBulkRemove, setPendingBulkRemove] = useState(false)

  const loadDetail = () => {
    if (!collectionId) return
    setLoading(true)
    setError(null)
    webLibraryApi.getCollectionDetail(collectionId)
      .then(setDetail)
      .catch(() => setError('Could not load this collection.'))
      .finally(() => setLoading(false))
  }

  useEffect(loadDetail, [collectionId])

  const handleRemove = async (documentId: string) => {
    if (!collectionId) return
    try {
      await removeFromCollection(collectionId, documentId)
      setDetail(d => (d ? { ...d, papers: d.papers.filter(p => p.id !== documentId) } : d))
      setSelectedRows(s => { const n = new Set(s); n.delete(documentId); return n })
      toast.success('Removed from collection')
    } catch {
      // removeFromCollection already surfaces its own error toast on failure
    }
  }

  const filteredPapers = (detail?.papers ?? []).filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
  const selectedPapers = filteredPapers.filter(p => selectedRows.has(p.id))

  const toggleRow = (id: string) => setSelectedRows(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  // Same shared action config as My Library — "Cite", "Chat with collection", and "Start
  // literature review from collection" aren't included here: no existing route or handler
  // accepts a set of paper ids for any of those, so they're left out rather than built
  // silently (Research Library UX audit, 2026-10-03, Step 5).
  const rowActionHandlers: RowActionHandlers = {
    onOpenPdfViewer: (doc) => { if (doc.canonicalWorkId) navigate(`/app/web-library/papers/${doc.canonicalWorkId}/pdf`) },
    onDownload: (doc) => {
      if (!doc.filePath) { toast('No file attached to this record'); return }
      const a = document.createElement('a')
      a.href = doc.filePath
      a.download = `${doc.title}.pdf`
      a.click()
    },
    onChat: () => toast('Open this paper from My Library to chat with it.'),
    onAddToCollection: (doc) => setCollectionModalDocIds([doc.id]),
    onDetails: (doc) => {
      if (!doc.canonicalWorkId) return
      const next = new URLSearchParams(params); next.set('paper', doc.canonicalWorkId); setParams(next, { replace: true })
    },
    onMoveToFolder: (doc) => setMoveFolderDoc(doc),
    onTrash: (doc) => setPendingTrash(doc),
    onRemoveFromCollection: (doc) => void handleRemove(doc.id),
  }

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

      {selectedRows.size > 0 && (
        <BulkActionBar
          count={selectedRows.size}
          onAddToCollection={() => setCollectionModalDocIds([...selectedRows])}
          onExport={() => exportPapersToCsv(selectedPapers)}
          onTrash={() => setPendingBulkRemove(true)}
          trashLabel="Remove from collection"
          onClear={() => setSelectedRows(new Set())}
        />
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && <p className="text-[13px] text-slate-400 text-center py-16">Loading…</p>}
        {!loading && error && <p className="text-[13px] text-red-500 text-center py-16">{error}</p>}
        {!loading && !error && detail && detail.papers.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium text-[14px]">This collection has no papers yet</p>
            <p className="text-slate-400 text-[13px] mt-1">Save papers from Find Papers and add them here.</p>
          </div>
        )}
        {!loading && !error && filteredPapers.length > 0 && (
          <div className="space-y-2 max-w-3xl">
            {filteredPapers.map(p => (
              <LibraryCardRow
                key={p.id}
                doc={p}
                selected={selectedRows.has(p.id)}
                onToggle={() => toggleRow(p.id)}
                onOpen={() => { if (p.canonicalWorkId) rowActionHandlers.onDetails(p) }}
                handlers={rowActionHandlers}
                inTrash={false}
              />
            ))}
          </div>
        )}
      </div>

      <AddToCollectionModal
        open={collectionModalDocIds.length > 0}
        documentIds={collectionModalDocIds}
        onClose={() => { setCollectionModalDocIds([]); loadDetail() }}
      />
      <MoveToFolderModal
        open={moveFolderDoc !== null}
        folders={folders}
        currentFolderId={moveFolderDoc?.folderId}
        onClose={() => setMoveFolderDoc(null)}
        onMove={(folderId) => {
          if (!moveFolderDoc) return
          void updateDocument(moveFolderDoc.id, { folderId }).then(() => toast.success('Moved'))
          setMoveFolderDoc(null)
        }}
      />
      {pendingTrash && (
        <ConfirmActionModal
          title={`Move "${pendingTrash.title}" to Trash?`}
          message="It will be hidden from your library but not deleted — restore it from Trash at any time. It also stays in this collection's record until then."
          confirmLabel="Move to Trash"
          tone="reversible"
          onClose={() => setPendingTrash(null)}
          onConfirm={async () => { await trashDocument(pendingTrash.id); setPendingTrash(null); loadDetail() }}
        />
      )}
      {pendingBulkRemove && (
        <ConfirmActionModal
          title={`Remove ${selectedRows.size} paper${selectedRows.size === 1 ? '' : 's'} from "${detail?.name ?? 'this collection'}"?`}
          message="The papers stay in your library — only their membership in this collection is removed."
          confirmLabel="Remove"
          tone="reversible"
          onClose={() => setPendingBulkRemove(false)}
          onConfirm={async () => {
            await Promise.all(selectedPapers.map(p => handleRemove(p.id)))
            setPendingBulkRemove(false)
          }}
        />
      )}
      <PaperDetailsDrawer workId={params.get('paper')} onClose={() => { const next = new URLSearchParams(params); next.delete('paper'); setParams(next, { replace: true }) }} onOpenPdf={(paper: PaperDetails) => navigate(`/app/web-library/papers/${paper.id}/pdf`)} />
    </div>
  )
}
