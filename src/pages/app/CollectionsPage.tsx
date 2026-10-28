import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, FolderOpen, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { cn, formatShortDate } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { Modal } from '../../components/ui/Modal'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import type { Collection } from '../../types/webLibrary'

type SortBy = 'updated' | 'name' | 'count'

// Create and Rename share one form (name + description, trim, duplicate-name
// check, double-submit guard) instead of two near-identical modals
// (Research Library UX audit, 2026-10-03, Step 5).
function CollectionFormModal({
  open, title, confirmLabel, initialName, initialDescription, existingNames, onClose, onSubmit,
}: {
  open:         boolean
  title:        string
  confirmLabel: string
  initialName:        string
  initialDescription: string
  existingNames:      string[]
  onClose:  () => void
  onSubmit: (name: string, description: string) => Promise<void>
}) {
  const [name, setName]               = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (open) { setName(initialName); setDescription(initialDescription); setSubmitting(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const trimmed = name.trim()
  const isDuplicate = trimmed.length > 0 && existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase() && n.toLowerCase() !== initialName.trim().toLowerCase())
  const canSubmit = trimmed.length > 0 && !isDuplicate && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed, description.trim())
      onClose()
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-3">
        <div>
          <label className="text-[12px] text-slate-500 mb-1 block">Name</label>
          <input
            autoFocus
            value={name}
            disabled={submitting}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSubmit() }}
            placeholder="e.g. AI in Healthcare"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors disabled:opacity-60"
          />
          {isDuplicate && <p className="text-[11px] text-red-600 mt-1">A collection named "{trimmed}" already exists.</p>}
        </div>
        <div>
          <label className="text-[12px] text-slate-500 mb-1 block">Description (optional)</label>
          <textarea
            value={description}
            disabled={submitting}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors resize-none disabled:opacity-60"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className={cn(
              'px-4 py-2 rounded-lg text-[13px] font-medium transition-colors',
              canSubmit ? 'bg-purple-accent hover:bg-purple-deep text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed',
            )}
          >
            {submitting ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CollectionCardMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Collection actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
      >
        <MoreVertical size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden"
            >
              <button role="menuitem" onClick={() => { setOpen(false); onRename() }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors">
                <Pencil size={13} /> Rename
              </button>
              <button role="menuitem" onClick={() => { setOpen(false); onDelete() }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={13} /> Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CollectionsPage() {
  const { collections, collectionsLoaded, loadCollections, createCollection, updateCollection, deleteCollection } = useWebLibraryStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<Collection | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Collection | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!collectionsLoaded) void loadCollections()
  }, [collectionsLoaded, loadCollections])

  const filtered = useMemo(() => {
    const list = collections.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    const copy = [...list]
    if (sortBy === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'count') copy.sort((a, b) => b.paperCount - a.paperCount)
    else copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return copy
  }, [collections, query, sortBy])

  const existingNames = collections.map(c => c.name)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="collections" />

      <div className="border-b border-slate-100 px-5 py-4 shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search collections..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 placeholder-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          aria-label="Sort collections"
          className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
          <option value="count">Paper count</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors shadow-sm"
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
            {collections.length === 0 && (
              <button
                onClick={() => setCreating(true)}
                className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors"
              >
                <Plus size={14} /> Create collection
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c, i) => (
              <div
                key={c.id}
                ref={el => { cardRefs.current[i] = el }}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/app/web-library/collections/${c.id}`)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/app/web-library/collections/${c.id}`) } }}
                aria-label={`Open ${c.name}`}
                className="group rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-slate-800 leading-snug flex-1 line-clamp-2">{c.name}</p>
                  <CollectionCardMenu onRename={() => setRenaming(c)} onDelete={() => setConfirmDelete(c)} />
                </div>
                {c.description && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{c.description}</p>}
                <p className="text-[12px] text-slate-400 mt-2">
                  {c.paperCount} paper{c.paperCount !== 1 ? 's' : ''} · Updated {formatShortDate(c.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <CollectionFormModal
        open={creating}
        title="Create collection"
        confirmLabel="Create"
        initialName=""
        initialDescription=""
        existingNames={existingNames}
        onClose={() => setCreating(false)}
        onSubmit={async (name, description) => { await createCollection(name, description || undefined) }}
      />

      <CollectionFormModal
        open={renaming !== null}
        title="Rename collection"
        confirmLabel="Save"
        initialName={renaming?.name ?? ''}
        initialDescription={renaming?.description ?? ''}
        existingNames={existingNames}
        onClose={() => setRenaming(null)}
        onSubmit={async (name, description) => {
          if (!renaming) return
          await updateCollection(renaming.id, name, description || undefined)
          toast.success('Collection renamed')
        }}
      />

      {confirmDelete && (
        <ConfirmActionModal
          title={`Delete "${confirmDelete.name}"?`}
          message="The papers in this collection stay in your library — only the collection itself is removed."
          confirmLabel="Delete"
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => { await deleteCollection(confirmDelete.id); setConfirmDelete(null) }}
        />
      )}
    </div>
  )
}
