import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, FileText, FolderOpen, Loader2, MoreVertical, Pencil, Plus, Quote, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { webLibraryApi } from '../../api/webLibrary'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { SortControl } from '../../components/webLibrary/SortControl'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { COLLECTION_SORT_OPTIONS, referenceList, sortCollections, yearRangeLabel, type CollectionSortKey, type SortDir } from '../../lib/collectionsView'
import { formatLibraryDate } from '../../lib/researchLabels'
import { TRASH_FOLDER } from '../../lib/savedSources'
import { FORMAT_LABELS, FORMAT_STYLES, type FormatStyle } from '../../types/citation'
import type { Collection, ResearchDocument } from '../../types/webLibrary'

// The server's limits (CreateWebLibraryCollectionRequestValidator), checked here first so the
// student sees them instead of a failed save.
const NAME_MAX = 200
const DESCRIPTION_MAX = 2000

type FormMode = 'create' | 'rename' | 'description'

/**
 * Create, rename and edit-description share one form. What the student types is shown and saved as
 * typed; only surrounding whitespace is ignored when checking and saving.
 */
function CollectionFormModal({
  mode, collection, existingNames, onClose, onSubmit,
}: {
  mode: FormMode | null
  collection: Collection | null
  existingNames: string[]
  onClose: () => void
  onSubmit: (name: string, description: string) => Promise<void>
}) {
  const open = mode !== null
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    setName(collection?.name ?? ''); setDescription(collection?.description ?? '')
    setTouched(false); setSubmitting(false)
    requestAnimationFrame(() => (mode === 'description' ? descriptionRef : nameRef).current?.focus())
  }, [open, mode, collection])

  const trimmed = name.trim()
  const original = collection?.name.trim().toLowerCase()
  const nameError = trimmed.length === 0 ? 'Give the collection a name.'
    : trimmed.length > NAME_MAX ? `Names can be up to ${NAME_MAX} characters.`
    : existingNames.some(n => n.trim().toLowerCase() === trimmed.toLowerCase() && n.trim().toLowerCase() !== original) ? `You already have a collection called "${trimmed}".`
    : null
  const descriptionError = description.trim().length > DESCRIPTION_MAX ? `Descriptions can be up to ${DESCRIPTION_MAX} characters.` : null
  const showNameError = nameError && (touched || trimmed.length > 0)
  const canSubmit = !nameError && !descriptionError && !submitting

  const submit = async () => {
    setTouched(true)
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed, description.trim())
      onClose()
    } catch {
      setSubmitting(false)
    }
  }

  const title = mode === 'create' ? 'Create collection' : mode === 'rename' ? 'Rename collection' : 'Edit description'
  const input = 'w-full px-3 py-2 rounded-lg border text-[13px] text-slate-800 outline-none focus:ring-2 transition-colors disabled:opacity-60'

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="sm">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit() }} noValidate>
        <div>
          <label htmlFor={`${id}-name`} className="text-[12.5px] font-medium text-slate-700 mb-1 block">Name</label>
          <input
            id={`${id}-name`}
            ref={nameRef}
            value={name}
            disabled={submitting}
            onChange={e => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={!!showNameError}
            aria-describedby={showNameError ? `${id}-name-error` : undefined}
            placeholder="e.g. AIDS in South Africa"
            className={cn(input, showNameError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-purple-accent focus:ring-purple-accent/20')}
          />
          {showNameError && <p id={`${id}-name-error`} role="alert" className="text-[12px] text-red-600 mt-1">{nameError}</p>}
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor={`${id}-description`} className="text-[12.5px] font-medium text-slate-700">Description <span className="font-normal text-slate-600">(optional)</span></label>
            {description.length > DESCRIPTION_MAX * 0.8 && <span className="text-[11.5px] text-slate-600">{description.trim().length}/{DESCRIPTION_MAX}</span>}
          </div>
          <textarea
            id={`${id}-description`}
            ref={descriptionRef}
            value={description}
            disabled={submitting}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            aria-invalid={!!descriptionError}
            aria-describedby={descriptionError ? `${id}-description-error` : `${id}-description-hint`}
            placeholder="What the papers have in common, or what you'll use them for"
            className={cn(input, 'resize-none', descriptionError ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-purple-accent focus:ring-purple-accent/20')}
          />
          {descriptionError
            ? <p id={`${id}-description-error`} role="alert" className="text-[12px] text-red-600 mt-1">{descriptionError}</p>
            : <p id={`${id}-description-hint`} className="text-[12px] text-slate-600 mt-1">Shown on the collection's card.</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 rounded-lg text-[13px] text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-[13px] font-medium bg-purple-accent hover:bg-purple-deep text-white transition-colors disabled:opacity-60"
          >
            {submitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** "Cite all": a formatted reference list for the collection's papers, from their saved metadata. */
function CiteCollectionDialog({ collection, onClose }: { collection: Collection | null; onClose: () => void }) {
  const [papers, setPapers] = useState<ResearchDocument[] | null>(null)
  const [error, setError] = useState(false)
  const [style, setStyle] = useState<FormatStyle>('harvard')
  const id = useId()

  useEffect(() => {
    if (!collection) return
    let live = true
    setPapers(null); setError(false)
    webLibraryApi.getCollectionDetail(collection.id)
      .then(detail => { if (live) setPapers(detail.papers) })
      .catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [collection])

  const active = useMemo(() => (papers ?? []).filter(p => p.folderId !== TRASH_FOLDER), [papers])
  const trashed = (papers?.length ?? 0) - active.length
  const list = useMemo(() => referenceList(active, style), [active, style])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(list.entries.join('\n\n'))
      toast.success(`${list.entries.length} reference${list.entries.length === 1 ? '' : 's'} copied`)
    } catch {
      toast.error('Could not copy. Select the text and copy it instead.')
    }
  }

  return (
    <Modal isOpen={collection !== null} onClose={onClose} title={`Cite all papers in "${collection?.name ?? ''}"`} size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-style`} className="text-[12.5px] font-medium text-slate-700">Style</label>
          <Select id={`${id}-style`} wrapperClassName="w-auto" value={style} onChange={e => setStyle(e.target.value as FormatStyle)}>
            {FORMAT_STYLES.map(s => <option key={s} value={s}>{FORMAT_LABELS[s]}</option>)}
          </Select>
          <div className="flex-1" />
          <button type="button" onClick={() => void copy()} disabled={!list.entries.length}
            className="flex items-center gap-1.5 rounded-lg bg-purple-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-purple-deep disabled:opacity-50">
            <Copy size={13} /> Copy reference list
          </button>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">The collection's papers could not be loaded. Try again.</p>}
        {!papers && !error && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-accent" aria-label="Loading papers" /></div>}
        {papers && (
          <>
            {list.entries.length === 0
              ? <p className="py-6 text-center text-[13px] text-slate-600">There are no papers to cite in this collection.</p>
              : <ol className="max-h-[50vh] space-y-2.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-800">
                  {list.entries.map((e, i) => <li key={i}>{e}</li>)}
                </ol>}
            {(trashed > 0 || list.skipped > 0) && (
              <p className="text-[12px] text-slate-600">
                {trashed > 0 && `${trashed} paper${trashed === 1 ? ' is' : 's are'} in Trash and left out. `}
                {list.skipped > 0 && `${list.skipped} paper${list.skipped === 1 ? ' has' : 's have'} too little detail to cite.`}
              </p>
            )}
            <p className="text-[12px] text-slate-600">Built from each paper's saved details. Check authors and years before you submit.</p>
          </>
        )}
      </div>
    </Modal>
  )
}

interface MenuAction { key: string; label: string; icon: React.ReactNode; danger?: boolean; onSelect: () => void }

/** Always-visible kebab (works on touch); the menu supports ↑/↓/Home/End/Esc and returns focus. */
function CollectionCardMenu({ name, actions }: { name: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const onDown = (e: MouseEvent | TouchEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('touchstart', onDown)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('touchstart', onDown) }
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); setOpen(false); buttonRef.current?.focus()
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative z-10">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div id={id} role="menu" aria-label={`Actions for ${name}`} onKeyDown={onKey}
          className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {actions.map((a, i) => (
            <button
              key={a.key}
              ref={el => { itemRefs.current[i] = el }}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); a.onSelect() }}
              className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] focus:outline-none',
                a.danger ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50')}
            >
              {a.icon}{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CollectionCard({ collection: c, onOpen, actions }: { collection: Collection; onOpen: () => void; actions: MenuAction[] }) {
  const years = yearRangeLabel(c.yearFrom, c.yearTo)
  const preview = c.previewTitles ?? []
  return (
    <article className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-purple-accent/40 hover:shadow-sm focus-within:border-purple-accent/40">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug text-slate-900">
          {/* The title is the card's link; its ::after stretches over the card so the whole card is clickable. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none group-focus-within:underline-offset-2 focus-visible:underline"
          >
            <span className="line-clamp-2">{c.name}</span>
          </button>
        </h3>
        <CollectionCardMenu name={c.name} actions={actions} />
      </div>
      {c.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-600">{c.description}</p>}

      {preview.length > 0 ? (
        <ul className="mt-3 space-y-1 border-l-2 border-slate-100 pl-2.5" aria-label="Recently added papers">
          {preview.map((t, i) => <li key={i} className="truncate text-[12.5px] text-slate-700" title={t}>{t}</li>)}
          {c.paperCount > preview.length && <li className="text-[12px] text-slate-600">and {c.paperCount - preview.length} more</li>}
        </ul>
      ) : (
        <p className="mt-3 text-[12.5px] text-slate-600">No papers yet. Add them from Saved Sources.</p>
      )}

      <div className="mt-auto flex items-center gap-1.5 pt-3 text-[12px] text-slate-600">
        <span>{c.paperCount} paper{c.paperCount === 1 ? '' : 's'}</span>
        {years && <><span aria-hidden>·</span><span>{years}</span></>}
        <span aria-hidden>·</span>
        <span>Updated {formatLibraryDate(c.updatedAt)}</span>
        <ChevronRight size={15} aria-hidden className="ml-auto text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-accent" />
      </div>
    </article>
  )
}

export default function CollectionsPage() {
  const { collections, collectionsLoaded, loadCollections, createCollection, updateCollection, deleteCollection, duplicateCollection } = useWebLibraryStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<CollectionSortKey>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [form, setForm] = useState<{ mode: FormMode; collection: Collection | null } | null>(null)
  const [citing, setCiting] = useState<Collection | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Collection | null>(null)

  useEffect(() => {
    if (!collectionsLoaded) void loadCollections()
  }, [collectionsLoaded, loadCollections])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? collections.filter(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) : collections
    return sortCollections(list, sortKey, sortDir)
  }, [collections, query, sortKey, sortDir])

  const existingNames = collections.map(c => c.name)
  const open = (c: Collection) => navigate(`/app/web-library/collections/${c.id}`)

  const actionsFor = (c: Collection): MenuAction[] => [
    { key: 'rename', label: 'Rename', icon: <Pencil size={13} />, onSelect: () => setForm({ mode: 'rename', collection: c }) },
    { key: 'description', label: c.description ? 'Edit description' : 'Add description', icon: <FileText size={13} />, onSelect: () => setForm({ mode: 'description', collection: c }) },
    { key: 'duplicate', label: 'Duplicate', icon: <Copy size={13} />, onSelect: () => {
      void duplicateCollection(c.id).then(copy => toast.success(`Created "${copy.name}"`)).catch(() => undefined)
    } },
    { key: 'cite', label: 'Cite all papers…', icon: <Quote size={13} />, onSelect: () => setCiting(c) },
    { key: 'delete', label: 'Delete', icon: <Trash2 size={13} />, danger: true, onSelect: () => setConfirmDelete(c) },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="collections" />

      <div className="border-b border-slate-100 px-5 py-3 shrink-0 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search collections"
            placeholder="Search collections…"
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-500 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-800"><X size={13} /></button>}
        </div>
        <SortControl options={COLLECTION_SORT_OPTIONS} value={sortKey} dir={sortDir} onChange={(k, d) => { setSortKey(k); setSortDir(d) }} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setForm({ mode: 'create', collection: null })}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 focus-visible:ring-offset-2"
        >
          <Plus size={14} /> Create collection
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {!collectionsLoaded ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading collections">
            {[0, 1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : collections.length === 0 ? (
          <div className="mx-auto max-w-md py-14 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
              <FolderOpen size={22} className="text-slate-500" />
            </div>
            <h2 className="text-[15px] font-semibold text-slate-900">Group your papers into collections</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
              A collection gathers saved papers by topic, chapter or project, such as "Literature review" or "Methods". A paper can be in as many collections as you like, and stays in Saved Sources either way.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button type="button" onClick={() => setForm({ mode: 'create', collection: null })} className="flex items-center gap-2 rounded-lg bg-purple-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-purple-deep">
                <Plus size={14} /> Create your first collection
              </button>
              <button type="button" onClick={() => navigate('/app/web-library', { state: { fromTabBar: true } })} className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                Go to Saved Sources
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-slate-600">
              Collections are topic or project groupings you create. A paper can belong to many collections, and removing it from one leaves it in Saved Sources.
            </p>
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[14px] font-medium text-slate-800">No collections match "{query.trim()}"</p>
                <button type="button" onClick={() => setQuery('')} className="mt-2 text-[13px] font-medium text-purple-accent hover:text-purple-deep">Clear search</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(c => <CollectionCard key={c.id} collection={c} onOpen={() => open(c)} actions={actionsFor(c)} />)}
              </div>
            )}
          </>
        )}
      </div>

      <CollectionFormModal
        mode={form?.mode ?? null}
        collection={form?.collection ?? null}
        existingNames={existingNames}
        onClose={() => setForm(null)}
        onSubmit={async (name, description) => {
          if (form?.mode === 'create') {
            await createCollection(name, description || undefined)
            toast.success(`Created "${name}"`)
          } else if (form?.collection) {
            await updateCollection(form.collection.id, name, description || undefined)
            toast.success(form.mode === 'description' ? 'Description saved' : 'Collection renamed')
          }
        }}
      />

      <CiteCollectionDialog collection={citing} onClose={() => setCiting(null)} />

      {confirmDelete && (
        <ConfirmActionModal
          title={`Delete "${confirmDelete.name}"?`}
          message="The papers in this collection stay in Saved Sources. Only the collection itself is removed."
          confirmLabel="Delete collection"
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => { await deleteCollection(confirmDelete.id); setConfirmDelete(null) }}
        />
      )}
    </div>
  )
}
