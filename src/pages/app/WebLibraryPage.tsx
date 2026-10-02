import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, FolderOpen, Folder, Trash2, Tag, Plus,
  Upload, Link, Copy, FileText, BookOpen, Bookmark, MessageCircle,
  ChevronDown, Download, X, Sparkles, ArrowUpDown,
  BookMarked, Check, FolderPlus, Info,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { UploadModal } from '../../components/ui/UploadModal'
import { LibraryChatDrawer } from '../../components/ui/LibraryChatDrawer'
import type { ChatContext } from '../../components/ui/LibraryChatDrawer'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { AddToCollectionModal } from '../../components/webLibrary/AddToCollectionModal'
import { CitePopover } from '../../components/webLibrary/CitePopover'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import { ImportSourcesModal } from '../../components/webLibrary/ImportSourcesModal'
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
  'Journal Article':  'bg-green-50 text-green-700 border border-green-200',
  'Book':             'bg-blue-50 text-blue-700 border border-blue-200',
  'Book Chapter':     'bg-blue-50 text-blue-600 border border-blue-200',
  'Conference Paper': 'bg-purple-50 text-purple-700 border border-purple-200',
  'Preprint':         'bg-amber-50 text-amber-700 border border-amber-200',
  'Report':           'bg-slate-50 text-slate-600 border border-slate-200',
  'Thesis':           'bg-rose-50 text-rose-700 border border-rose-200',
}

const SORT_OPTIONS = [
  { label: 'Date Added',    value: 'date-added'   },
  { label: 'Title A–Z',    value: 'title-asc'    },
  { label: 'Title Z–A',    value: 'title-desc'   },
  { label: 'Year',         value: 'year'         },
]

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
}: {
  collapsed:         boolean
  onCollapse:        () => void
  folders:           { id: string; name: string }[]
  activeLocation:    ActiveLocation
  onSelectLocation:  (loc: ActiveLocation) => void
  onCreateFolder:    (name: string) => void
  allCount:          number
  trashCount:        number
}) {
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderName, setFolderName]     = useState('')
  const [tagFilter, setTagFilter]       = useState('')

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
        <button onClick={onCollapse} className="text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onSelectLocation('all')} title="All files" className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', activeLocation === 'all' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-50')}>
          <FolderOpen size={16} />
        </button>
        <button onClick={() => onSelectLocation('trash')} title="Trash" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
          <Trash2 size={16} />
        </button>
        <div className="flex-1" />
        <button onClick={() => { onCollapse(); setAddingFolder(true) }} title="New Folder" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-orange-500 transition-colors mb-3">
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
          <p className="text-[14px] font-semibold text-slate-800">Web Library</p>
          <p className="text-[11px] text-slate-400">{allCount} item{allCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onCollapse} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">

        {/* Private Library */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 mb-1.5">Private Library</p>
          <div className="space-y-0.5">
            {/* All files */}
            <div>
              <NAV_ITEM icon={FolderOpen} label="All files" loc="all" count={allCount} />
              {activeLocation === 'all' && folders.length === 0 && (
                <p className="text-[11px] text-slate-400 px-8 py-1 leading-relaxed">
                  No folders yet. Create one to organize your documents.
                </p>
              )}
              {/* Custom folders */}
              {folders.map(f => (
                <div key={f.id} className="ml-4">
                  <NAV_ITEM icon={Folder} label={f.name} loc={f.id} />
                </div>
              ))}
            </div>
            <NAV_ITEM icon={BookMarked} label="My Publications" loc="publications" />
            <NAV_ITEM icon={Trash2}     label="Trash"           loc="trash" count={trashCount || undefined} />
          </div>
        </div>

        {/* Group Library */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 mb-1.5">Group Library</p>
          <div className="px-2 py-2 space-y-1.5">
            <p className="text-[12px] text-slate-400">No public group libraries.</p>
            <button onClick={() => toast('Create public group library — coming soon')}
              className="text-[12px] text-orange-500 hover:text-orange-600 transition-colors">
              Create public group library
            </button>
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-1 px-2 mb-1.5">
            <Tag size={11} className="text-slate-400" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Tags</p>
          </div>
          <p className="text-[11px] text-slate-400 px-2 py-1">No matching tags.</p>
          <div className="px-2 mt-2">
            <input
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              placeholder="Filter Tags"
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-700 placeholder-slate-400 outline-none focus:border-orange-300 transition-colors"
            />
          </div>
        </div>
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
              className="flex-1 border border-orange-400 rounded-lg px-2.5 py-1.5 text-[12px] outline-none text-slate-700"
            />
            <button onClick={handleCreateFolder} className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white">
              <Check size={13} />
            </button>
            <button onClick={() => setAddingFolder(false)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingFolder(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 hover:text-orange-500 transition-colors"
          >
            <Plus size={14} /> New Folder
          </button>
        )}
      </div>
    </div>
  )
}

// ── Cell: Papers column ────────────────────────────────────────────────────────

function PapersCell({
  doc, index, selected, onToggle, onSummaryClick, onChatClick, onCollectionClick, onDetails,
}: {
  doc: ResearchDocument
  index: number
  selected: boolean
  onToggle: () => void
  onSummaryClick: () => void
  onChatClick: () => void
  onCollectionClick: () => void
  onDetails?: () => void
}) {
  const handleDownload = () => {
    if (!doc.filePath) { toast('No file attached to this record'); return }
    const a = document.createElement('a')
    a.href = doc.filePath
    a.download = `${doc.title}.pdf`
    a.click()
  }

  return (
    <td className="align-top p-0 border-b border-slate-100">
      <div className="flex gap-2.5 p-3 min-h-[120px]">
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          className={cn(
            'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
            selected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 hover:border-slate-400',
          )}
        >
          {selected && <Check size={10} className="text-white" />}
        </button>

        {/* Document info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Type badge + Full indicator */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('inline-block text-[10px] font-medium px-1.5 py-0.5 rounded', DOC_TYPE_COLORS[doc.docType] ?? 'bg-slate-50 text-slate-600')}>
              {doc.docType}
            </span>
            {doc.isFullText && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white">Full</span>
            )}
          </div>

          {/* Title */}
          <p className="text-[13px] font-semibold text-orange-500 hover:text-orange-600 cursor-pointer leading-snug line-clamp-2">
            {index + 1}. {doc.title}
          </p>

          {/* Author */}
          {doc.authors.length > 0 && (
            <p className="text-[12px] text-slate-500">{doc.authors.join(', ')}</p>
          )}

          {/* ── 3-Icon Micro-Action Toolbar ── */}
          <div className="flex items-center gap-1.5 mt-2">
            {/* Icon 1: Download PDF */}
            <button
              onClick={handleDownload}
              title="Download PDF"
              className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors shadow-sm shadow-emerald-200"
            >
              <Download size={13} />
            </button>

            {/* Icon 2: PDF Summary — scrolls & highlights first content column */}
            <button
              onClick={onSummaryClick}
              title="View Summary"
              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 flex items-center justify-center transition-colors"
            >
              <FileText size={13} />
            </button>

            {/* Icon 3: Chat with document */}
            <button
              onClick={onChatClick}
              title="Chat with this document"
              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 flex items-center justify-center transition-colors"
            >
              <MessageCircle size={13} />
            </button>

            {/* Icon 4: Add to collection */}
            <button
              onClick={onCollectionClick}
              title="Add to collection"
              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-purple-tint hover:text-purple-accent hover:border-purple-accent flex items-center justify-center transition-colors"
            >
              <FolderPlus size={13} />
            </button>

            {/* Cite */}
            <CitePopover paper={doc} />
            {onDetails && <button onClick={onDetails} title="Paper details" className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-violet-50 hover:text-violet-700 flex items-center justify-center transition-colors"><Info size={13} /></button>}
          </div>
        </div>
      </div>
    </td>
  )
}

// ── Cell: AI-generated content column ─────────────────────────────────────────

function ContentCell({
  text, docId, colKey, expanded, onToggle, highlighted,
}: {
  text?: string
  docId: string
  colKey: string
  expanded: boolean
  onToggle: () => void
  highlighted: boolean
}) {
  const PREVIEW_LEN = 320
  const tdRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (highlighted && tdRef.current) {
      tdRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [highlighted])

  const baseClass = 'align-top border-b border-slate-100 border-l border-slate-100 w-[340px] max-w-[340px] transition-all duration-300'
  const highlightClass = highlighted ? 'ring-2 ring-inset ring-orange-400 bg-orange-50/40' : ''

  if (!text) {
    return (
      <td
        ref={tdRef}
        data-doc-id={docId}
        data-col={colKey}
        className={cn(baseClass, highlightClass)}
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
      ref={tdRef}
      data-doc-id={docId}
      data-col={colKey}
      className={cn(baseClass, highlightClass)}
    >
      <div className="p-3 min-h-[120px] flex flex-col gap-2">
        <p className="text-[13px] text-slate-700 leading-relaxed">
          {truncated ? text.slice(0, PREVIEW_LEN) + '…' : text}
        </p>
        {text.length > PREVIEW_LEN && (
          <button onClick={onToggle} className="text-[12px] text-sky-500 hover:text-sky-600 self-start font-medium transition-colors">
            {expanded ? 'Show less' : 'View More'}
          </button>
        )}
        <button
          onClick={() => toast('Saved to notebook')}
          className="mt-auto flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors self-start"
        >
          <Bookmark size={12} /> Save to Notebook
        </button>
      </div>
    </td>
  )
}

// ── Add Column Flyout ──────────────────────────────────────────────────────────

function AddColumnFlyout({
  visible,
  visibleColumns,
  onAdd,
  onClose,
}: {
  visible:        boolean
  visibleColumns: ColumnKey[]
  onAdd:          (key: ColumnKey) => void
  onClose:        () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const available = ORDERED_COLUMNS.filter(k => !visibleColumns.includes(k))
  const preview   = showAll ? available : available.slice(0, 6)
  const extra     = available.length - 6

  if (!visible) return null

  return (
    <th className="align-top border-b border-l border-slate-200 bg-white w-[260px] min-w-[260px]">
      <div className="sticky top-0 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Add Column</p>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <X size={13} />
          </button>
        </div>
        <button
          onClick={() => toast('Custom column — define key + label')}
          className="w-full flex items-center justify-center gap-2 border-2 border-orange-400 text-orange-500 rounded-xl py-2 text-[13px] font-medium hover:bg-orange-50 transition-colors mb-3"
        >
          <Plus size={14} /> New Column
        </button>
        <div className="space-y-0.5">
          {preview.map(key => (
            <button
              key={key}
              onClick={() => onAdd(key)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Plus size={13} className="text-slate-400 shrink-0" />
              {COLUMN_META[key].label}
            </button>
          ))}
          {!showAll && extra > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-[12px] text-slate-400 hover:text-slate-600 py-1.5 flex items-center gap-1"
            >
              +{extra} more <ChevronDown size={12} />
            </button>
          )}
          {available.length === 0 && (
            <p className="text-[12px] text-slate-400 text-center py-2">All columns are visible</p>
          )}
        </div>
      </div>
    </th>
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
    <th className="text-left px-3 py-2.5 border-b border-l border-slate-200 bg-slate-50/80 w-[340px] min-w-[340px]">
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev} disabled={!hasPrev}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 disabled:opacity-20 transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="flex-1 text-[13px] font-semibold text-slate-700">{label}</span>
        <button onClick={onRemove} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
          <X size={13} />
        </button>
        <button
          onClick={onNext} disabled={!hasNext}
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
        <span>Sort by: <span className="font-medium text-slate-800">{label}</span></span>
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
                  className={cn('w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors', sortBy === o.value ? 'text-orange-500 font-medium bg-orange-50' : 'text-slate-600 hover:bg-slate-50')}>
                  {sortBy === o.value && <Check size={12} className="text-orange-500" />}
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
  const [params, setParams] = useSearchParams()
  const {
    documents, folders, collections, visibleColumns,
    loadDocuments, loadCollections,
    createFolder, addColumn, removeColumn, reorderColumns,
  } = useWebLibraryStore()

  const [activeLocation,  setActiveLocation]  = useState<ActiveLocation>('all')
  const [libCollapsed,    setLibCollapsed]    = useState(false)
  const [viewMode,        setViewMode]        = useState<'library' | 'reference'>('library')
  const [sortBy,          setSortBy]          = useState('date-added')
  const [selectedRows,    setSelectedRows]    = useState<Set<string>>(new Set())
  const [expandedCells,   setExpandedCells]   = useState<Set<string>>(new Set())  // `${docId}-${colKey}`
  const [addColOpen,      setAddColOpen]      = useState(false)
  const [uploadOpen,      setUploadOpen]      = useState(false)
  const [importSourcesOpen, setImportSourcesOpen] = useState(false)
  const [addColDropdown,  setAddColDropdown]  = useState(false)
  // Chat drawer state
  const [chatOpen,        setChatOpen]        = useState(false)
  const [chatContext,     setChatContext]     = useState<ChatContext | null>(null)
  // Summary highlight: `${docId}` — cleared after 2s
  const [highlightedDoc,  setHighlightedDoc]  = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [collectionModalDocId, setCollectionModalDocId] = useState<string | null>(null)

  useEffect(() => {
    void loadDocuments()
    void loadCollections()
  }, [loadDocuments, loadCollections])

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

  // Filter by location
  const filteredDocs = useMemo(() => {
    let docs = [...documents]
    if (activeLocation === 'all')          docs = docs.filter(d => d.folderId !== '__trash__')
    else if (activeLocation === 'trash')   docs = docs.filter(d => d.folderId === '__trash__')
    else if (activeLocation === 'publications') docs = docs.filter(d => d.folderId !== '__trash__')
    else                                   docs = docs.filter(d => d.folderId === activeLocation)

    if (sortBy === 'title-asc')  docs.sort((a, b) => a.title.localeCompare(b.title))
    if (sortBy === 'title-desc') docs.sort((a, b) => b.title.localeCompare(a.title))
    if (sortBy === 'year')       docs.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    if (sortBy === 'date-added') docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return docs
  }, [documents, activeLocation, sortBy])

  const trashCount = documents.filter(d => d.folderId === '__trash__').length
  const allCount   = documents.filter(d => d.folderId !== '__trash__').length

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

  const handleSummaryClick = useCallback((docId: string) => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setHighlightedDoc(docId)
    // Scroll the first visible content column cell into view
    requestAnimationFrame(() => {
      const firstCol = visibleColumns[0]
      if (firstCol) {
        const el = document.querySelector<HTMLElement>(`[data-doc-id="${docId}"][data-col="${firstCol}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    })
    highlightTimer.current = setTimeout(() => setHighlightedDoc(null), 2000)
  }, [visibleColumns])

  const handleChatClick = useCallback((doc: ResearchDocument) => {
    setChatContext({ docId: doc.id, title: doc.title })
    setChatOpen(true)
  }, [])

  const handleUpload = (files: File[], folderId: string | null = null) => {
    files.forEach(file => {
      void useWebLibraryStore.getState().addDocument({
        title:    file.name.replace(/\.[^.]+$/, ''),
        docType:  'Journal Article',
        filePath: URL.createObjectURL(file),
        isFullText: true,
        folderId,
      })
    })
    toast.success(`${files.length} file${files.length !== 1 ? 's' : ''} uploaded`)
  }

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
      />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Insight strip ─────────────────────────────────────────────────── */}
        <div className="h-9 border-b border-slate-100 flex items-center px-5 gap-2 shrink-0 bg-slate-50/60">
          <Sparkles size={14} className="text-slate-400" />
          <span className="text-[13px] text-slate-400 italic">Get insights for questions from your files…</span>
        </div>

        {/* ── Top utility bar ────────────────────────────────────────────────── */}
        <div className="h-12 border-b border-slate-100 flex items-center px-5 gap-3 shrink-0">
          <h1 className="text-[15px] font-semibold text-slate-800 mr-1">My Library – All files</h1>

          {/* System Default dropdown */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:border-slate-300 transition-colors">
            System Default <ChevronDown size={12} />
          </button>

          {/* Quick action icons */}
          <div className="flex items-center gap-1">
            {[
              { icon: Link,     title: 'Copy link' },
              { icon: Copy,     title: 'Duplicate' },
              { icon: Download, title: 'Export' },
            ].map(({ icon: Icon, title }) => (
              <button key={title} title={title}
                onClick={() => toast(`${title} — coming soon`)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                <Icon size={15} />
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Import sources */}
          <button
            onClick={() => setImportSourcesOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium transition-colors shadow-sm shadow-orange-200"
          >
            <Upload size={14} /> Import Sources
          </button>
        </div>

        {/* ── View toggle ────────────────────────────────────────────────────── */}
        <div className="flex justify-center py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center bg-slate-100 rounded-full p-0.5">
            <button
              onClick={() => setViewMode('library')}
              className={cn(
                'px-5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200',
                viewMode === 'library'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Library View
            </button>
            <button
              onClick={() => setViewMode('reference')}
              className={cn(
                'px-5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200',
                viewMode === 'reference'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Reference Manager View
            </button>
          </div>
        </div>

        {/* ── Table controls ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 shrink-0">
          {/* Add columns dropdown */}
          <div className="relative">
            <button
              onClick={() => setAddColDropdown(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:border-slate-300 transition-colors"
            >
              Add columns ({ORDERED_COLUMNS.filter(k => !visibleColumns.includes(k)).length})
              <ChevronDown size={12} className={cn('text-slate-400 transition-transform', addColDropdown && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {addColDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddColDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 w-52 py-1 overflow-hidden"
                  >
                    {ORDERED_COLUMNS.filter(k => !visibleColumns.includes(k)).map(key => (
                      <button
                        key={key}
                        onClick={() => { addColumn(key); setAddColDropdown(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Plus size={13} className="text-slate-400" /> {COLUMN_META[key].label}
                      </button>
                    ))}
                    {ORDERED_COLUMNS.filter(k => !visibleColumns.includes(k)).length === 0 && (
                      <p className="text-[12px] text-slate-400 px-3 py-2">All columns added</p>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1" />

          <SortDropdown sortBy={sortBy} onSort={setSortBy} />

          {/* Export */}
          <button
            onClick={() => toast('Export — coming soon')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Download size={13} /> Export
          </button>
        </div>

        {/* ── Spreadsheet table ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse min-w-max">
            <thead className="sticky top-0 z-10">
              <tr>
                {/* Papers header */}
                <th className="text-left px-3 py-2.5 border-b border-slate-200 bg-slate-50/90 backdrop-blur-sm w-[420px] min-w-[380px]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleAllRows}
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        selectedRows.size === filteredDocs.length && filteredDocs.length > 0
                          ? 'border-orange-500 bg-orange-500'
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

                {/* Dynamic column headers */}
                {visibleColumns.map((key, idx) => (
                  <ColHeader
                    key={key}
                    colKey={key}
                    onRemove={() => removeColumn(key)}
                    hasPrev={idx > 0}
                    onPrev={() => moveColumnLeft(key)}
                    hasNext={idx < visibleColumns.length - 1}
                    onNext={() => moveColumnRight(key)}
                  />
                ))}

                {/* Add column flyout toggle */}
                <AddColumnFlyout
                  visible={addColOpen}
                  visibleColumns={visibleColumns}
                  onAdd={k => { addColumn(k); setAddColOpen(false) }}
                  onClose={() => setAddColOpen(false)}
                />

                {!addColOpen && (
                  <th className="border-b border-l border-slate-200 bg-slate-50/90">
                    <button
                      onClick={() => setAddColOpen(true)}
                      className="w-full h-full px-4 py-2.5 text-[12px] text-orange-500 hover:bg-orange-50 transition-colors font-medium flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus size={13} /> Add column
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                        <BookOpen size={24} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-slate-700 font-medium text-[14px]">No documents in this location</p>
                        <p className="text-slate-400 text-[13px] mt-1">Upload PDFs to start building your research library</p>
                      </div>
                      <button
                        onClick={() => setUploadOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium transition-colors"
                      >
                        <Upload size={14} /> Upload PDFs
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc, i) => (
                  <tr key={doc.id} className={cn('group hover:bg-slate-50/60 transition-colors', selectedRows.has(doc.id) && 'bg-orange-50/20')}>
                    {/* Papers cell */}
                    <PapersCell
                      doc={doc}
                      index={i}
                      selected={selectedRows.has(doc.id)}
                      onToggle={() => toggleRow(doc.id)}
                      onSummaryClick={() => handleSummaryClick(doc.id)}
                      onChatClick={() => handleChatClick(doc)}
                      onCollectionClick={() => setCollectionModalDocId(doc.id)}
                      onDetails={doc.canonicalWorkId ? () => { const next = new URLSearchParams(params); next.set('paper', doc.canonicalWorkId!); setParams(next, { replace: true }) } : undefined}
                    />

                    {/* Dynamic column cells */}
                    {visibleColumns.map(key => (
                      <ContentCell
                        key={key}
                        text={doc[key as keyof ResearchDocument] as string | undefined}
                        docId={doc.id}
                        colKey={key}
                        expanded={expandedCells.has(`${doc.id}-${key}`)}
                        onToggle={() => toggleCell(doc.id, key)}
                        highlighted={highlightedDoc === doc.id}
                      />
                    ))}

                    {/* Spacer for add-column area */}
                    {addColOpen ? null : <td className="border-b border-l border-slate-100 bg-slate-50/20" />}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* ── Upload Modal ─────────────────────────────────────────────────────── */}
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
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        onCreateFolder={createFolder}
      />

      {/* ── Chat FAB (shown when drawer is closed) ────────────────────────── */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            key="chat-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => { setChatContext(null); setChatOpen(true) }}
            className="fixed bottom-6 right-6 w-12 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white shadow-xl shadow-sky-200 flex items-center justify-center transition-colors z-40"
            title="Chat with your library"
          >
            <MessageCircle size={20} />
          </motion.button>
        )}
      </AnimatePresence>

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

      {/* ── Add to Collection ─────────────────────────────────────────────── */}
      <AddToCollectionModal
        open={collectionModalDocId !== null}
        documentId={collectionModalDocId}
        onClose={() => setCollectionModalDocId(null)}
      />
      <PaperDetailsDrawer workId={params.get('paper')} onClose={() => { const next = new URLSearchParams(params); next.delete('paper'); setParams(next, { replace: true }) }} onOpenPdf={(paper: PaperDetails) => navigate(`/app/web-library/papers/${paper.id}/pdf`)} />
    </div>
  )
}
