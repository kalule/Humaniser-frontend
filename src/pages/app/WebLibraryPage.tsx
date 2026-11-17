import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, FolderOpen, Folder, Trash2, Tag, Plus,
  Upload, BookOpen, X, Check, Search,
} from 'lucide-react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { UploadModal } from '../../components/ui/UploadModal'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { AddToCollectionModal } from '../../components/webLibrary/AddToCollectionModal'
import { MoveToFolderModal } from '../../components/webLibrary/MoveToFolderModal'
import { BulkActionBar } from '../../components/webLibrary/BulkActionBar'
import { RowActionBar } from '../../components/webLibrary/RowActionBar'
import { LibraryReferenceTable } from '../../components/webLibrary/LibraryReferenceTable'
import { getPrimaryRowActions, getOverflowRowActions, type RowActionHandlers } from '../../components/webLibrary/libraryRowActions'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import { ImportSourcesModal } from '../../components/webLibrary/ImportSourcesModal'
import { SavedPaperPanel } from '../../components/webLibrary/SavedPaperPanel'
import { SavedPapersToolbar } from '../../components/webLibrary/SavedPapersToolbar'
import { SAVED_SORT_OPTIONS, activeSavedFilterCount, sortSavedPapers, type SavedPaperFilters, type SavedSortKey } from '../../lib/savedPaperFilters'
import type { SortDir } from '../../lib/collectionsView'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { exportPapersToCsv } from '../../lib/libraryCsvExport'
import { matchesSavedSourceFilter, savedSourceOrigin, savedSourceText, stepPaper } from '../../lib/savedSources'
import type { PaperDetails } from '../../types/researchLibrary'
import { COLUMN_META } from '../../types/webLibrary'
import type { ResearchDocument, ColumnKey, ActiveLocation } from '../../types/webLibrary'
import toast from 'react-hot-toast'

const TRASH = '__trash__'

// Strips the file extension and a trailing browser dedup suffix like " (1)" —
// fixes raw filenames such as "research-proposal-2026-09-04 (1).docx" showing
// up as the document title (Research Library UX audit, 2026-10-03).
function cleanUploadTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)$/, '').trim() || fileName
}

function locationHeading(activeLocation: ActiveLocation, folders: { id: string; name: string }[]): string {
  if (activeLocation === 'all') return 'All files'
  if (activeLocation === 'trash') return 'Trash'
  if (activeLocation === 'publications') return 'My Publications'
  return folders.find(f => f.id === activeLocation)?.name ?? 'All files'
}

// ── Inner Library Sidebar ──────────────────────────────────────────────────────

function InnerSidebar({
  collapsed,
  onCollapse,
  folders,
  activeLocation,
  onSelectLocation,
  onCreateFolder,
  allCount,
  trashCount,
  allTags,
  tagFilter,
  onTagFilterChange,
}: {
  collapsed:         boolean
  onCollapse:        () => void
  folders:           { id: string; name: string }[]
  activeLocation:    ActiveLocation
  onSelectLocation:  (loc: ActiveLocation) => void
  onCreateFolder:    (name: string) => void
  allCount:          number
  trashCount:        number
  allTags:           string[]
  tagFilter:         string
  onTagFilterChange: (value: string) => void
}) {
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderName, setFolderName]     = useState('')

  const handleCreateFolder = () => {
    if (!folderName.trim()) return
    onCreateFolder(folderName.trim())
    setFolderName(''); setAddingFolder(false)
  }

  const NAV_ITEM = ({
    icon: Icon, label, loc, count, className,
  }: { icon: React.ElementType; label: string; loc: ActiveLocation; count?: number; className?: string }) => (
    <button
      onClick={() => onSelectLocation(loc)}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] transition-colors text-left',
        activeLocation === loc
          ? 'bg-slate-100 text-slate-900 font-medium'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        className,
      )}
    >
      <Icon size={15} className="shrink-0 text-slate-500" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] text-slate-400">{count}</span>
      )}
    </button>
  )

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-slate-200 bg-white flex flex-col items-center pt-4 gap-3">
        <button onClick={onCollapse} aria-label="Expand library sidebar" className="text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onSelectLocation('all')} title="All files" className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', activeLocation === 'all' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-50')}>
          <FolderOpen size={16} />
        </button>
        <button onClick={() => onSelectLocation('trash')} title="Trash" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
          <Trash2 size={16} />
        </button>
        <div className="flex-1" />
        <button onClick={() => { onCollapse(); setAddingFolder(true) }} title="New Folder" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-purple-accent transition-colors mb-3">
          <Plus size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
        <div>
          <p className="text-[14px] font-semibold text-slate-800">My library</p>
          <p className="text-[11px] text-slate-400">{allCount} item{allCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onCollapse} aria-label="Collapse library sidebar" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">

        {/* Private Library */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold px-2 mb-0.5">Private library</p>
          <p className="px-2 mb-1.5 text-[11.5px] leading-snug text-slate-600">Folders are where your papers are stored. Each paper sits in one folder.</p>
          <div className="space-y-0.5">
            {/* All files */}
            <div>
              <NAV_ITEM icon={FolderOpen} label="All files" loc="all" count={allCount} />
              {activeLocation === 'all' && folders.length === 0 && (
                <div className="px-8 py-1">
                  <p className="text-[11px] text-slate-400 leading-relaxed">No folders yet.</p>
                  <button onClick={() => setAddingFolder(true)} className="text-[11px] font-medium text-purple-accent hover:text-purple-deep transition-colors">
                    New folder
                  </button>
                </div>
              )}
              {/* Custom folders */}
              {folders.map(f => (
                <div key={f.id} className="ml-4">
                  <NAV_ITEM icon={Folder} label={f.name} loc={f.id} />
                </div>
              ))}
            </div>
            <NAV_ITEM icon={Trash2} label="Trash" loc="trash" count={trashCount || undefined} />
          </div>
        </div>

        {/* Group library — a scope label for later shared/public libraries, not yet built */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 mb-1.5">Group library</p>
          <p className="px-2 text-[12px] text-slate-400">Not available yet.</p>
        </div>

        {/* Tags — only shown when there's real tag data to filter by */}
        {allTags.length > 0 && (
          <div>
            <div className="flex items-center gap-1 px-2 mb-1.5">
              <Tag size={11} className="text-slate-400" />
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Tags</p>
            </div>
            <div className="px-2">
              <input
                value={tagFilter}
                onChange={e => onTagFilterChange(e.target.value)}
                placeholder="Filter by tag"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-700 placeholder-slate-400 outline-none focus:border-purple-accent transition-colors"
              />
            </div>
            {tagFilter && !allTags.some(t => t.toLowerCase().includes(tagFilter.toLowerCase())) && (
              <p className="text-[11px] text-slate-400 px-2 py-1">No matching tags.</p>
            )}
          </div>
        )}
      </div>

      {/* Footer: New Folder */}
      <div className="border-t border-slate-100 p-2">
        {addingFolder ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setAddingFolder(false) }}
              placeholder="Folder name…"
              className="flex-1 border border-purple-accent rounded-lg px-2.5 py-1.5 text-[12px] outline-none text-slate-700"
            />
            <button onClick={handleCreateFolder} className="w-7 h-7 rounded-lg bg-purple-accent flex items-center justify-center text-white">
              <Check size={13} />
            </button>
            <button onClick={() => setAddingFolder(false)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingFolder(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 hover:text-purple-accent transition-colors"
          >
            <Plus size={14} /> New Folder
          </button>
        )}
      </div>
    </div>
  )
}

// ── Cell: Papers column (Library View) — one compact row per paper ─────────────

function PapersCell({
  doc, selected, onToggle, handlers, inTrash,
}: {
  doc: ResearchDocument
  selected: boolean
  onToggle: () => void
  handlers: RowActionHandlers
  inTrash: boolean
}) {
  const { open } = getPrimaryRowActions(doc, handlers)
  const overflow = getOverflowRowActions(doc, handlers, inTrash)
  const hasAbstract = savedSourceText(doc) === 'abstract'
  const authors = doc.authors.length === 0 ? 'No author recorded' : doc.authors.length > 3 ? `${doc.authors.slice(0, 3).join(', ')} et al.` : doc.authors.join(', ')

  return (
    <td className="align-top p-0 border-b border-slate-100">
      <div className="flex items-start gap-2.5 px-3 py-2">
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          aria-label={selected ? `Deselect ${doc.title}` : `Select ${doc.title}`}
          aria-pressed={selected}
          className={cn(
            'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
            selected ? 'border-purple-accent bg-purple-accent' : 'border-slate-400 hover:border-slate-500',
          )}
        >
          {selected && <Check size={10} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="truncate text-[13.5px] font-semibold leading-snug text-slate-900" title={doc.title}>{doc.title}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-slate-600">
            <span className="truncate">
              {authors}{doc.year ? ` · ${doc.year}` : ''}{doc.journal ? <span className="italic"> · {doc.journal}</span> : null}{doc.doi ? ` · ${doc.doi}` : ''}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10.5px]">
            <span className="rounded bg-slate-100 px-1.5 py-px font-medium text-slate-700">{doc.docType}</span>
            <span className={cn('rounded px-1.5 py-px font-medium', hasAbstract ? 'bg-green-tint text-green-text' : 'bg-slate-100 text-slate-600')}>{hasAbstract ? 'Abstract' : 'Details only'}</span>
            <span className="rounded bg-slate-100 px-1.5 py-px text-slate-600">{savedSourceOrigin(doc) === 'search' ? 'From Find Papers' : 'Imported'}</span>
          </div>
        </div>

        {/* Quick actions on hover/focus (not on phones: no hover, and every action is also in the details panel). */}
        <div className="hidden shrink-0 opacity-0 transition-opacity md:block group-hover:opacity-100 group-focus-within:opacity-100 group-aria-selected:opacity-100">
          <RowActionBar open={open} overflow={overflow} paper={doc} />
        </div>
      </div>
    </td>
  )
}

// ── Cell: AI-generated content column ─────────────────────────────────────────

function ContentCell({
  text, docId, colKey, expanded, onToggle,
}: {
  text?: string
  docId: string
  colKey: string
  expanded: boolean
  onToggle: () => void
}) {
  const baseClass = 'align-top border-b border-slate-100 border-l border-slate-100 w-[320px] max-w-[320px]'
  if (!text) {
    return (
      <td data-doc-id={docId} data-col={colKey} className={baseClass}>
        <p className="px-3 py-2 text-[12px] text-slate-500">—</p>
      </td>
    )
  }
  return (
    <td data-doc-id={docId} data-col={colKey} className={baseClass}>
      <div className="px-3 py-2">
        <p className={cn('text-[12.5px] text-slate-700 leading-relaxed', !expanded && 'line-clamp-3')}>{text}</p>
        {text.length > 180 && (
          <button onClick={e => { e.stopPropagation(); onToggle() }} aria-expanded={expanded} className="mt-0.5 text-[12px] font-medium text-purple-accent hover:text-purple-deep">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </td>
  )
}

// ── Column Header ──────────────────────────────────────────────────────────────

function ColHeader({
  colKey, onRemove, hasPrev, onPrev, hasNext, onNext,
}: {
  colKey: ColumnKey; onRemove: () => void; hasPrev: boolean; onPrev: () => void; hasNext: boolean; onNext: () => void
}) {
  const { label } = COLUMN_META[colKey]
  return (
    <th scope="col" className="text-left px-3 py-2 border-b border-l border-slate-200 bg-slate-50/90 w-[320px] min-w-[320px]">
      <div className="flex items-center gap-1">
        <button onClick={onPrev} disabled={!hasPrev} aria-label={`Move ${label} column left`} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-20 transition-colors">
          <ChevronLeft size={13} />
        </button>
        <span className="flex-1 text-[12.5px] font-semibold text-slate-700">{label}</span>
        <button onClick={onRemove} aria-label={`Remove ${label} column`} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
          <X size={13} />
        </button>
        <button onClick={onNext} disabled={!hasNext} aria-label={`Move ${label} column right`} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-20 transition-colors">
          <ChevronRight size={13} />
        </button>
      </div>
    </th>
  )
}

/** Keys that belong to whatever has focus, not to the paper list. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WebLibraryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const {
    documents, folders, collections, visibleColumns, hasLoaded,
    loadDocuments, loadCollections,
    createFolder, addColumn, removeColumn, reorderColumns,
    updateDocument, trashDocument, deleteDocument,
  } = useWebLibraryStore()

  const [activeLocation,  setActiveLocation]  = useState<ActiveLocation>('all')
  const [libCollapsed,    setLibCollapsed]    = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches) // phones start with the folder rail, not the 224px panel
  const [viewMode,        setViewMode]        = useState<'library' | 'reference'>('library')
  const [sortKey,         setSortKey]         = useState<SavedSortKey>('date-added')
  const [sortDir,         setSortDir]         = useState<SortDir>('desc')
  const [tagFilter,       setTagFilter]       = useState('')
  const [query,           setQuery]           = useState('')
  const [savedFilters,    setSavedFilters]    = useState<SavedPaperFilters>({})
  const [selectedRows,    setSelectedRows]    = useState<Set<string>>(new Set())
  const [openId,          setOpenId]          = useState<string | null>(null)
  const [expandedCells,   setExpandedCells]   = useState<Set<string>>(new Set())  // `${docId}-${colKey}`
  const [uploadOpen,      setUploadOpen]      = useState(false)
  const [importSourcesOpen, setImportSourcesOpen] = useState(false)
  const [collectionModalDocIds, setCollectionModalDocIds] = useState<string[]>([])
  const [moveFolderDoc,   setMoveFolderDoc]   = useState<ResearchDocument | null>(null)
  const [pendingTrash,    setPendingTrash]    = useState<ResearchDocument | null>(null)
  const [pendingDeleteForever, setPendingDeleteForever] = useState<ResearchDocument | null>(null)
  const [pendingBulkTrash, setPendingBulkTrash] = useState(false)
  const redirectedRef = useRef(false)

  useEffect(() => {
    void loadDocuments()
    void loadCollections()
  }, [loadDocuments, loadCollections])

  // Landing redirect: an empty library sends a first-time/returning-cold visitor to Find
  // Papers instead of a blank table — but never on a load error, never via "replace" that
  // would trap Back, and never when the user explicitly clicked the My Library tab itself
  // (WebLibraryTabBar marks that navigation so this effect can tell the difference).
  useEffect(() => {
    if (redirectedRef.current) return
    if (!hasLoaded) return
    if (documents.length > 0) return
    if ((location.state as { fromTabBar?: boolean } | null)?.fromTabBar) return
    redirectedRef.current = true
    navigate('/app/web-library/find', { replace: true })
  }, [hasLoaded, documents.length, location.state, navigate])

  useEffect(() => {
    const provider = params.get('integration')
    const connected = params.get('connected')
    if (!provider || connected === null) return
    if (connected === 'true') {
      toast.success(`${provider === 'zotero' ? 'Zotero' : 'Mendeley'} connected successfully.`)
      setImportSourcesOpen(true)
    } else {
      toast.error(`Could not connect ${provider === 'zotero' ? 'Zotero' : 'Mendeley'}. Please try again.`)
    }
    const next = new URLSearchParams(params)
    next.delete('integration'); next.delete('connected')
    setParams(next, { replace: true })
  }, [params, setParams])

  const allTags = useMemo(() => [...new Set(documents.flatMap(d => d.tags))].sort(), [documents])

  // Location, then tag, then the toolbar's search and filters, then sort.
  const filteredDocs = useMemo(() => {
    let docs = [...documents]
    if (activeLocation === 'all')          docs = docs.filter(d => d.folderId !== TRASH)
    else if (activeLocation === 'trash')   docs = docs.filter(d => d.folderId === TRASH)
    else if (activeLocation === 'publications') docs = docs.filter(d => d.folderId !== TRASH)
    else                                   docs = docs.filter(d => d.folderId === activeLocation)

    if (tagFilter.trim()) {
      const q = tagFilter.trim().toLowerCase()
      docs = docs.filter(d => d.tags.some(t => t.toLowerCase().includes(q)))
    }
    docs = docs.filter(d => matchesSavedSourceFilter(d, { ...savedFilters, query }))

    return sortSavedPapers(docs, sortKey, sortDir)
  }, [documents, activeLocation, tagFilter, savedFilters, query, sortKey, sortDir])

  const trashCount = documents.filter(d => d.folderId === TRASH).length
  const allCount   = documents.filter(d => d.folderId !== TRASH).length
  const inTrash    = activeLocation === 'trash'
  const isNarrowed = query.trim() !== '' || activeSavedFilterCount(savedFilters) > 0 || tagFilter.trim() !== ''

  // No "Generate" handler exists anywhere for these AI columns (confirmed via
  // discovery) — rather than show a column full of "No content available",
  // hide a column entirely until at least one visible row actually has
  // content for it (Research Library UX audit, 2026-10-03).
  const renderedColumns = useMemo(
    () => visibleColumns.filter(key => filteredDocs.some(d => (d[key as keyof ResearchDocument] as string | undefined)?.trim())),
    [visibleColumns, filteredDocs],
  )

  // The details panel follows the list: a paper that is filtered out, trashed or deleted closes it.
  const openIndex = openId ? filteredDocs.findIndex(d => d.id === openId) : -1
  const openDoc = openIndex >= 0 ? filteredDocs[openIndex] : null
  useEffect(() => { if (openId && openIndex === -1) setOpenId(null) }, [openId, openIndex])

  const focusRow = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll<HTMLElement>('[data-paper-row]')).find(el => el.dataset.paperRow === id)
      row?.focus({ preventScroll: true })
      row?.scrollIntoView?.({ block: 'nearest' })
    })
  }, [])

  const openPaper = useCallback((id: string | null, focus = false) => {
    setOpenId(id)
    if (id && focus) focusRow(id)
  }, [focusRow])

  const closePanel = useCallback(() => {
    const id = openId
    setOpenId(null)
    if (id) focusRow(id)
  }, [openId, focusRow])

  // List keyboard: ↑/↓ move between papers (and open them when the panel is showing), Esc closes
  // the panel first and only then clears a selection. Keys typed into a field, or pressed while a
  // modal dialog (collection picker, confirmations, full record) is open, are left alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const fromRow = (e.target as HTMLElement | null)?.closest?.('[data-paper-row]')?.getAttribute('data-paper-row')
        if (!openId && !fromRow) return
        e.preventDefault()
        const next = stepPaper(filteredDocs.map(d => d.id), openId ?? fromRow ?? null, e.key === 'ArrowDown' ? 1 : -1)
        if (!next) return
        if (openId) openPaper(next, true)
        else focusRow(next)
      } else if (e.key === 'Escape') {
        if (openId) closePanel()
        else if (selectedRows.size > 0) setSelectedRows(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, filteredDocs, selectedRows.size, openPaper, focusRow, closePanel])

  const toggleRow = (id: string) =>
    setSelectedRows(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const toggleCell = (docId: string, colKey: ColumnKey) => {
    const k = `${docId}-${colKey}`
    setExpandedCells(prev => {
      const n = new Set(prev)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })
  }

  const allVisibleSelected = filteredDocs.length > 0 && filteredDocs.every(d => selectedRows.has(d.id))
  const toggleAllRows = () => {
    setSelectedRows(allVisibleSelected ? new Set() : new Set(filteredDocs.map(d => d.id)))
  }

  const moveColumnLeft = (key: ColumnKey) => {
    const idx = visibleColumns.indexOf(key)
    if (idx <= 0) return
    const next = [...visibleColumns]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    reorderColumns(next)
  }

  const moveColumnRight = (key: ColumnKey) => {
    const idx = visibleColumns.indexOf(key)
    if (idx >= visibleColumns.length - 1) return
    const next = [...visibleColumns]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    reorderColumns(next)
  }

  const handleUpload = (files: File[], folderId: string | null = null) => {
    files.forEach(file => {
      void useWebLibraryStore.getState().addDocument({
        title:    cleanUploadTitle(file.name),
        docType:  'Journal Article',
        filePath: URL.createObjectURL(file),
        isFullText: true,
        folderId,
      })
    })
    toast.success(`${files.length} file${files.length !== 1 ? 's' : ''} uploaded`)
  }

  // ── Shared row-action handlers (Library View, Reference table, details panel) ──
  const rowActionHandlers: RowActionHandlers = {
    onOpenPdfViewer: (doc) => { if (doc.canonicalWorkId) navigate(`/app/web-library/papers/${doc.canonicalWorkId}/pdf`) },
    onDownload: (doc) => {
      if (!doc.filePath) { toast('No file attached to this record'); return }
      const a = document.createElement('a')
      a.href = doc.filePath
      a.download = `${doc.title}.pdf`
      a.click()
    },
    onAddToCollection: (doc) => setCollectionModalDocIds([doc.id]),
    onDetails: (doc) => {
      if (!doc.canonicalWorkId) return
      const next = new URLSearchParams(params); next.set('paper', doc.canonicalWorkId); setParams(next, { replace: true })
    },
    onMoveToFolder: (doc) => setMoveFolderDoc(doc),
    onTrash: (doc) => setPendingTrash(doc),
    onRestore: inTrash ? (doc) => {
      void updateDocument(doc.id, { folderId: null }).then(() => toast.success('Restored to All files'))
    } : undefined,
    onDeleteForever: inTrash ? (doc) => setPendingDeleteForever(doc) : undefined,
  }

  const heading = locationHeading(activeLocation, folders)
  const selectedDocs = filteredDocs.filter(d => selectedRows.has(d.id))
  const folderNameOf = (doc: ResearchDocument) =>
    doc.folderId === TRASH ? 'Trash' : doc.folderId ? folders.find(f => f.id === doc.folderId)?.name : undefined

  const rowProps = (doc: ResearchDocument) => ({
    'data-paper-row': doc.id,
    tabIndex: 0,
    'aria-selected': openId === doc.id,
    onClick: () => openPaper(doc.id),
    onKeyDown: (e: React.KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openPaper(doc.id) } },
  })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="library" />

      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Inner Library Sidebar ──────────────────────────────────────────── */}
      <InnerSidebar
        collapsed={libCollapsed}
        onCollapse={() => setLibCollapsed(v => !v)}
        folders={folders}
        activeLocation={activeLocation}
        onSelectLocation={(loc) => { setActiveLocation(loc); setSelectedRows(new Set()) }}
        onCreateFolder={createFolder}
        allCount={allCount}
        trashCount={trashCount}
        allTags={allTags}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
      />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        <SavedPapersToolbar
          heading={heading}
          count={filteredDocs.length}
          query={query}
          onQuery={setQuery}
          filters={savedFilters}
          onFilters={setSavedFilters}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir) }}
          viewMode={viewMode}
          onViewMode={setViewMode}
          visibleColumns={visibleColumns}
          onToggleColumn={(k) => visibleColumns.includes(k) ? removeColumn(k) : addColumn(k)}
          onExport={() => exportPapersToCsv(selectedRows.size > 0 ? selectedDocs : filteredDocs)}
          exportLabel={selectedRows.size > 0 ? `Export ${selectedRows.size} selected (CSV)` : `Export ${filteredDocs.length} shown (CSV)`}
          onImport={() => setImportSourcesOpen(true)}
        />

        {/* ── Contextual: only while papers are selected ─────────────────────── */}
        {selectedRows.size > 0 && (
          <BulkActionBar
            count={selectedRows.size}
            onAddToCollection={inTrash ? undefined : () => setCollectionModalDocIds([...selectedRows])}
            onExport={() => exportPapersToCsv(selectedDocs)}
            onTrash={() => setPendingBulkTrash(true)}
            trashLabel={inTrash ? 'Delete permanently' : 'Move to Trash'}
            onClear={() => setSelectedRows(new Set())}
          />
        )}

        {/* ── List ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {!hasLoaded ? (
            <div className="space-y-2 p-4" aria-label="Loading saved papers">
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <BookOpen size={22} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-slate-800 font-medium text-[14px]">
                    {isNarrowed ? 'No papers match your search or filters' : inTrash ? 'Trash is empty' : `No papers in ${heading}`}
                  </p>
                  {!inTrash && !isNarrowed && (
                    <p className="text-slate-600 text-[13px] mt-1">Find papers to save, or import references from Zotero, Mendeley or a file.</p>
                  )}
                </div>
                {isNarrowed ? (
                  <button onClick={() => { setQuery(''); setSavedFilters({}); setTagFilter('') }} className="text-[13px] font-medium text-purple-accent hover:text-purple-deep">
                    Clear search and filters
                  </button>
                ) : !inTrash && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/app/web-library/find')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors">
                      <Search size={14} /> Find papers
                    </button>
                    <button onClick={() => setImportSourcesOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[13px] font-medium transition-colors">
                      <Upload size={14} /> Import
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === 'reference' ? (
            <LibraryReferenceTable
              docs={filteredDocs}
              selectedRows={selectedRows}
              onToggleRow={toggleRow}
              onToggleAll={toggleAllRows}
              onOpenDoc={(doc) => openPaper(doc.id)}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(key) => {
                if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                else { setSortKey(key); setSortDir(SAVED_SORT_OPTIONS.find(o => o.value === key)!.defaultDir) }
              }}
              inTrash={inTrash}
              handlers={rowActionHandlers}
              activeId={openId}
            />
          ) : (
            // Fixed layout so long titles truncate instead of widening the table past the screen;
            // added content columns (320px each) still scroll sideways.
            <table className="w-full table-fixed border-collapse" style={renderedColumns.length ? { minWidth: 420 + 320 * renderedColumns.length } : undefined}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th scope="col" className="text-left px-3 py-2 border-b border-slate-200 bg-slate-50/90 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleAllRows}
                        aria-label={allVisibleSelected ? 'Deselect all' : 'Select all'}
                        aria-pressed={allVisibleSelected}
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                          allVisibleSelected ? 'border-purple-accent bg-purple-accent' : 'border-slate-400 hover:border-slate-500',
                        )}
                      >
                        {allVisibleSelected && <Check size={10} className="text-white" />}
                      </button>
                      <span className="text-[12.5px] font-semibold text-slate-700">
                        Papers ({selectedRows.size > 0 ? `${selectedRows.size}/` : ''}{filteredDocs.length})
                      </span>
                    </div>
                  </th>

                  {renderedColumns.map((key, idx) => (
                    <ColHeader
                      key={key}
                      colKey={key}
                      onRemove={() => removeColumn(key)}
                      hasPrev={idx > 0}
                      onPrev={() => moveColumnLeft(key)}
                      hasNext={idx < renderedColumns.length - 1}
                      onNext={() => moveColumnRight(key)}
                    />
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredDocs.map(doc => (
                  <tr
                    key={doc.id}
                    {...rowProps(doc)}
                    className={cn(
                      'group cursor-pointer hover:bg-slate-50/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40',
                      selectedRows.has(doc.id) && 'bg-purple-tint/25',
                      openId === doc.id && 'bg-purple-tint/50 shadow-[inset_3px_0_0_var(--color-purple)]',
                    )}
                  >
                    <PapersCell
                      doc={doc}
                      selected={selectedRows.has(doc.id)}
                      onToggle={() => toggleRow(doc.id)}
                      handlers={rowActionHandlers}
                      inTrash={inTrash}
                    />
                    {renderedColumns.map(key => (
                      <ContentCell
                        key={key}
                        text={doc[key as keyof ResearchDocument] as string | undefined}
                        docId={doc.id}
                        colKey={key}
                        expanded={expandedCells.has(`${doc.id}-${key}`)}
                        onToggle={() => toggleCell(doc.id, key)}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Details panel: a column on wide screens, a drawer on narrow ones ── */}
      {openDoc && (
        <SavedPaperPanel
          doc={openDoc}
          position={openIndex + 1}
          total={filteredDocs.length}
          folderName={folderNameOf(openDoc)}
          inTrash={inTrash}
          handlers={rowActionHandlers}
          onClose={closePanel}
          onPrev={openIndex > 0 ? () => openPaper(filteredDocs[openIndex - 1].id, true) : undefined}
          onNext={openIndex < filteredDocs.length - 1 ? () => openPaper(filteredDocs[openIndex + 1].id, true) : undefined}
        />
      )}
      </div>

      {/* ── Import / Upload ───────────────────────────────────────────────── */}
      <ImportSourcesModal
        open={importSourcesOpen}
        collections={collections}
        onClose={() => setImportSourcesOpen(false)}
        onUploadPdf={() => setUploadOpen(true)}
        onImported={() => { void loadDocuments(); void loadCollections() }}
      />
      <UploadModal
        open={uploadOpen}
        folders={folders}
        initialFolderId={activeLocation === 'all' || activeLocation === 'trash' || activeLocation === 'publications' ? null : activeLocation}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        onCreateFolder={createFolder}
      />

      {/* ── Add to Collection (single row or bulk) ──────────────────────────── */}
      <AddToCollectionModal
        open={collectionModalDocIds.length > 0}
        documentIds={collectionModalDocIds}
        onClose={() => setCollectionModalDocIds([])}
      />

      {/* ── Move to folder ───────────────────────────────────────────────────── */}
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

      {/* ── Trash / delete confirmations — copy matches real behaviour: folderId
           sentinel, not a separate trash API; only "Delete permanently" is a
           real irreversible hard delete (Research Library UX audit). ───────── */}
      <AnimatePresence>
        {pendingTrash && (
          <ConfirmActionModal
            title={`Move "${pendingTrash.title}" to Trash?`}
            message="It will be hidden from your library but not deleted — restore it from Trash at any time."
            confirmLabel="Move to Trash"
            tone="reversible"
            onClose={() => setPendingTrash(null)}
            onConfirm={async () => { await trashDocument(pendingTrash.id); setPendingTrash(null) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingDeleteForever && (
          <ConfirmActionModal
            title={`Delete "${pendingDeleteForever.title}" permanently?`}
            message="This cannot be undone."
            confirmLabel="Delete permanently"
            onClose={() => setPendingDeleteForever(null)}
            onConfirm={async () => { await deleteDocument(pendingDeleteForever.id); setPendingDeleteForever(null) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingBulkTrash && (
          <ConfirmActionModal
            title={inTrash
              ? `Delete ${selectedRows.size} paper${selectedRows.size === 1 ? '' : 's'} permanently?`
              : `Move ${selectedRows.size} paper${selectedRows.size === 1 ? '' : 's'} to Trash?`}
            message={inTrash ? 'This cannot be undone.' : "They'll be hidden from your library but not deleted — restore them from Trash at any time."}
            confirmLabel={inTrash ? 'Delete permanently' : 'Move to Trash'}
            tone={inTrash ? undefined : 'reversible'}
            onClose={() => setPendingBulkTrash(false)}
            onConfirm={async () => {
              await Promise.all(selectedDocs.map(d => inTrash ? deleteDocument(d.id) : trashDocument(d.id)))
              setPendingBulkTrash(false)
              setSelectedRows(new Set())
            }}
          />
        )}
      </AnimatePresence>

      <PaperDetailsDrawer workId={params.get('paper')} onClose={() => { const next = new URLSearchParams(params); next.delete('paper'); setParams(next, { replace: true }) }} onOpenPdf={(paper: PaperDetails) => navigate(`/app/web-library/papers/${paper.id}/pdf`)} />
    </div>
  )
}
