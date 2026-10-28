import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Plus, Upload, Search, Grid3x3, List, FileText, File, MoreVertical,
  FolderOpen, Clock, Trash2, Edit3, FolderInput, FilePlus, Copy, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { UploadModal } from '../../components/ui/UploadModal'
import { CreationCard } from '../../components/app/CreationCard'
import { importDocumentFromFile } from '../../lib/importWordDocument'
import type { WorkspaceDocument, DocOwnership, DocViewMode } from '../../types/library'
import { isEmptyDraftDocument } from '../../types/library'

type SortBy = 'modified' | 'alpha' | 'created'

// Rendering every document at once made the page heavy once a library grows past a few dozen.
const PAGE_SIZE = 50

// Sharing isn't built yet, so "Owned by me" would only repeat "All" and "Shared" would always be
// empty — controls that can never do anything. Hidden until sharing ships: set this to true then
// (and replace the `filter === 'shared'` stub in `filtered` with the real shared-with-me list).
const SHARING_ENABLED = false

// ── Helpers ────────────────────────────────────────────────────────────────────

// Always spells the month out ("23 Sep 2026") so the date reads the same for a day/month or a
// month/day locale — "9/23/2026" was ambiguous (and US-style) for most of our users.
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  return formatDate(iso)
}

// Titles are often generated from a pasted prompt, so some arrive with a stray leading ":" or
// "-" (or extra spaces). Clean them for display and sorting only — the stored title is untouched.
function displayTitle(doc: WorkspaceDocument): string {
  const cleaned = (doc.title ?? '').replace(/^[\s:;,.\-–—]+/, '').replace(/\s+/g, ' ').trim()
  return cleaned || 'Untitled document'
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

// Generated documents usually start with their own title, so the preview/snippet would just repeat
// it. Drop that leading copy (also when the stored title was clipped with a trailing "…").
function stripLeadingTitle(preview: string, title: string): string {
  const p = preview.trimStart()
  const stem = title.replace(/…$/, '').trim()
  if (stem && p.toLowerCase().startsWith(stem.toLowerCase())) return p.slice(stem.length).trimStart()
  return p
}

// A short excerpt: around the first match when the search hit the body, otherwise the opening text.
function snippetFor(preview: string, query: string, max = 120): string {
  if (!preview) return ''
  const q = query.trim().toLowerCase()
  if (q) {
    const idx = preview.toLowerCase().indexOf(q)
    if (idx > 40) {
      const start = idx - 30
      return `…${preview.slice(start, start + max).trim()}${start + max < preview.length ? '…' : ''}`
    }
  }
  return preview.length > max ? `${preview.slice(0, max).trimEnd()}…` : preview
}

function activateOnKey(e: ReactKeyboardEvent<HTMLElement>, action: () => void) {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action() }
}

interface DocInfo { preview: string; words: number }

const GENRE_LABEL: Record<string, string> = {
  Essay: 'Essay',
  LiteratureReview: 'Lit review',
  ResearchPaper: 'Paper',
  ThesisChapter: 'Thesis',
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const lower = text.toLowerCase()
  const ql = q.toLowerCase()
  const parts: ReactNode[] = []
  let i = 0
  for (;;) {
    const idx = lower.indexOf(ql, i)
    if (idx === -1) break
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark key={idx} className="bg-[#ede9fe] text-[#4c1d95] rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>,
    )
    i = idx + q.length
  }
  parts.push(text.slice(i))
  return <>{parts}</>
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

interface MenuItem { icon: LucideIcon; label: string; action: () => void; danger?: boolean }

function DocMenu({
  title,
  canDuplicate,
  onRename,
  onDelete,
  onOpen,
  onDuplicate,
}: {
  title:        string
  canDuplicate: boolean
  onRename:     () => void
  onDelete:     () => void
  onOpen:       () => void
  onDuplicate:  () => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs   = useRef<(HTMLButtonElement | null)[]>([])

  const items: MenuItem[] = [
    { icon: FolderInput, label: 'Open',   action: onOpen },
    { icon: Edit3,       label: 'Rename', action: onRename },
    ...(canDuplicate ? [{ icon: Copy, label: 'Duplicate', action: onDuplicate }] : []),
    { icon: Trash2,      label: 'Delete', action: onDelete, danger: true },
  ]

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  // Move focus into the menu when it opens (mouse or keyboard) and let Escape close it from
  // anywhere — the menu used to ignore Escape unless focus had already been moved inside it.
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => itemRefs.current[0]?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close() }
    }
    document.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey) }
  }, [open, close])

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown')    { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
    else if (e.key === 'Home')    { e.preventDefault(); els[0]?.focus() }
    else if (e.key === 'End')     { e.preventDefault(); els[els.length - 1]?.focus() }
    else if (e.key === 'Tab')     { setOpen(false) }
  }

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`More actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-black/[0.08] transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              role="menu"
              aria-label={`Actions for ${title}`}
              onKeyDown={onMenuKeyDown}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e0e0da] rounded-xl shadow-lg z-20 overflow-hidden py-1"
            >
              {items.map(({ icon: Icon, label, action, danger }, i) => (
                <button
                  key={label}
                  ref={el => { itemRefs.current[i] = el }}
                  type="button"
                  role="menuitem"
                  onClick={() => { setOpen(false); action() }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 text-[13px] text-left transition-colors outline-none',
                    danger
                      ? 'mt-1 border-t border-[#e0e0da] text-red-600 hover:bg-red-50 focus-visible:bg-red-50'
                      : 'text-[#333] hover:bg-[#f5f5f3] focus-visible:bg-[#f5f5f3]',
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

interface DocItemProps {
  doc:          WorkspaceDocument
  info:         DocInfo
  query:        string
  onOpen:       () => void
  onRename:     () => void
  onDuplicate:  () => void
  onDelete:     () => void
}

const canDuplicateDoc = (doc: WorkspaceDocument) => !doc.isPdf && doc.type !== 'pdf' && !doc.filePath

function DocCard({ doc, info, query, onOpen, onRename, onDuplicate, onDelete }: DocItemProps) {
  const name    = displayTitle(doc)
  const snippet = snippetFor(stripLeadingTitle(info.preview, name), query, 220)
  const genre   = doc.documentType ? GENRE_LABEL[doc.documentType] : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      onClick={onOpen}
      onKeyDown={e => activateOnKey(e, onOpen)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${name}`}
      className="group relative bg-white border border-[#e0e0da] rounded-xl p-4 cursor-pointer hover:border-[#d1d5db] focus-visible:border-[#7c3aed] focus-visible:ring-2 focus-visible:ring-[#ede9fe] outline-none transition-all duration-150"
    >
      {/* Preview area */}
      <div className="aspect-[4/3] sm:aspect-[3/4] rounded-lg bg-[#f5f5f3] border border-[#e0e0da] mb-3 flex items-center justify-center overflow-hidden">
        {doc.isPdf || doc.type === 'pdf' ? (
          <File size={32} className="text-red-300" />
        ) : snippet ? (
          <p className="w-full h-full p-3 text-[11px] leading-relaxed text-[#666] overflow-hidden">
            <Highlight text={snippet} query={query} />
          </p>
        ) : (
          <span className="text-[11px] text-[#999]">Empty document</span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p title={name} className="text-[13px] text-[#1a1a18] font-medium line-clamp-2 break-words leading-snug">
            <Highlight text={name} query={query} />
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
            <DocTypeIcon type={doc.type} isPdf={doc.isPdf} />
            {genre && <span className="text-[11px] text-[#7c3aed]">{genre}</span>}
            <span className="text-[11px] text-[#888] whitespace-nowrap">{relativeDate(doc.updatedAt)}</span>
            {info.words > 0 && (
              <span className="text-[11px] text-[#888] whitespace-nowrap">· {info.words.toLocaleString()} words</span>
            )}
          </div>
        </div>
        <DocMenu
          title={name} canDuplicate={canDuplicateDoc(doc)}
          onOpen={onOpen} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete}
        />
      </div>
    </motion.div>
  )
}

// ── Document row (list) ────────────────────────────────────────────────────────

function DocRow({ doc, info, query, onOpen, onRename, onDuplicate, onDelete }: DocItemProps) {
  const name    = displayTitle(doc)
  const snippet = snippetFor(stripLeadingTitle(info.preview, name), query)
  const genre   = doc.documentType ? GENRE_LABEL[doc.documentType] : undefined

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      onClick={onOpen}
      onKeyDown={e => activateOnKey(e, onOpen)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${name}`}
      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl hover:bg-black/[0.03] cursor-pointer group transition-colors border border-transparent hover:border-[#e0e0da] focus-visible:border-[#7c3aed] focus-visible:ring-2 focus-visible:ring-[#ede9fe] outline-none"
    >
      <div className="w-8 h-8 rounded-lg bg-[#f5f5f3] border border-[#e0e0da] flex items-center justify-center shrink-0">
        <DocTypeIcon type={doc.type} isPdf={doc.isPdf} />
      </div>
      <div className="flex-1 min-w-0">
        <p title={name} className="text-[13px] text-[#1a1a18] font-medium line-clamp-2 sm:line-clamp-1 break-words">
          <Highlight text={name} query={query} />
        </p>
        <p className="text-[11px] text-[#888]">
          {genre && <span className="text-[#7c3aed]">{genre} · </span>}
          Modified {relativeDate(doc.updatedAt)}
          {info.words > 0 && <> · {info.words.toLocaleString()} words</>}
        </p>
        {snippet && (
          <p className="hidden sm:block text-[12px] text-[#999] truncate mt-0.5">
            <Highlight text={snippet} query={query} />
          </p>
        )}
      </div>
      {/* Always visible on touch / small screens (there is no hover there); on desktop it appears on
          hover or keyboard focus. */}
      <div className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <DocMenu
          title={name} canDuplicate={canDuplicateDoc(doc)}
          onOpen={onOpen} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete}
        />
      </div>
    </motion.div>
  )
}

// ── Dialogs ────────────────────────────────────────────────────────────────────

function RenameDialog({ doc, onSave, onCancel }: { doc: WorkspaceDocument; onSave: (t: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(doc.title)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        role="dialog" aria-modal="true" aria-label="Rename document"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white border border-[#e0e0da] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h3 className="flex items-center gap-2 text-[#1a1a18] font-semibold mb-4">
          <Edit3 size={16} className="text-[#7c3aed]" /> Rename document
        </h3>
        <input
          autoFocus value={val} onChange={e => setVal(e.target.value)}
          aria-label="Document title"
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

// Deleting is permanent on the server, and it used to happen on a single click of the menu item.
function ConfirmDeleteDialog({
  title, busy, onConfirm, onCancel,
}: { title: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <motion.div
        role="alertdialog" aria-modal="true"
        aria-labelledby="delete-doc-title" aria-describedby="delete-doc-desc"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white border border-[#e0e0da] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h3 id="delete-doc-title" className="flex items-center gap-2 text-[#1a1a18] font-semibold mb-2">
          <Trash2 size={16} className="text-red-600" /> Delete this document?
        </h3>
        <p id="delete-doc-desc" className="text-[13px] text-[#555] mb-5 break-words">
          “{title}” will be permanently deleted. This can’t be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            autoFocus onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={busy}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium transition-colors disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete'}
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
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceDocument | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [namingNew,   setNamingNew]   = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const query = search.trim()

  // Parsed once per documents change (not per keystroke / per row render).
  const docInfo = useMemo(() => {
    const m = new Map<string, DocInfo>()
    for (const d of documents) {
      const preview = extractPreviewText(d.content)
      m.set(d.id, { preview, words: countWords(preview) })
    }
    return m
  }, [documents])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    // There's no sharing feature yet, so every document is "owned by me" and
    // nothing is ever "shared" — reflect that instead of ignoring the tabs.
    // Search looks at the title and the document text, since many drafts share near-identical titles.
    let list = documents.filter(d => {
      if (!q) return true
      return displayTitle(d).toLowerCase().includes(q) || (docInfo.get(d.id)?.preview.toLowerCase().includes(q) ?? false)
    })
    if (filter === 'shared') list = []

    const sorted = [...list]
    if (sortBy === 'alpha') {
      sorted.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), undefined, { sensitivity: 'base', numeric: true }))
    } else if (sortBy === 'created') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else {
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    return sorted
  }, [documents, docInfo, query, filter, sortBy])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, filter, sortBy])

  const visible = filtered.slice(0, visibleCount)

  const mostRecentDoc = useMemo(() => {
    // Excludes documents created-and-abandoned before any real content was typed, so "Continue
    // where you left off" can't point at an empty "Untitled document" — see isEmptyDraftDocument.
    const resumable = documents.filter(d => !isEmptyDraftDocument(d))
    if (resumable.length === 0) return null
    return [...resumable].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  }, [documents])

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
      // .docx / .txt become real, editable documents — the same path as New → Import document, so
      // the two entry points no longer behave differently. They used to be stored as a temporary
      // blob: URL that stops working as soon as the page is reloaded.
      if (ext === 'docx' || ext === 'txt') {
        importDocumentFromFile(file, createDocument, { folderId })
          .then(() => toast.success(`Imported “${file.name}”`))
          .catch(err => toast.error(err instanceof Error ? err.message : `Could not read “${file.name}”.`))
        return
      }
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

  const handleDuplicate = async (doc: WorkspaceDocument) => {
    try {
      await createDocument({
        title:         `${displayTitle(doc)} (copy)`,
        content:       doc.content,
        type:          doc.type,
        isPdf:         false,
        folderId:      doc.folderId ?? null,
        citationStyle: doc.citationStyle,
        documentType:  doc.documentType,
      })
      toast.success('Document duplicated')
    } catch { /* the store already shows an error toast */ }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument(deleteTarget.id)
      toast.success('Document deleted')
      setDeleteTarget(null)
    } catch { /* the store already shows an error toast; keep the dialog so the user can retry */ }
    finally { setDeleting(false) }
  }

  const clearSearch = () => setSearch('')

  const FILTER_TABS: { label: string; value: DocOwnership }[] = SHARING_ENABLED
    ? [
        { label: 'All',         value: 'all' },
        { label: 'Owned by me', value: 'mine' },
        { label: 'Shared',      value: 'shared' },
      ]
    : []

  // Which "nothing to show" message applies — each needs different wording and a different way out.
  const emptyKind: 'none' | 'search' | 'shared' =
    documents.length === 0 ? 'none' : filter === 'shared' ? 'shared' : query ? 'search' : 'none'

  const countText = documents.length === 0
    ? ''
    : query || filter === 'shared'
      ? `${filtered.length} of ${documents.length} documents`
      : `${documents.length} documents`

  const renderItem = (doc: WorkspaceDocument, Item: typeof DocCard | typeof DocRow) => (
    <Item
      key={doc.id} doc={doc}
      info={docInfo.get(doc.id) ?? { preview: '', words: 0 }}
      query={query}
      onOpen={() => handleOpenDoc(doc)}
      onRename={() => setRenameDoc(doc)}
      onDuplicate={() => void handleDuplicate(doc)}
      onDelete={() => setDeleteTarget(doc)}
    />
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-[#e0e0da] flex items-center px-4 sm:px-6 gap-3 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <FolderOpen size={18} className="text-amber-500" />
          <h2 className="text-[#1a1a18] font-semibold text-[15px]">My Library</h2>
        </div>

        {/* Search — primary way to find a doc among many similarly-named drafts */}
        <div className="flex-1 min-w-0 max-w-md relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape' && search) { e.preventDefault(); clearSearch() } }}
            aria-label="Search documents"
            placeholder="Search documents…"
            className="w-full h-10 bg-white border border-[#e0e0da] rounded-xl pl-10 pr-9 text-sm text-[#1a1a18] placeholder-[#999] outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#ede9fe] transition-colors"
          />
          {search && (
            <button
              type="button" onClick={clearSearch} aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-[#999] hover:text-[#1a1a18] hover:bg-black/[0.05] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl border border-[#e0e0da] text-[#555] hover:text-[#1a1a18] hover:border-[#d1d5db] text-[13px] transition-all"
          >
            <Upload size={14} /> Upload
          </button>
        </div>
      </div>

      {/* ── Start new / resume — one row, so returning users aren't pushed past a big empty block ── */}
      <div className="px-4 sm:px-6 py-3 border-b border-[#e0e0da] shrink-0 flex flex-wrap items-center gap-3">
        {/* Same flow as the sidebar's New → New document (and the empty state's button), so it
            carries the same name — it isn't a "blank" shortcut, it asks for a type and citation style. */}
        <button
          onClick={() => setNamingNew(true)}
          aria-haspopup="dialog"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors shadow-lg shadow-purple-900/20 shrink-0"
        >
          <Plus size={14} /> New document
        </button>

        {mostRecentDoc && (
          <button
            onClick={() => handleOpenDoc(mostRecentDoc)}
            className="flex-1 basis-0 min-w-[14rem] overflow-hidden flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#e0e0da] hover:border-[#d1d5db] hover:bg-black/[0.02] transition-all text-left"
          >
            <Clock size={14} className="text-[#888] shrink-0" />
            <span className="sm:hidden text-[11px] text-[#555] uppercase tracking-wide shrink-0">Continue</span>
            <span className="hidden sm:inline text-[11px] text-[#555] uppercase tracking-wide shrink-0">Continue where you left off</span>
            <span title={displayTitle(mostRecentDoc)} className="text-[13px] text-[#1a1a18] font-medium truncate min-w-0">{displayTitle(mostRecentDoc)}</span>
            <span className="text-[11px] text-[#888] ml-auto shrink-0">{relativeDate(mostRecentDoc.updatedAt)}</span>
          </button>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#e0e0da] shrink-0">
        {FILTER_TABS.length > 0 && (
        <div role="group" aria-label="Filter documents" className="inline-flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
          {FILTER_TABS.map(t => (
            <button
              key={t.value} onClick={() => setFilter(t.value)}
              aria-pressed={filter === t.value}
              className={cn(
                'h-8 sm:h-7 px-3 sm:px-3.5 rounded-md text-[12px] whitespace-nowrap transition-all',
                filter === t.value
                  ? 'bg-white text-[#1a1a18] font-medium shadow-sm'
                  : 'text-[#777] hover:text-[#1a1a18] font-normal',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        )}

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          aria-label="Sort documents"
          className="h-8 sm:h-7 pl-2.5 pr-1.5 rounded-md text-[12px] bg-white border border-[#e0e0da] text-[#555] outline-none"
        >
          <option value="modified">Last modified</option>
          <option value="alpha">Alphabetical</option>
          <option value="created">Date created</option>
        </select>

        {countText && (
          <p role="status" aria-live="polite" className="text-[12px] text-[#777] whitespace-nowrap order-last w-full sm:order-none sm:w-auto">
            {countText}
          </p>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            aria-label="Grid view" title="Grid view" aria-pressed={viewMode === 'grid'}
            className={cn('w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors', viewMode === 'grid' ? 'bg-[#f1f5f9] text-[#1a1a18]' : 'text-[#777] hover:text-[#1a1a18]')}>
            <Grid3x3 size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            aria-label="List view" title="List view" aria-pressed={viewMode === 'list'}
            className={cn('w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors', viewMode === 'list' ? 'bg-[#f1f5f9] text-[#1a1a18]' : 'text-[#777] hover:text-[#1a1a18]')}>
            <List size={15} />
          </button>
        </div>
      </div>

      {/* ── Document area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-10 sm:py-20">
            <div className="w-16 h-16 shrink-0 rounded-2xl bg-[#f5f5f3] border border-[#e0e0da] flex items-center justify-center">
              {emptyKind === 'search' ? <Search size={26} className="text-[#999]" /> : <FilePlus size={28} className="text-[#999]" />}
            </div>
            {emptyKind === 'search' && (
              <>
                <div>
                  <p className="text-[#1a1a18] font-medium text-[15px] break-words">No documents match “{query}”</p>
                  <p className="text-[#888] text-[13px] mt-1">Try a different word, or a phrase from inside the document.</p>
                </div>
                <button onClick={clearSearch} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e0e0da] text-[#555] hover:text-[#1a1a18] hover:border-[#d1d5db] text-[13px] transition-all">
                  <X size={14} /> Clear search
                </button>
              </>
            )}
            {emptyKind === 'shared' && (
              <>
                <div>
                  <p className="text-[#1a1a18] font-medium text-[15px]">Nothing shared yet</p>
                  <p className="text-[#888] text-[13px] mt-1 max-w-xs">Sharing isn’t available yet. Documents you share, or that others share with you, will appear here.</p>
                </div>
                <button onClick={() => setFilter('all')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e0e0da] text-[#555] hover:text-[#1a1a18] hover:border-[#d1d5db] text-[13px] transition-all">
                  Show all documents
                </button>
              </>
            )}
            {emptyKind === 'none' && (
              <>
                <div>
                  <p className="text-[#1a1a18] font-medium text-[15px]">No documents yet</p>
                  <p className="text-[#888] text-[13px] mt-1">Create a new document or upload existing files</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setNamingNew(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors">
                    <Plus size={14} /> New document
                  </button>
                  <button onClick={() => setUploadOpen(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e0e0da] text-[#555] hover:text-[#1a1a18] hover:border-[#d1d5db] text-[13px] transition-all">
                    <Upload size={14} /> Upload files
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {visible.map(doc => renderItem(doc, DocCard))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {visible.map(doc => renderItem(doc, DocRow))}
              </div>
            )}

            {filtered.length > visible.length && (
              <div className="flex flex-col items-center gap-1.5 pt-5 pb-2">
                <button
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="px-4 py-2 rounded-xl border border-[#e0e0da] text-[#555] hover:text-[#1a1a18] hover:border-[#d1d5db] text-[13px] transition-all"
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
                </button>
                <p className="text-[11px] text-[#999]">Showing {visible.length} of {filtered.length}</p>
              </div>
            )}
          </>
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

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <ConfirmDeleteDialog
          title={displayTitle(deleteTarget)}
          busy={deleting}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Creation card (prompt #3) — replaces the old name-only modal ───────── */}
      {namingNew && (
        <CreationCard onClose={() => setNamingNew(false)} />
      )}
    </div>
  )
}
