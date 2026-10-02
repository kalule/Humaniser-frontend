import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, FolderOpen, Trash2 } from 'lucide-react'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { Modal } from '../../components/ui/Modal'

export default function CollectionsPage() {
  const { collections, collectionsLoaded, loadCollections, createCollection, deleteCollection } = useWebLibraryStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!collectionsLoaded) void loadCollections()
  }, [collectionsLoaded, loadCollections])

  const filtered = collections.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createCollection(newName.trim(), newDescription.trim() || undefined)
    setNewName(''); setNewDescription(''); setCreating(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="collections" />

      <div className="border-b border-slate-100 px-5 py-4 shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search collections…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 placeholder-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors shadow-sm shadow-violet-200"
        >
          <Plus size={14} /> Create collection
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium text-[14px]">
              {collections.length === 0 ? 'No collections yet' : 'No matching collections'}
            </p>
            <p className="text-slate-400 text-[13px] mt-1">
              {collections.length === 0 ? 'Organize saved papers into named collections.' : 'Try a different search.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => navigate(`/app/web-library/collections/${c.id}`)}
                className="group rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-slate-800 leading-snug flex-1">{c.name}</p>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete({ id: c.id, name: c.name }) }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {c.description && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{c.description}</p>}
                <p className="text-[12px] text-slate-400 mt-2">{c.paperCount} paper{c.paperCount !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="Create collection" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">Name</label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. AI in Healthcare"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">Description (optional)</label>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title={confirmDelete ? `Delete "${confirmDelete.name}"?` : ''} size="sm">
        <div className="space-y-4">
          <p className="text-[13px] text-slate-600">
            The papers in this collection stay in your library — only the collection itself is removed.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={async () => { if (confirmDelete) { await deleteCollection(confirmDelete.id); setConfirmDelete(null) } }}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[13px] font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
