import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  FileText, Eye, Download, Trash2, RefreshCw, Loader2,
  GraduationCap, ScrollText, Upload, X, Plus, ChevronDown,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useResearchStore } from '../../store/researchStore'
import { researchApi } from '../../api/research'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { ToolCard } from '../../components/app/ToolCard'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import { Tooltip } from '../../components/ui/Tooltip'
import type { ApiError } from '../../types'
import type { ResearchProject, UploadExternalProposalResult } from '../../types/research'
import { RESEARCH_STATE_OPTIONS } from '../../types/research'
import { STEPS } from '../../data/proposalOutline'

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

/** "Updated 2 hours ago" for recent work, the plain date once it is older than a week. */
function updatedLabel(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (!Number.isFinite(mins) || mins < 0) return `Updated ${formatDate(iso)}`
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Updated ${days} day${days === 1 ? '' : 's'} ago`
  return `Updated ${formatDate(iso)}`
}

// The stage is the student's own declared research state (Study designed, Data
// collection, …) and the last step is where they were last working — both are
// real stored values, nothing is estimated.
function stageLabel(project: ResearchProject): string | null {
  return RESEARCH_STATE_OPTIONS.find(o => o.value === project.researchState)?.label ?? null
}
function lastStepLabel(project: ResearchProject): string | null {
  // Setup steps (topic, location, …) say nothing useful about a thesis in progress.
  const step = STEPS[project.currentStep]
  return step?.group === 'chapters' ? step.label : null
}

type StatusFilter = 'All' | Status
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'InProgress', label: 'In progress' },
  { key: 'Draft', label: 'Draft' },
  { key: 'Completed', label: 'Completed' },
]

const PAGE_SIZE = 25
const MAX_EXTERNAL_PROPOSAL_BYTES = 50 * 1024 * 1024
const EXTERNAL_PROPOSAL_MIME_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
])

export function validateExternalProposalFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  const expectedMime = EXTERNAL_PROPOSAL_MIME_TYPES.get(extension)
  if (!expectedMime || (file.type && file.type !== expectedMime))
    return 'Unsupported file type. Upload a PDF or Word (.docx) document.'
  if (file.size > MAX_EXTERNAL_PROPOSAL_BYTES)
    return 'This document is larger than the 50 MB upload limit.'
  return null
}

// ── Upload an already-approved external proposal ────────────────────────────
// Entry point for students whose proposal was written/approved outside this
// system (a supervisor's Word doc exported to PDF, or from before they found
// Humaniser) — the primary path is opening an existing Proposal Studio
// project and using its own "Begin thesis writing" audit; this is the
// fallback so externally-approved students aren't blocked out.

function ThesisUploadModal({
  onClose,
  onUpload,
  onConfirm,
  onDiscard,
}: {
  onClose:  () => void
  onUpload: (file: File) => Promise<UploadExternalProposalResult>
  onConfirm: (result: UploadExternalProposalResult) => void | Promise<void>
  onDiscard: (result: UploadExternalProposalResult) => Promise<void>
}) {
  const [file, setFile]       = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [result, setResult]   = useState<UploadExternalProposalResult | null>(null)
  const [attested, setAttested] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (f: File | undefined) => {
    if (!f) return
    const validationError = validateExternalProposalFile(f)
    if (validationError) {
      setFile(null)
      setError(validationError)
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
      setResult(await onUpload(file))
      setLoading(false)
    } catch (err) {
      setError((err as ApiError | undefined)?.message ?? 'Could not process this document. Please try again.')
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
          <button
            onClick={() => result ? void onDiscard(result) : onClose()}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        )}

        <div className="mb-5">
          <p className="text-[11px] text-purple-text font-semibold uppercase tracking-widest mb-1">Thesis Studio</p>
          <h3 className="text-[17px] font-bold text-slate-900">{result ? 'Review imported proposal' : 'Upload your approved proposal'}</h3>
          <p className="text-[13px] text-slate-500 mt-1">
            {result
              ? 'Confirm the extracted structure before continuing. Citations remain unverified until the integrity checks complete.'
              : <>For a proposal written or approved outside HumaniseAI. We'll extract what we can and
                flag it as unverified until you confirm the details — nothing here overwrites your
                existing Proposal Studio work.</>}
          </p>
        </div>

        {result ? (
          <div className="space-y-3 mb-5 text-[12px]">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 p-3"><strong className="block text-emerald-700 text-base">{result.review?.matchedSectionCodes.length ?? 0}</strong>Matched sections</div>
              <div className="rounded-lg bg-amber-50 p-3"><strong className="block text-amber-700 text-base">{result.review?.unverifiedHeadings.length ?? 0}</strong>Headings to review</div>
              <div className="rounded-lg bg-violet-50 p-3"><strong className="block text-violet-700 text-base">{result.review?.citationsPendingVerification.length ?? 0}</strong>Pending citations</div>
            </div>
            {result.advisoryMessages.map(message => (
              <p key={message} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">{message}</p>
            ))}
            {!!result.review?.unverifiedHeadings.length && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-700 mb-2">Possible headings — please confirm in the editor</p>
                {result.review.unverifiedHeadings.map((heading, index) => (
                  <p key={`${heading.text}-${index}`} className="text-slate-600">{heading.text} · {Math.round(heading.confidence * 100)}% confidence</p>
                ))}
              </div>
            )}
          </div>
        ) : <div
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
              <p className="text-[13px] font-medium text-slate-700">Drag and drop your PDF or DOCX here</p>
              <p className="text-[11px] text-slate-400">or click to browse — PDF or Word (.docx), max 50 MB</p>
            </>
          )}
        </div>}
        {!result && <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }}
        />}

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

        {/* An uploaded proposal skips the in-app readiness audit, so the student states that it was approved
            elsewhere. The audit still runs on the project's Validation tab, as advice. */}
        {result && (
          <label className="flex items-start gap-2 mb-4 text-[12px] text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={attested}
              onChange={e => setAttested(e.target.checked)}
              className="mt-0.5 accent-purple-600"
            />
            <span>This proposal was approved by my supervisor or institution. I understand the readiness audit will still flag anything it finds.</span>
          </label>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={() => result ? void onDiscard(result) : onClose()} disabled={loading} className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-40">
            {result ? 'Discard import' : 'Cancel'}
          </button>
          <button
            onClick={() => result ? onConfirm(result) : void handleSubmit()}
            disabled={loading || (!file && !result) || (!!result && !attested)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Extracting…</> : result ? 'Confirm & continue' : 'Upload & review'}
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
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('All')
  const [newOpen,       setNewOpen]       = useState(false)

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
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { All: theses.length, Draft: 0, InProgress: 0, Completed: 0 }
    for (const p of theses) counts[statusOf(p)]++
    return counts
  }, [theses])
  const filteredTheses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return theses.filter(p =>
      (statusFilter === 'All' || statusOf(p) === statusFilter)
      && (!q || (p.title || '').toLowerCase().includes(q)))
  }, [theses, search, statusFilter])

  const visibleTheses = filteredTheses.slice(0, visibleCount)
  const hasMore = filteredTheses.length > visibleTheses.length

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, statusFilter])

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
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Thesis export was blocked.')
    } finally {
      setExportingId(null)
    }
  }

  const handleUploadExternalProposal = async (file: File) => {
    return researchStore.uploadExternalProposal(file)
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
      metaLine: [
        updatedLabel(project.updatedAt),
        project.academicLevel,
        stageLabel(project),
        status === 'Completed' ? null : (lastStepLabel(project) && status === 'InProgress' ? `Last step: ${lastStepLabel(project)}` : null),
      ].filter(Boolean).join(' · '),
      statusBadge: { label: STATUS_LABELS[status], className: STATUS_STYLES[status], progressPct: project.progressPct },
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
          {/* <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Thesis Studio</h1> */}
          <p className="text-[13px] text-slate-500 mt-1">
            Guide an approved proposal through readiness validation, thesis writing, and defence preparation.
          </p>
        </div>

        {/* ── Start a thesis ───────────────────────────────────────────────── */}
        {/* First-time students get the full explanation; once they have a thesis the
            two entry points collapse into a "New thesis" menu beside the list. */}
        {theses.length === 0 && (
          <div className="mb-8">
            <p className="text-[12px] text-slate-500 font-medium mb-4">Start a thesis</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ToolCard
                icon={<ScrollText size={16} />}
                iconClassName="bg-purple-tint text-purple-accent"
                title="Continue from an approved proposal"
                description='Open your proposal in Proposal Studio, then its dashboard Validation tab. "Begin thesis writing" appears there once the readiness audit finds nothing blocking.'
                ctaLabel="Go to Proposal Studio"
                onCta={() => navigate('/app/proposal-studio')}
              />
              <ToolCard
                icon={<GraduationCap size={16} />}
                iconClassName="bg-violet-50 text-violet-600"
                title="Upload an externally approved proposal"
                description="Already have an approved proposal from elsewhere? Upload a PDF or Word (.docx) document to begin the same methodology-aware audit."
                ctaLabel="Upload proposal"
                onCta={() => setUploadOpen(true)}
              />
            </div>
          </div>
        )}

        {/* ── Research projects ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Research Projects</h2>
            <p className="text-[12px] text-slate-500">
              {theses.length} research project{theses.length === 1 ? '' : 's'}
              {theses.length > 0 && ` · ${statusCounts.InProgress} in progress · ${statusCounts.Completed} completed`}
            </p>
          </div>
        </div>

        <DocumentList
          entries={documentEntries}
          totalCount={theses.length}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search projects..."
          filterBar={theses.length > 0 ? (
            <div role="tablist" aria-label="Filter projects by status" className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={statusFilter === f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors',
                    statusFilter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {f.label} <span className="text-slate-500">{statusCounts[f.key]}</span>
                </button>
              ))}
            </div>
          ) : undefined}
          headerRight={
            <div className="flex items-center gap-1">
              <Tooltip label="Refresh list">
                <button
                  onClick={handleRefresh}
                  aria-label="Refresh list"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw size={15} className={cn(refreshing && 'animate-spin')} />
                </button>
              </Tooltip>
              {theses.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setNewOpen(v => !v)}
                    aria-haspopup="menu"
                    aria-expanded={newOpen}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200"
                  >
                    <Plus size={14} /> New thesis <ChevronDown size={13} />
                  </button>
                  {newOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setNewOpen(false)} />
                      <div role="menu" className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 whitespace-normal">
                        <button
                          role="menuitem"
                          onClick={() => { setNewOpen(false); navigate('/app/proposal-studio') }}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <ScrollText size={15} className="mt-0.5 text-purple-accent shrink-0" />
                          <span>
                            <span className="block text-[13px] font-medium text-slate-800">Continue from an approved proposal</span>
                            <span className="block text-[11px] text-slate-500">Open it in Proposal Studio and run the readiness audit.</span>
                          </span>
                        </button>
                        <button
                          role="menuitem"
                          onClick={() => { setNewOpen(false); setUploadOpen(true) }}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <Upload size={15} className="mt-0.5 text-violet-600 shrink-0" />
                          <span>
                            <span className="block text-[13px] font-medium text-slate-800">Upload an approved proposal</span>
                            <span className="block text-[11px] text-slate-500">Import a PDF or Word (.docx) approved elsewhere.</span>
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          }
          emptyIcon={<FileText size={22} className="text-slate-400" />}
          emptyTitle={theses.length > 0 ? 'No projects in this view' : 'No research projects yet'}
          emptySubtitle={theses.length > 0
            ? 'Try another status filter.'
            : "Transition an approved proposal above, or upload one that's already been approved, to get started."}
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
            onConfirm={async (result) => {
              try {
                await researchApi.attestExternalProposal(result.project.id)
              } catch {
                toast.error('Could not record your confirmation. Please try again.')
                return
              }
              setUploadOpen(false)
              navigate(`/app/research-agent/${result.project.id}/dashboard`)
            }}
            onDiscard={async (result) => {
              await researchStore.deleteProject(result.project.id)
              setUploadOpen(false)
              toast.success('Imported proposal discarded.')
            }}
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
