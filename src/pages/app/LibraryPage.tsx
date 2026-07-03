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
  doc,
  onRename,
  onDelete,
  onOpen,
}: {
  doc: WorkspaceDocument
  onRename: () => void
  onDelete: () => void
  onOpen:   () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-black/[0.05] transition-colors"
      >
        <MoreVertical size={14} />
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
          <p className="text-[13px] text-[#1a1a18] font-medium truncate leading-snug">{doc.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <DocTypeIcon type={doc.type} isPdf={doc.isPdf} />
            <span className="text-[11px] text-[#888]">{relativeDate(doc.updatedAt)}</span>
          </div>
        </div>
        <DocMenu doc={doc} onOpen={onOpen} onRename={onRename} onDelete={onDelete} />
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
      className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.04] cursor-pointer group transition-colors border border-transparent hover:border-white/[0.06]"
    >
      <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
        <DocTypeIcon type={doc.type} isPdf={doc.isPdf} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white font-medium truncate">{doc.title}</p>
        <p className="text-[11px] text-slate-500">Modified {relativeDate(doc.updatedAt)}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DocMenu doc={doc} onOpen={onOpen} onRename={onRename} onDelete={onDelete} />
      </div>
    </motion.div>
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
        className="relative bg-[#0d1526] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h3 className="text-white font-semibold mb-4">Rename document</h3>
        <input
          autoFocus value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel() }}
          className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500/50 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={() => onSave(val)} className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium transition-colors">
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
  const [viewMode,    setViewMode]    = useState<DocViewMode>('grid')
  const [uploadOpen,  setUploadOpen]  = useState(false)
  const [renameDoc,   setRenameDoc]   = useState<WorkspaceDocument | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return documents.filter(d =>
      (q ? d.title.toLowerCase().includes(q) : true)
    )
  }, [documents, search])

  const handleNewDocument = () => {
    const doc = createDocument({ title: 'Untitled document' })
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
      createDocument({
        title:    file.name.replace(/\.[^.]+$/, ''),
        type:     ext as any,
        isPdf,
        folderId,
        filePath: URL.createObjectURL(file),
      })
    })
  }

  const handleRename = (doc: WorkspaceDocument, title: string) => {
    updateDocument(doc.id, { title })
    setRenameDoc(null)
  }

  const FILTER_TABS: { label: string; value: DocOwnership }[] = [
    { label: 'All',         value: 'all' },
    { label: 'Owned by me', value: 'mine' },
    { label: 'Shared',      value: 'shared' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-white/[0.05] flex items-center px-6 gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <FolderOpen size={18} className="text-amber-400" />
          <h1 className="text-white font-semibold text-[15px]">My Library</h1>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative ml-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-[13px] text-white placeholder-slate-500 outline-none focus:border-white/[0.15] transition-colors"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/[0.08] text-slate-300 hover:text-white hover:border-white/[0.15] text-[13px] transition-all"
          >
            <Upload size={14} /> Upload
          </button>
          <button
            onClick={handleNewDocument}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium transition-colors shadow-lg shadow-orange-900/30"
          >
            <Plus size={14} /> New document
          </button>
        </div>
      </div>

      {/* ── "Start a new doc" banner ─────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/[0.04] shrink-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Start a new document</p>
        <div className="flex items-center gap-3">
          {/* Blank doc template */}
          <button
            onClick={handleNewDocument}
            className="group w-28 flex flex-col items-center gap-2"
          >
            <div className="w-28 h-36 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:border-white/[0.2] group-hover:bg-white/[0.07] transition-all flex items-center justify-center">
              <div className="w-14 h-20 bg-white/90 rounded shadow-md flex flex-col p-2 gap-1">
                <div className="h-0.5 bg-slate-200 rounded w-full" />
                <div className="h-0.5 bg-slate-200 rounded w-4/5" />
                <div className="h-0.5 bg-slate-200 rounded w-full" />
                <div className="h-0.5 bg-slate-200 rounded w-2/3" />
              </div>
            </div>
            <span className="text-[12px] text-slate-400 group-hover:text-slate-200 transition-colors">Blank document</span>
          </button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-white/[0.04] shrink-0">
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

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setViewMode('grid')}
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', viewMode === 'grid' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
            <Grid3x3 size={15} />
          </button>
          <button onClick={() => setViewMode('list')}
            className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', viewMode === 'list' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
            <List size={15} />
          </button>
        </div>
      </div>

      {/* ── Document area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <FilePlus size={28} className="text-slate-600" />
            </div>
            <div>
              <p className="text-white font-medium text-[15px]">No documents yet</p>
              <p className="text-slate-500 text-[13px] mt-1">Create a blank document or upload existing files</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleNewDocument} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium transition-colors">
                <Plus size={14} /> New document
              </button>
              <button onClick={() => setUploadOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.1] text-slate-300 hover:text-white hover:border-white/[0.2] text-[13px] transition-all">
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
    </div>
  )
}
