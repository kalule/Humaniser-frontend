import { useEffect, useState } from 'react'
import { Search, Plus, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import type { PaperSearchResult } from '../../types/webLibrary'

interface SaveToLibraryModalProps {
  open:   boolean
  result: PaperSearchResult | null
  onClose: () => void
}

/** Save-a-search-result flow: pick zero or more collections up front, then a single "Add to
 *  Library" confirms — saves the paper and adds it to every checked collection in one step,
 *  rather than saving first and hunting for a separate "add to collection" action afterward. */
export function SaveToLibraryModal({ open, result, onClose }: SaveToLibraryModalProps) {
  const {
    collections, collectionsLoaded, loadCollections, createCollection,
    saveFromSearch, addToCollection, removeFromCollection, setSearchResultCollections,
  } = useWebLibraryStore()

  const [query, setQuery]     = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && !collectionsLoaded) void loadCollections()
  }, [open, collectionsLoaded, loadCollections])

  useEffect(() => {
    if (open) { setSelected(new Set(result?.collectionIds ?? [])); setQuery(''); setCreating(false); setNewName('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, result?.canonicalId])

  if (!result) return null

  const filtered = collections.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))

  const toggle = (collectionId: string) =>
    setSelected(s => {
      const n = new Set(s)
      n.has(collectionId) ? n.delete(collectionId) : n.add(collectionId)
      return n
    })

  const handleCreate = async () => {
    if (!newName.trim()) return
    const collection = await createCollection(newName.trim())
    setNewName(''); setCreating(false)
    setSelected(s => new Set(s).add(collection.id))
  }

  const handleAddToLibrary = async () => {
    setSubmitting(true)
    try {
      const doc = await saveFromSearch(result)
      const before = new Set(result.collectionIds)
      const toAdd = [...selected].filter(id => !before.has(id))
      const toRemove = [...before].filter(id => !selected.has(id))
      await Promise.all([
        ...toAdd.map(id => addToCollection(id, doc.id)),
        ...toRemove.map(id => removeFromCollection(id, doc.id)),
      ])
      setSearchResultCollections(result.canonicalId, [...selected])

      const finalCount = selected.size
      toast.success(
        finalCount > 0
          ? `Added to library — in ${finalCount} collection${finalCount !== 1 ? 's' : ''}`
          : 'Added to library',
      )
      onClose()
    } catch {
      // saveFromSearch/addToCollection/removeFromCollection already surface their own error toasts.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Select collections (optional)" size="sm">
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
            const isChecked = selected.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 transition-colors"
              >
                <span className={cn(
                  'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                  isChecked ? 'border-purple-accent bg-purple-accent' : 'border-slate-300',
                )}>
                  {isChecked && <Check size={10} className="text-white" />}
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

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => void handleAddToLibrary()}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
          >
            {submitting ? 'Saving…' : result.isSaved ? 'Save changes' : 'Add to Library'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
