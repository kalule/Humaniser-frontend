import { useEffect, useState } from 'react'
import { Search, Plus, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'

interface AddToCollectionModalProps {
  open:               boolean
  /** One document (row action) or several (bulk-action bar) — same picker either way. */
  documentIds:        string[]
  /** Collections the paper already belongs to, if known (e.g. a Find Papers search result
   *  already carries this). Defaults to empty — unknown membership reads as "not yet in any".
   *  Ignored when documentIds.length > 1 (bulk membership isn't tracked client-side). */
  initialCollectionIds?: string[]
  onClose: () => void
  /** Fires after every successful add/remove so callers can refresh their own membership state. */
  onChanged?: (collectionIds: string[]) => void
}

export function AddToCollectionModal({
  open, documentIds, initialCollectionIds = [], onClose, onChanged,
}: AddToCollectionModalProps) {
  const { collections, collectionsLoaded, loadCollections, createCollection, addToCollection, removeFromCollection } = useWebLibraryStore()

  const [query, setQuery]           = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [creating, setCreating]     = useState(false)
  const [newName, setNewName]       = useState('')
  const [pending, setPending]       = useState<Set<string>>(new Set())
  const isBulk = documentIds.length > 1

  useEffect(() => {
    if (open && !collectionsLoaded) void loadCollections()
  }, [open, collectionsLoaded, loadCollections])

  useEffect(() => {
    if (open) setSelected(new Set(isBulk ? [] : initialCollectionIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentIds.join(',')])

  if (documentIds.length === 0) return null

  const filtered = collections.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))

  const toggle = async (collectionId: string) => {
    const isMember = selected.has(collectionId)
    setPending(p => new Set(p).add(collectionId))
    try {
      if (isMember) {
        await Promise.all(documentIds.map(id => removeFromCollection(collectionId, id)))
        setSelected(s => { const n = new Set(s); n.delete(collectionId); onChanged?.([...n]); return n })
      } else {
        await Promise.all(documentIds.map(id => addToCollection(collectionId, id)))
        setSelected(s => { const n = new Set(s).add(collectionId); onChanged?.([...n]); return n })
      }
    } finally {
      setPending(p => { const n = new Set(p); n.delete(collectionId); return n })
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const collection = await createCollection(newName.trim())
    setNewName(''); setCreating(false)
    void toggle(collection.id)
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={isBulk ? `Add ${documentIds.length} papers to collection` : 'Add to collection'} size="sm">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search collections…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 placeholder-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filtered.length === 0 && !creating && (
            <p className="text-[12px] text-slate-400 text-center py-4">
              {collections.length === 0 ? 'No collections yet — create one below.' : 'No matching collections.'}
            </p>
          )}
          {filtered.map(c => {
            const isMember = selected.has(c.id)
            const isPending = pending.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => void toggle(c.id)}
                disabled={isPending}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <span className={cn(
                  'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                  isMember ? 'border-purple-accent bg-purple-accent' : 'border-slate-300',
                )}>
                  {isMember && <Check size={10} className="text-white" />}
                </span>
                <span className="flex-1 text-[13px] text-slate-700 truncate">{c.name}</span>
                <span className="text-[11px] text-slate-400">{c.paperCount}</span>
              </button>
            )
          })}
        </div>

        <div className="border-t border-slate-100 pt-3">
          {creating ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') setCreating(false) }}
                placeholder="Collection name…"
                className="flex-1 border border-purple-accent rounded-lg px-2.5 py-1.5 text-[12px] outline-none text-slate-700"
              />
              <button onClick={() => void handleCreate()} className="px-3 py-1.5 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[12px] font-medium transition-colors">
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-purple-tint hover:text-purple-accent transition-colors"
            >
              <Plus size={14} /> Create new collection
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
