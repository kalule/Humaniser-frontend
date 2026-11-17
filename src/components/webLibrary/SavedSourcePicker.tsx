import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { webLibraryApi } from '../../api/webLibrary'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { filterSavedSources, savedSourceByline, savedSourceText, TRASH_FOLDER } from '../../lib/savedSources'
import type { Collection, LibraryFolder, ResearchDocument } from '../../types/webLibrary'

interface SavedSourcePickerProps {
  /** Multi-select: the chosen saved-source ids. Omit together with `onChange` for pick-one use. */
  selectedIds?: string[]
  onChange?: (ids: string[]) => void
  /** Pick-one: called when a row is chosen. The row shows this label as its action. */
  onPick?: (doc: ResearchDocument) => void
  pickLabel?: string
  /** Sources that hold bibliographic details only cannot be chosen (they cannot support a claim). */
  requireText?: boolean
  max?: number
  disabled?: boolean
  /** Tailwind max-height class for the list. */
  listClassName?: string
}

/**
 * One picker for every screen that uses Saved Sources: search by title, author, DOI or keyword,
 * narrow by folder or collection, filter by abstract and DOI, preview the abstract, and choose
 * one or many. It only reads the library; what happens to the choice is the caller's business.
 */
export function SavedSourcePicker(props: SavedSourcePickerProps) {
  const { documents, folders, collections, hasLoaded, isLoading, collectionsLoaded, loadDocuments, loadCollections } = useWebLibraryStore()
  useEffect(() => { if (!hasLoaded && !isLoading) void loadDocuments() }, [hasLoaded, isLoading, loadDocuments])
  useEffect(() => { if (!collectionsLoaded) void loadCollections() }, [collectionsLoaded, loadCollections])
  return <SavedSourcePickerView {...props} documents={documents} folders={folders} collections={collections} hasLoaded={hasLoaded} isLoading={isLoading} />
}

interface SavedSourcePickerViewProps extends SavedSourcePickerProps {
  documents: ResearchDocument[]
  folders: LibraryFolder[]
  collections: Collection[]
  hasLoaded: boolean
  isLoading: boolean
}

/** The picker without the store: everything it shows comes in through props. */
export function SavedSourcePickerView({
  selectedIds = [], onChange, onPick, pickLabel = 'Insert', requireText = false, max, disabled = false, listClassName = 'max-h-56',
  documents, folders, collections, hasLoaded, isLoading,
}: SavedSourcePickerViewProps) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('all')
  const [withAbstractOnly, setWithAbstractOnly] = useState(false)
  const [withDoiOnly, setWithDoiOnly] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [members, setMembers] = useState<{ location: string; ids: Set<string> } | null>(null)
  const [membersError, setMembersError] = useState(false)

  // Collection membership is not part of the library list, so it is fetched when a collection is chosen.
  useEffect(() => {
    if (!location.startsWith('collection:')) return
    let current = true
    setMembersError(false)
    webLibraryApi.getCollectionDetail(location.slice('collection:'.length))
      .then(detail => { if (current) setMembers({ location, ids: new Set(detail.papers.map(p => p.id)) }) })
      .catch(() => { if (current) { setMembers({ location, ids: new Set() }); setMembersError(true) } })
    return () => { current = false }
  }, [location])

  const loadingMembers = location.startsWith('collection:') && members?.location !== location
  const available = useMemo(() => documents.filter(d => d.folderId !== TRASH_FOLDER), [documents])
  const filtered = useMemo(() => filterSavedSources(documents, {
    query, location, withAbstractOnly, withDoiOnly,
    collectionMemberIds: members?.location === location ? members.ids : null,
  }), [documents, query, location, withAbstractOnly, withDoiOnly, members])

  const multi = Boolean(onChange)
  const atLimit = max != null && selectedIds.length >= max
  const toggle = (id: string) => {
    if (!onChange) return
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }
  const selectable = filtered.filter(d => !requireText || savedSourceText(d) === 'abstract')
  const allShownSelected = selectable.length > 0 && selectable.every(d => selectedIds.includes(d.id))
  const selectShown = () => {
    if (!onChange) return
    if (allShownSelected) { onChange(selectedIds.filter(id => !selectable.some(d => d.id === id))); return }
    const next = [...selectedIds]
    for (const doc of selectable) {
      if (max != null && next.length >= max) break
      if (!next.includes(doc.id)) next.push(doc.id)
    }
    onChange(next)
  }

  if (!hasLoaded) return <p role="status" className="text-[13px] text-slate-400">{isLoading ? 'Loading your saved sources…' : 'Your saved sources could not be loaded. Refresh the page to try again.'}</p>
  if (available.length === 0) return (
    <p className="text-[13px] text-slate-500">
      You have no saved sources yet. <Link to="/app/web-library/find" className="text-purple-accent hover:underline">Find papers</Link> and save the ones you want to write from.
    </p>
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)} disabled={disabled}
            aria-label="Search saved sources" placeholder="Title, author, DOI or keyword"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-[12px] text-slate-700 outline-none placeholder-slate-400 focus:border-purple-accent"
          />
        </div>
        <select
          value={location} onChange={e => setLocation(e.target.value)} disabled={disabled} aria-label="Folder or collection"
          className="max-w-[11rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 outline-none focus:border-purple-accent"
        >
          <option value="all">All saved sources</option>
          {folders.length > 0 && <optgroup label="Folders">{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>}
          {collections.length > 0 && <optgroup label="Collections">{collections.map(c => <option key={c.id} value={`collection:${c.id}`}>{c.name}</option>)}</optgroup>}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={withAbstractOnly} onChange={e => setWithAbstractOnly(e.target.checked)} disabled={disabled} />Has abstract</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={withDoiOnly} onChange={e => setWithDoiOnly(e.target.checked)} disabled={disabled} />Has DOI</label>
        {multi && selectable.length > 0 && (
          <button type="button" onClick={selectShown} disabled={disabled} className="text-purple-accent hover:underline disabled:opacity-50">
            {allShownSelected ? 'Clear shown' : `Select shown (${selectable.length})`}
          </button>
        )}
        {multi && <span className="ml-auto tabular-nums text-slate-500" aria-live="polite">{selectedIds.length}{max != null ? ` of ${max}` : ''} selected</span>}
      </div>

      {membersError && <p role="alert" className="text-[12px] text-red-600">This collection could not be loaded. Choose it again to retry.</p>}

      <ul className={cn('divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white', listClassName)}>
        {loadingMembers ? <li className="px-3 py-3 text-[12px] text-slate-400" role="status">Loading collection…</li>
          : filtered.length === 0 ? <li className="px-3 py-3 text-[12px] text-slate-500">No saved sources match.</li>
          : filtered.map(doc => {
            const text = savedSourceText(doc)
            const blocked = requireText && text !== 'abstract'
            const checked = selectedIds.includes(doc.id)
            const rowDisabled = disabled || blocked || (multi && !checked && atLimit)
            const open = expanded === doc.id
            return (
              <li key={doc.id} className={cn('px-2.5 py-2', blocked && 'bg-slate-50')}>
                <div className="flex items-start gap-2">
                  {multi && (
                    <input
                      type="checkbox" className="mt-1 shrink-0" checked={checked} disabled={rowDisabled}
                      onChange={() => toggle(doc.id)} aria-label={`Use ${doc.title}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[12.5px] font-medium leading-snug', blocked ? 'text-slate-400' : 'text-slate-800')}>{doc.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {savedSourceByline(doc)}{doc.journal ? <span className="italic"> · {doc.journal}</span> : null}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', text === 'abstract' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                        {text === 'abstract' ? 'Abstract' : 'Details only'}
                      </span>
                      {doc.doi && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">DOI</span>}
                      {text === 'abstract' && (
                        <button
                          type="button" onClick={() => setExpanded(open ? null : doc.id)} aria-expanded={open}
                          className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-800"
                        >
                          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}{open ? 'Hide abstract' : 'Preview abstract'}
                        </button>
                      )}
                      {blocked && <span className="text-[11px] text-slate-500">No abstract, so it cannot be used as evidence.</span>}
                    </div>
                    {open && <p className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-line rounded bg-slate-50 p-2 text-[11.5px] leading-relaxed text-slate-600">{doc.abstract}</p>}
                  </div>
                  {onPick && (
                    <button
                      type="button" onClick={() => onPick(doc)} disabled={rowDisabled}
                      className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-purple-accent hover:bg-purple-tint disabled:opacity-50"
                    >
                      {pickLabel}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
