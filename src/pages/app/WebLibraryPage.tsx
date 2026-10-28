import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, FolderOpen, Folder, Trash2, Tag, Plus,
  Upload, BookOpen,
  ChevronDown, Download, X, Sparkles, ArrowUpDown,
  Check, Search, List, Table2,
} from 'lucide-react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { UploadModal } from '../../components/ui/UploadModal'
import { LibraryChatDrawer } from '../../components/ui/LibraryChatDrawer'
import type { ChatContext } from '../../components/ui/LibraryChatDrawer'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { AddToCollectionModal } from '../../components/webLibrary/AddToCollectionModal'
import { MoveToFolderModal } from '../../components/webLibrary/MoveToFolderModal'
import { BulkActionBar } from '../../components/webLibrary/BulkActionBar'
import { RowActionBar } from '../../components/webLibrary/RowActionBar'
import { LibraryReferenceTable } from '../../components/webLibrary/LibraryReferenceTable'
import { getPrimaryRowActions, getOverflowRowActions, type RowActionHandlers } from '../../components/webLibrary/libraryRowActions'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import { ImportSourcesModal } from '../../components/webLibrary/ImportSourcesModal'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { Tooltip } from '../../components/ui/Tooltip'
import { exportPapersToCsv } from '../../lib/libraryCsvExport'
import type { PaperDetails } from '../../types/researchLibrary'
import {
  COLUMN_META, ORDERED_COLUMNS,
} from '../../types/webLibrary'
import type {
  ResearchDocument, ColumnKey, ActiveLocation, ResearchDocType,
} from '../../types/webLibrary'
import toast from 'react-hot-toast'

// ── Constants ──────────────────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<ResearchDocType, string> = {
  'Journal Article':  'bg-slate-100 text-slate-600 border border-slate-200',
  'Book':             'bg-slate-100 text-slate-600 border border-slate-200',
  'Book Chapter':     'bg-slate-100 text-slate-600 border border-slate-200',
  'Conference Paper': 'bg-slate-100 text-slate-600 border border-slate-200',
  'Preprint':         'bg-slate-100 text-slate-600 border border-slate-200',
  'Report':           'bg-slate-100 text-slate-600 border border-slate-200',
  'Thesis':           'bg-slate-100 text-slate-600 border border-slate-200',
}

const SORT_OPTIONS = [
  { label: 'Date Added',    value: 'date-added'   },
  { label: 'Title A–Z',    value: 'title-asc'    },
  { label: 'Title Z–A',    value: 'title-desc'   },
  { label: 'Year',         value: 'year'         },
]

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
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 mb-1.5">Private library</p>
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

// ── Cell: Papers column (Library View) ──────────────────────────────────────────

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

  return (
    <td className="align-top p-0 border-b border-slate-100">
      <div className="flex gap-2.5 p-3 min-h-[120px]">
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          aria-label={selected ? `Deselect ${doc.title}` : `Select ${doc.title}`}
          className={cn(
            'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
            selected ? 'border-purple-accent bg-purple-accent' : 'border-slate-300 hover:border-slate-400',
          )}
        >
          {selected && <Check size={10} className="text-white" />}
        </button>

        {/* Document info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Type badge + Full-text indicator */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('inline-block text-[10px] font-medium px-1.5 py-0.5 rounded', DOC_TYPE_COLORS[doc.docType] ?? 'bg-slate-50 text-slate-600')}>
              {doc.docType}
            </span>
            {doc.isFullText && (
              <Tooltip label="Full text is available for this record">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-tint text-purple-text">Full text</span>
              </Tooltip>
            )}
          </div>

          {/* Title */}
          <p className="text-[13px] font-semibold text-slate-800 hover:underline cursor-pointer leading-snug line-clamp-2">
            {doc.title}
          </p>

          {/* Author */}
          {doc.authors.length > 0 && (
            <p className="text-[12px] text-slate-500">{doc.authors.join(', ')}</p>
          )}

          <div className="mt-2">
            <RowActionBar open={open} overflow={overflow} paper={doc} />
          </div>
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
  const PREVIEW_LEN = 320
  const baseClass = 'align-top border-b border-slate-100 border-l border-slate-100 w-[340px] max-w-[340px]'

  if (!text) {
    return (
      <td
        data-doc-id={docId}
        data-col={colKey}
        className={baseClass}
      >
        <div className="p-3 min-h-[120px] flex items-center justify-center">
          <p className="text-[12px] text-slate-300 italic">No content available</p>
        </div>
      </td>
    )
  }

  const truncated = text.length > PREVIEW_LEN && !expanded

  return (
    <td
      data-doc-id={docId}
      data-col={colKey}
      className={baseClass}
    >
      <div className="p-3 min-h-[120px] flex flex-col gap-2">
        <p className="text-[13px] text-slate-700 leading-relaxed">
          {truncated ? text.slice(0, PREVIEW_LEN) + '…' : text}
        </p>
        {text.length > PREVIEW_LEN && (
          <button onClick={onToggle} className="text-[12px] text-purple-accent hover:text-purple-deep self-start font-medium transition-colors">
            {expanded ? 'Show less' : 'View More'}
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
    <th scope="col" className="text-left px-3 py-2.5 border-b border-l border-slate-200 bg-slate-50/80 w-[340px] min-w-[340px]">
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev} disabled={!hasPrev}
          aria-label={`Move ${label} column left`}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 disabled:opacity-20 transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="flex-1 text-[13px] font-semibold text-slate-700">{label}</span>
        <button onClick={onRemove} aria-label={`Remove ${label} column`} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
          <X size={13} />
        </button>
        <button
          onClick={onNext} disabled={!hasNext}
          aria-label={`Move ${label} column right`}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 disabled:opacity-20 transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </th>
  )
}

// ── Sort Dropdown ──────────────────────────────────────────────────────────────

function SortDropdown({ sortBy, onSort }: { sortBy: string; onSort: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const label = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Date Added'

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:border-slate-300 transition-colors">
        <ArrowUpDown size={13} className="text-slate-400" />
        <span>Sort: <span className="font-medium text-slate-800">{label}</span></span>
        <ChevronDown size={12} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 w-44 py-1 overflow-hidden"
            >
              {SORT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => { onSort(o.value); setOpen(false) }}
                  className={cn('w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors', sortBy === o.value ? 'text-purple-accent font-medium bg-purple-tint' : 'text-slate-600 hover:bg-slate-50')}>
                  {sortBy === o.value && <Check size={12} className="text-purple-accent" />}
                  <span>{o.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
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
  const [libCollapsed,    setLibCollapsed]    = useState(false)
  const [viewMode,        setViewMode]        = useState<'library' | 'reference'>('library')
  const [sortBy,          setSortBy]          = useState('date-added')
  const [tagFilter,       setTagFilter]       = useState('')
  const [selectedRows,    setSelectedRows]    = useState<Set<string>>(new Set())
  const [expandedCells,   setExpandedCells]   = useState<Set<string>>(new Set())  // `${docId}-${colKey}`
  const [uploadOpen,      setUploadOpen]      = useState(false)
  const [importSourcesOpen, setImportSourcesOpen] = useState(false)
  const [addColDropdown,  setAddColDropdown]  = useState(false)
  const [chatOpen,        setChatOpen]        = useState(false)
  const [chatContext,     setChatContext]     = useState<ChatContext | null>(null)
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

  // Clear selection with Esc
  useEffect(() => {
    if (selectedRows.size === 0) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedRows(new Set()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedRows.size])

  const allTags = useMemo(() => [...new Set(documents.flatMap(d => d.tags))].sort(), [documents])

  // Filter by location, then by tag
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

    if (sortBy === 'title-asc')  docs.sort((a, b) => a.title.localeCompare(b.title))
    if (sortBy === 'title-desc') docs.sort((a, b) => b.title.localeCompare(a.title))
    if (sortBy === 'year')       docs.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    if (sortBy === 'date-added') docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return docs
  }, [documents, activeLocation, tagFilter, sortBy])

  const trashCount = documents.filter(d => d.folderId === TRASH).length
  const allCount   = documents.filter(d => d.folderId !== TRASH).length
  const inTrash    = activeLocation === 'trash'

  // No "Generate" handler exists anywhere for these AI columns (confirmed via
  // discovery) — rather than show a column full of "No content available",
  // hide a column entirely until at least one visible row actually has
  // content for it (Research Library UX audit, 2026-10-03).
  const renderedColumns = useMemo(
    () => visibleColumns.filter(key => filteredDocs.some(d => (d[key as keyof ResearchDocument] as string | undefined)?.trim())),
    [visibleColumns, filteredDocs],
  )

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

  const toggleAllRows = () => {
    if (selectedRows.size === filteredDocs.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredDocs.map(d => d.id)))
    }
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

  const handleChatClick = useCallback((doc: ResearchDocument) => {
    setChatContext({ docId: doc.id, title: doc.title })
    setChatOpen(true)
  }, [])

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

  // ── Shared row-action handlers (Library View, Reference Manager View) ───────
  const rowActionHandlers: RowActionHandlers = {
    onOpenPdfViewer: (doc) => { if (doc.canonicalWorkId) navigate(`/app/web-library/papers/${doc.canonicalWorkId}/pdf`) },
    onDownload: (doc) => {
      if (!doc.filePath) { toast('No file attached to this record'); return }
      const a = document.createElement('a')
      a.href = doc.filePath
      a.download = `${doc.title}.pdf`
      a.click()
    },
    onChat: handleChatClick,
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
        onSelectLocation={setActiveLocation}
        onCreateFolder={createFolder}
        allCount={allCount}
        trashCount={trashCount}
        allTags={allTags}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
      />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Ask your library — the one entry point into library chat.
             LibraryChatDrawer doesn't accept an external initial question, so
             this is a styled trigger button rather than a live input; no new
             AI call is introduced (Research Library UX audit, 2026-10-03). ── */}
        <button
          onClick={() => { setChatContext(null); setChatOpen(true) }}
          className="h-9 border-b border-slate-100 flex items-center px-5 gap-2 shrink-0 bg-slate-50/60 hover:bg-purple-tint/40 transition-colors text-left"
        >
          <Sparkles size={14} className="text-purple-accent" />
          <span className="text-[13px] text-slate-600">Ask your library a question…</span>
        </button>

        {/* ── Top utility bar ────────────────────────────────────────────────── */}
        <div className="min-h-[48px] border-b border-slate-100 flex items-center flex-wrap px-5 py-2 gap-3 shrink-0">
          <h1 className="text-[15px] font-semibold text-slate-800 mr-1">My library – {heading}</h1>
          <div className="flex-1" />
          <button
            onClick={() => setImportSourcesOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors shadow-sm"
          >
            <Upload size={14} /> Import sources
          </button>
        </div>

        {/* ── Table controls (view toggle, columns, sort, export) ──────────────── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 shrink-0 flex-wrap">
          {/* View toggle */}
          <div role="radiogroup" aria-label="Table view" className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              role="radio"
              aria-checked={viewMode === 'library'}
              onClick={() => setViewMode('library')}
              title="Library View — reading-oriented rows"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors', viewMode === 'library' ? 'bg-white text-purple-accent shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              <List size={13} /> Library View
            </button>
            <button
              role="radio"
              aria-checked={viewMode === 'reference'}
              onClick={() => setViewMode('reference')}
              title="Reference Manager View — dense metadata table"
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors', viewMode === 'reference' ? 'bg-white text-purple-accent shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              <Table2 size={13} /> Reference Manager
            </button>
          </div>

          {viewMode === 'library' && (
            <div className="relative">
              <button
                onClick={() => setAddColDropdown(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:border-slate-300 transition-colors"
              >
                Columns: {visibleColumns.length} of {ORDERED_COLUMNS.length}
                <ChevronDown size={12} className={cn('text-slate-400 transition-transform', addColDropdown && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {addColDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAddColDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 w-56 py-1 overflow-hidden"
                    >
                      {ORDERED_COLUMNS.map(key => {
                        const isVisible = visibleColumns.includes(key)
                        return (
                          <button
                            key={key}
                            onClick={() => { isVisible ? removeColumn(key) : addColumn(key) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', isVisible ? 'border-purple-accent bg-purple-accent' : 'border-slate-300')}>
                              {isVisible && <Check size={10} className="text-white" />}
                            </span>
                            {COLUMN_META[key].label}
                          </button>
                        )
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex-1" />

          <SortDropdown sortBy={sortBy} onSort={setSortBy} />

          <button
            onClick={() => exportPapersToCsv(selectedRows.size > 0 ? selectedDocs : filteredDocs)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Download size={13} /> Export {selectedRows.size > 0 ? `(${selectedRows.size})` : 'CSV'}
          </button>
        </div>

        {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
        {selectedRows.size > 0 && (
          <BulkActionBar
            count={selectedRows.size}
            onAddToCollection={() => setCollectionModalDocIds([...selectedRows])}
            onExport={() => exportPapersToCsv(selectedDocs)}
            onTrash={() => setPendingBulkTrash(true)}
            onClear={() => setSelectedRows(new Set())}
          />
        )}

        {/* ── Table area ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {filteredDocs.length === 0 ? (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <BookOpen size={24} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-700 font-medium text-[14px]">
                    {inTrash ? 'Trash is empty' : `No documents in ${heading}`}
                  </p>
                  {!inTrash && (
                    <p className="text-slate-400 text-[13px] mt-1">Import a paper, or find one to save.</p>
                  )}
                </div>
                {!inTrash && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setImportSourcesOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors"
                    >
                      <Upload size={14} /> Import sources
                    </button>
                    <button
                      onClick={() => navigate('/app/web-library/find')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 text-[13px] font-medium transition-colors"
                    >
                      <Search size={14} /> Find papers
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
              onOpenDoc={(doc) => doc.canonicalWorkId && rowActionHandlers.onDetails(doc)}
              sortBy={sortBy}
              onSort={setSortBy}
              inTrash={inTrash}
              handlers={rowActionHandlers}
            />
          ) : (
            <table className="w-full border-collapse min-w-max">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th scope="col" className="text-left px-3 py-2.5 border-b border-slate-200 bg-slate-50/90 backdrop-blur-sm w-[420px] min-w-[380px]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleAllRows}
                        aria-label={selectedRows.size === filteredDocs.length && filteredDocs.length > 0 ? 'Deselect all' : 'Select all'}
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                          selectedRows.size === filteredDocs.length && filteredDocs.length > 0
                            ? 'border-purple-accent bg-purple-accent'
                            : 'border-slate-300 hover:border-slate-400',
                        )}
                      >
                        {selectedRows.size === filteredDocs.length && filteredDocs.length > 0 && (
                          <Check size={10} className="text-white" />
                        )}
                      </button>
                      <span className="text-[13px] font-semibold text-slate-700">
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
                  <tr key={doc.id} className={cn('group hover:bg-slate-50/60 transition-colors', selectedRows.has(doc.id) && 'bg-purple-tint/20')}>
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

      {/* ── Library Chat Drawer ───────────────────────────────────────────── */}
      <AnimatePresence>
        {chatOpen && (
          <LibraryChatDrawer
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            context={chatContext}
            onClearContext={() => setChatContext(null)}
          />
        )}
      </AnimatePresence>

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
            title={`Move ${selectedRows.size} paper${selectedRows.size === 1 ? '' : 's'} to Trash?`}
            message="They'll be hidden from your library but not deleted — restore them from Trash at any time."
            confirmLabel="Move to Trash"
            tone="reversible"
            onClose={() => setPendingBulkTrash(false)}
            onConfirm={async () => {
              await Promise.all(selectedDocs.map(d => trashDocument(d.id)))
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
