import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus, Upload, Search, Grid3x3, List, FileText, File, MoreVertical,
  FolderOpen, Clock, Trash2, Edit3, FolderInput, FilePlus,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { UploadModal } from '../../components/ui/UploadModal'
import type { WorkspaceDocument, DocOwnership, DocViewMode } from '../../types/library'

type SortBy = 'modified' | 'alpha' | 'created'

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function extractPreviewText(content?: string): string {
  if (!content) return ''
  try {
    const json = JSON.parse(content)
    const parts: string[] = []
    const walk = (node: any) => {
      if (!node) return
      if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text)
      if (Array.isArray(node.content)) node.content.forEach(walk)
    }
    walk(json)
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  } catch {
    return content.replace(/\s+/g, ' ').trim()
  }
}

function countWords(text: string): number {
  return text ? text.split(' ').filter(Boolean).length : 0
}

function DocTypeIcon({ type, isPdf }: { type: string; isPdf: boolean }) {
  if (isPdf || type === 'pdf')
    return <div className="text-[10px] font-bold text-red-700 bg-red-100 rounded px-1">PDF</div>
  if (type === 'docx' || type === 'doc')
    return <div className="text-[10px] font-bold text-[#1e40af] bg-[#dbeafe] rounded px-1">DOC</div>
  if (type === 'md')
    return <div className="text-[10px] font-bold text-purple-700 bg-purple-100 rounded px-1">MD</div>
  return <FileText size={14} className="text-slate-400" />
}

// ── Context menu ───────────────────────────────────────────────────────────────

function DocMenu({
  onRename,
  onDelete,
  onOpen,
}: {
  onRename: () => void
  onDelete: () => void
  onOpen:   () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-black/[0.08] transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-full mt-1 w-44 bg-[#0d1526] border border-white/[0.08] rounded-xl shadow-2xl z-20 overflow-hidden py-1"
            >
              {[
                { icon: FolderInput, label: 'Open',   action: () => { setOpen(false); onOpen() } },
                { icon: Edit3,       label: 'Rename', action: () => { setOpen(false); onRename() } },
                { icon: Trash2,      label: 'Delete', action: () => { setOpen(false); onDelete() }, danger: true },
              ].map(({ icon: Icon, label, action, danger }) => (
                <button
                  key={label} onClick={action}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors',
                    danger ? 'text-red-400 hover:text-red-300 hover:bg-red-500/[0.08]' : 'text-slate-300 hover:text-white hover:bg-white/[0.05]',
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Document card (grid) ───────────────────────────────────────────────────────

function DocCard({
  doc, onOpen, onRename, onDelete,
}: {
  doc: WorkspaceDocument
  onOpen:   () => void
  onRename: () => void
  onDelete: () => void
}) {
  const preview = extractPreviewText(doc.content)
  const words   = countWords(preview)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onOpen}
      className="group relative bg-white border border-[#e0e0da] rounded-xl p-4 cursor-pointer hover:border-[#d1d5db] transition-all duration-150"
    >
      {/* Preview area */}
      <div className="aspect-[3/4] rounded-lg bg-[#f5f5f3] border border-[#e0e0da] mb-3 flex items-center justify-center overflow-hidden">
        {doc.isPdf || doc.type === 'pdf' ? (
          <File size={32} className="text-red-300" />
        ) : preview ? (
          <p className="w-full h-full p-3 text-[11px] leading-relaxed text-[#666] overflow-hidden">
            {preview.length > 220 ? `${preview.slice(0, 220).trimEnd()}…` : preview}
          </p>
        ) : (
          <div className="w-full h-full p-3 space-y-1.5">
            <div className="h-1.5 bg-[#d1d5db] rounded w-3/4" />
            <div className="h-1.5 bg-[#d1d5db] rounded w-full" />
            <div className="h-1.5 bg-[#d1d5db] rounded w-5/6" />
            <div className="h-1.5 bg-[#d1d5db] rounded w-full" />
            <div className="h-1.5 bg-[#d1d5db] rounded w-2/3" />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p title={doc.title} className="text-[13px] text-[#1a1a18] font-medium truncate leading-snug">{doc.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <DocTypeIcon type={doc.type} isPdf={doc.isPdf} />
            <span className="text-[11px] text-[#888]">{relativeDate(doc.updatedAt)}</span>
            {words > 0 && (
              <>
                <span className="text-[11px] text-[#ccc]">·</span>
                <span className="text-[11px] text-[#888]">{words.toLocaleString()} words</span>
              </>
            )}
          </div>
        </div>
        <DocMenu onOpen={onOpen} onRename={onRename} onDelete={onDelete} />
      </div>
    </motion.div>
  )
}

// ── Document row (list) ────────────────────────────────────────────────────────

function DocRow({
  doc, onOpen, onRename, onDelete,
}: {
  doc: WorkspaceDocument
  onOpen:   () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onOpen}
      className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-black/[0.03] cursor-pointer group transition-colors border border-transparent hover:border-[#e0e0da]"
    >
      <div className="w-8 h-8 rounded-lg bg-[#f5f5f3] border border-[#e0e0da] flex items-center justify-center shrink-0">
        <DocTypeIcon type={doc.type} isPdf={doc.isPdf} />
      </div>
      <div className="flex-1 min-w-0">
        <p title={doc.title} className="text-[13px] text-[#1a1a18] font-medium truncate">{doc.title}</p>
        <p className="text-[11px] text-[#888]">Modified {relativeDate(doc.updatedAt)}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DocMenu onOpen={onOpen} onRename={onRename} onDelete={onDelete} />
      </div>
    </motion.div>
  )
}

// ── New document dialog ─────────────────────────────────────────────────────────

function NewDocDialog({ onCreate, onCancel }: { onCreate: (title: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState('Untitled document')
  const commit = () => onCreate(val.trim() || 'Untitled document')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white border border-[#e0e0da] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h3 className="flex items-center gap-2 text-[#1a1a18] font-semibold mb-4">
          <FilePlus size={16} className="text-[#7c3aed]" /> Name your document
        </h3>
        <input
          autoFocus value={val} onChange={e => setVal(e.target.value)}
          onFocus={e => e.target.select()}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
          className="w-full bg-neutral-100 border-0 rounded-lg px-3.5 py-2.5 text-[#1a1a18] text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/20 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-[13px] font-medium transition-colors">Cancel</button>
          <button onClick={commit} className="px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors">
            Create
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Rename dialog ──────────────────────────────────────────────────────────────

function RenameDialog({ doc, onSave, onCancel }: { doc: WorkspaceDocument; onSave: (t: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(doc.title)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white border border-[#e0e0da] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h3 className="flex items-center gap-2 text-[#1a1a18] font-semibold mb-4">
          <Edit3 size={16} className="text-[#7c3aed]" /> Rename document
        </h3>
        <input
          autoFocus value={val} onChange={e => setVal(e.target.value)}
          onFocus={e => e.target.select()}
          onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel() }}
          className="w-full bg-neutral-100 border-0 rounded-lg px-3.5 py-2.5 text-[#1a1a18] text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/20 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-[13px] font-medium transition-colors">Cancel</button>
          <button onClick={() => onSave(val)} className="px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors">
            Rename
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const navigate  = useNavigate()
  const { documents, folders, createDocument, updateDocument, deleteDocument, createFolder } = useLibraryStore()

  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<DocOwnership>('all')
  const [sortBy,      setSortBy]      = useState<SortBy>('modified')
  const [viewMode,    setViewMode]    = useState<DocViewMode>('list')
  const [uploadOpen,  setUploadOpen]  = useState(false)
  const [renameDoc,   setRenameDoc]   = useState<WorkspaceDocument | null>(null)
  const [namingNew,   setNamingNew]   = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    // There's no sharing feature yet, so every document is "owned by me" and
    // nothing is ever "shared" — reflect that instead of ignoring the tabs.
    let list = documents.filter(d => (q ? d.title.toLowerCase().includes(q) : true))
    if (filter === 'shared') list = []

    const sorted = [...list]
    if (sortBy === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortBy === 'created') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else {
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    return sorted
  }, [documents, search, filter, sortBy])

  const mostRecentDoc = useMemo(() => {
    if (documents.length === 0) return null
    return [...documents].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  }, [documents])

  const handleCreateNamed = async (title: string) => {
    const doc = await createDocument({ title })
    setNamingNew(false)
    navigate(`/app/editor/${doc.id}`)
  }

  const handleOpenDoc = (doc: WorkspaceDocument) => {
    if (doc.isPdf || doc.type === 'pdf') {
      navigate('/app/document-chat')
    } else {
      navigate(`/app/editor/${doc.id}`)
    }
  }

  const handleUpload = (files: File[], folderId: string | null) => {
    files.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt'
      const isPdf = ext === 'pdf'
      void createDocument({
        title:    file.name.replace(/\.[^.]+$/, ''),
        type:     ext as any,
        isPdf,
        folderId,
        filePath: URL.createObjectURL(file),
      })
    })
  }

  const handleRename = (doc: WorkspaceDocument, title: string) => {
    void updateDocument(doc.id, { title })
    setRenameDoc(null)
  }

  const FILTER_TABS: { label: string; value: DocOwnership }[] = [
    { label: 'All',         value: 'all' },
    { label: 'Owned by me', value: 'mine' },
    { label: 'Shared',      value: 'shared' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-[#e0e0da] flex items-center px-6 gap-4 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <FolderOpen size={18} className="text-amber-500" />
          <h1 className="text-[#1a1a18] font-semibold text-[15px]">My Library</h1>
        </div>

        {/* Search — primary way to find a doc among many similarly-named drafts */}
        <div className="flex-1 max-w-md relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full h-10 bg-white border border-[#e0e0da] rounded-xl pl-10 pr-4 text-sm text-[#1a1a18] placeholder-[#999] outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#ede9fe] transition-colors"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#e0e0da] text-[#555] hover:text-[#1a1a18] hover:border-[#d1d5db] text-[13px] transition-all"
          >
            <Upload size={14} /> Upload
          </button>
        </div>
      </div>

      {/* ── Start new / resume — one row, so returning users aren't pushed past a big empty block ── */}
      <div className="px-6 py-3 border-b border-[#e0e0da] shrink-0 flex items-center gap-3">
        <button
          onClick={() => setNamingNew(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors shadow-lg shadow-purple-900/20 shrink-0"
        >
          <Plus size={14} /> Blank document
        </button>

        {mostRecentDoc && (
          <button
            onClick={() => handleOpenDoc(mostRecentDoc)}
            className="flex-1 min-w-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#e0e0da] hover:border-[#d1d5db] hover:bg-black/[0.02] transition-all text-left"
          >
            <Clock size={14} className="text-[#888] shrink-0" />
            <span className="text-[11px] text-[#555] uppercase tracking-wide shrink-0">Continue where you left off</span>
            <span title={mostRecentDoc.title} className="text-[13px] text-[#1a1a18] font-medium truncate">{mostRecentDoc.title}</span>
            <span className="text-[11px] text-[#888] ml-auto shrink-0">{relativeDate(mostRecentDoc.updatedAt)}</span>
          </button>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-[#e0e0da] shrink-0">
        <div className="inline-flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
          {FILTER_TABS.map(t => (
            <button
              key={t.value} onClick={() => setFilter(t.value)}
              className={cn(
                'h-7 px-3.5 rounded-md text-[12px] transition-all',
                filter === t.value
                  ? 'bg-white text-[#1a1a18] font-medium shadow-sm'
                  : 'text-[#888] hover:text-[#1a1a18] font-normal',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          className="h-7 pl-2.5 pr-1.5 rounded-md text-[12px] bg-white border border-[#e0e0da] text-[#555] outline-none"
        >
          <option value="modified">Last modified</option>
          <option value="alpha">Alphabetical</option>
          <option value="created">Date created</option>
        </select>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setViewMode('grid')}
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', viewMode === 'grid' ? 'bg-[#f1f5f9] text-[#1a1a18]' : 'text-[#999] hover:text-[#1a1a18]')}>
            <Grid3x3 size={15} />
          </button>
          <button onClick={() => setViewMode('list')}
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', viewMode === 'list' ? 'bg-[#f1f5f9] text-[#1a1a18]' : 'text-[#999] hover:text-[#1a1a18]')}>
            <List size={15} />
          </button>
        </div>
      </div>

      {/* ── Document area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#f5f5f3] border border-[#e0e0da] flex items-center justify-center">
              <FilePlus size={28} className="text-[#999]" />
            </div>
            <div>
              <p className="text-[#1a1a18] font-medium text-[15px]">No documents yet</p>
              <p className="text-[#888] text-[13px] mt-1">Create a blank document or upload existing files</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNamingNew(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors">
                <Plus size={14} /> New document
              </button>
              <button onClick={() => setUploadOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e0e0da] text-[#555] hover:text-[#1a1a18] hover:border-[#d1d5db] text-[13px] transition-all">
                <Upload size={14} /> Upload files
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence>
              {filtered.map(doc => (
                <DocCard
                  key={doc.id} doc={doc}
                  onOpen={() => handleOpenDoc(doc)}
                  onRename={() => setRenameDoc(doc)}
                  onDelete={() => deleteDocument(doc.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            <AnimatePresence>
              {filtered.map(doc => (
                <DocRow
                  key={doc.id} doc={doc}
                  onOpen={() => handleOpenDoc(doc)}
                  onRename={() => setRenameDoc(doc)}
                  onDelete={() => deleteDocument(doc.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Upload Modal ─────────────────────────────────────────────────────── */}
      <UploadModal
        open={uploadOpen}
        folders={folders}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        onCreateFolder={createFolder}
      />

      {/* ── Rename dialog ────────────────────────────────────────────────────── */}
      {renameDoc && (
        <RenameDialog
          doc={renameDoc}
          onSave={title => handleRename(renameDoc, title)}
          onCancel={() => setRenameDoc(null)}
        />
      )}

      {/* ── New document dialog ──────────────────────────────────────────────── */}
      {namingNew && (
        <NewDocDialog
          onCreate={handleCreateNamed}
          onCancel={() => setNamingNew(false)}
        />
      )}
    </div>
  )
}
