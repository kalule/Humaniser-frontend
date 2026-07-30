import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Eye, Download, FileType2, Trash2, RefreshCw, Loader2,
  GraduationCap, ScrollText, Upload, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useResearchStore } from '../../store/researchStore'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { ToolCard } from '../../components/app/ToolCard'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import { Tooltip } from '../../components/ui/Tooltip'
import type { ResearchProject } from '../../types/research'

// ── Status derived from progress ────────────────────────────────────────────
// ResearchProject has no explicit status field — progressPct is the source of
// truth, same convention used by Proposal Studio / SystematicReviewPage.

type Status = 'Draft' | 'InProgress' | 'Completed'

const STATUS_STYLES: Record<Status, string> = {
  Draft:      'bg-slate-100 text-slate-500',
  InProgress: 'bg-amber-tint text-amber-text',
  Completed:  'bg-green-tint text-green-text',
}
const STATUS_LABELS: Record<Status, string> = {
  Draft: 'Draft', InProgress: 'In progress', Completed: 'Completed',
}

function statusOf(project: ResearchProject): Status {
  if (project.progressPct >= 100) return 'Completed'
  if (project.progressPct > 0) return 'InProgress'
  return 'Draft'
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (date.toDateString() === new Date().toDateString()) return 'Today'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAGE_SIZE = 25

// ── Upload an already-approved external proposal ────────────────────────────
// Entry point for students whose proposal was written/approved outside this
// system (a supervisor's Word doc exported to PDF, or from before they found
// Humaniser) — the primary path is opening an existing Proposal Studio
// project and using its own "Begin thesis writing" audit; this is the
// fallback so externally-approved students aren't blocked out.

function ThesisUploadModal({
  onClose,
  onUpload,
}: {
  onClose:  () => void
  onUpload: (file: File) => Promise<void>
}) {
  const [file, setFile]       = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported for now.')
      return
    }
    setError(null)
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      await onUpload(file)
    } catch {
      setError('Could not process this document. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6"
      >
        {!loading && (
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={16} />
          </button>
        )}

        <div className="mb-5">
          <p className="text-[11px] text-purple-text font-semibold uppercase tracking-widest mb-1">Thesis Studio</p>
          <h3 className="text-[17px] font-bold text-slate-900">Upload your approved proposal</h3>
          <p className="text-[13px] text-slate-500 mt-1">
            For a proposal written or approved outside Humaniser. We'll extract what we can and
            flag it as unverified until you confirm the details — nothing here overwrites your
            existing Proposal Studio work.
          </p>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]) }}
          onClick={() => !loading && inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 mb-4',
            dragging ? 'border-purple-accent bg-purple-tint' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
          )}
        >
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', dragging ? 'bg-purple-tint' : 'bg-slate-100')}>
            <Upload size={18} className={dragging ? 'text-purple-accent' : 'text-slate-500'} />
          </div>
          {file ? (
            <p className="text-[13px] font-medium text-slate-700">{file.name}</p>
          ) : (
            <>
              <p className="text-[13px] font-medium text-slate-700">Drag and drop your PDF here</p>
              <p className="text-[11px] text-slate-400">or click to browse — PDF only, max 50 MB</p>
            </>
          )}
        </div>
        <input
          ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }}
        />

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !file}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Extracting…</> : 'Upload & continue'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
// Home for the *post-proposal* thesis journey. Proposal creation (including
// the Autonomous Proposal one-shot generator and Similar Papers Finder) lives
// entirely in Proposal Studio — this page only manages projects that have
// already transitioned to Thesis/Dissertation (via ResearchAgentPage's own
// readiness audit → "Begin thesis writing"), plus the two entry points into
// that transition (continue an internal proposal, or upload an externally
// approved one).

export default function ThesisStudioPage() {
  const navigate      = useNavigate()
  const researchStore = useResearchStore()

  const [search,        setSearch]        = useState('')
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE)
  const [refreshing,    setRefreshing]    = useState(false)
  const [uploadOpen,    setUploadOpen]    = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ResearchProject | null>(null)
  const [exportingId,   setExportingId]   = useState<string | null>(null)

  useEffect(() => {
    researchStore.loadProjects().catch(() => {})
  }, [])

  // Only projects that have actually transitioned out of Proposal — everything
  // still in Proposal/Protocol stage is Proposal Studio's list, not this one.
  const theses = useMemo(
    () => [...researchStore.projects]
      .filter(p => p.documentType === 'Thesis' || p.documentType === 'Dissertation')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [researchStore.projects],
  )
  const filteredTheses = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return theses
    return theses.filter(p => (p.title || '').toLowerCase().includes(q))
  }, [theses, search])

  const visibleTheses = filteredTheses.slice(0, visibleCount)
  const hasMore = filteredTheses.length > visibleTheses.length

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await researchStore.loadProjects()
    } finally {
      setRefreshing(false)
    }
  }

  const handleExportWord = async (project: ResearchProject) => {
    setExportingId(project.id)
    try {
      await researchStore.exportThesisDocx(project.id)
    } finally {
      setExportingId(null)
    }
  }

  const handleUploadExternalProposal = async (file: File) => {
    const project = await researchStore.uploadExternalProposal(file)
    setUploadOpen(false)
    navigate(`/app/research-agent/${project.id}/dashboard`)
  }

  const documentEntries: DocumentListEntry[] = visibleTheses.map(project => {
    const status = statusOf(project)
    // Completed projects open straight into the compiled document (nothing left
    // to work on); everything still in progress lands on the Research Dashboard
    // — the project's home base — rather than jumping straight into the chapter
    // editor.
    const onOpen = () => navigate(status === 'Completed'
      ? `/app/research-agent/${project.id}/document`
      : `/app/research-agent/${project.id}/dashboard`)
    const onView = () => navigate(`/app/research-agent/${project.id}/document`)
    const exporting = exportingId === project.id

    return {
      id: project.id,
      icon: <GraduationCap size={16} />,
      iconClassName: 'bg-violet-50 border-violet-200 text-violet-600',
      title: project.title || 'Untitled research project',
      metaLine: `${formatDate(project.updatedAt)} · ${project.academicLevel} · ${project.citationStyle.toUpperCase()}`,
      statusBadge: { label: STATUS_LABELS[status], className: STATUS_STYLES[status] },
      onOpen,
      inlineActions: [
        { key: 'preview', icon: <Eye size={14} />, label: 'Preview', onClick: (e) => { e.stopPropagation(); onView() } },
        {
          key: 'download',
          icon: exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />,
          label: 'Download',
          disabled: exporting,
          onClick: (e) => { e.stopPropagation(); handleExportWord(project) },
        },
        { key: 'pdf', icon: <FileType2 size={14} />, label: 'PDF export is not yet available', disabled: true, onClick: (e) => e.stopPropagation() },
      ],
      overflowActions: [
        { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', onClick: () => setPendingDelete(project) },
      ],
    }
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="w-full px-6 py-8">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Thesis Studio</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Guide an approved proposal through readiness validation, thesis writing, and defence preparation.
          </p>
        </div>

        {/* ── Start a thesis ───────────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-[12px] text-slate-500 font-medium mb-4">Start a thesis</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToolCard
              icon={<ScrollText size={16} />}
              iconClassName="bg-purple-tint text-purple-accent"
              title="Continue from an approved proposal"
              description='Open a proposal in Proposal Studio and run its built-in readiness audit — "Begin thesis writing" unlocks once objectives, methodology, and literature pass review.'
              ctaLabel="Go to Proposal Studio"
              onCta={() => navigate('/app/proposal-studio')}
            />
            <ToolCard
              icon={<GraduationCap size={16} />}
              iconClassName="bg-violet-50 text-violet-600"
              title="Upload an externally approved proposal"
              description="Already have an approved proposal from elsewhere? Upload it (PDF) to begin the same methodology-aware audit."
              ctaLabel="Upload proposal"
              onCta={() => setUploadOpen(true)}
            />
          </div>
        </div>

        {/* ── Research projects ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Research Projects</h2>
            <p className="text-[12px] text-slate-500">{theses.length} research project{theses.length === 1 ? '' : 's'} in progress</p>
          </div>
        </div>

        <DocumentList
          entries={documentEntries}
          totalCount={theses.length}
          search={search}
          onSearchChange={setSearch}
          headerRight={
            <Tooltip label="Refresh list">
              <button
                onClick={handleRefresh}
                aria-label="Refresh list"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <RefreshCw size={15} className={cn(refreshing && 'animate-spin')} />
              </button>
            </Tooltip>
          }
          emptyIcon={<FileText size={22} className="text-slate-400" />}
          emptyTitle="No research projects yet"
          emptySubtitle="Transition an approved proposal above, or upload one that's already been approved, to get started."
        />

        {/* ── Load more ─────────────────────────────────────────────────────── */}
        {hasMore && (
          <div className="flex items-center justify-center pt-4">
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              Load more ({filteredTheses.length - visibleTheses.length} remaining)
            </button>
          </div>
        )}

      </div>

      {/* ── Upload external proposal modal ───────────────────────────────── */}
      <AnimatePresence>
        {uploadOpen && (
          <ThesisUploadModal
            onClose={() => setUploadOpen(false)}
            onUpload={handleUploadExternalProposal}
          />
        )}
      </AnimatePresence>

      {/* ── Delete confirmation modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {pendingDelete && (
          <ConfirmActionModal
            title={`Delete "${pendingDelete.title}"?`}
            message="This action cannot be undone."
            confirmLabel="Delete"
            onClose={() => setPendingDelete(null)}
            onConfirm={async () => {
              await researchStore.deleteProject(pendingDelete.id)
              setPendingDelete(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
