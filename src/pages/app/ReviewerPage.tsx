import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Eye, FileText, Trash2, X, Plus, ChevronDown, ChevronUp, RotateCw, ScrollText, GraduationCap, FileSearch, ClipboardList,
} from 'lucide-react'
import { cn, formatShortDate } from '../../lib/utils'
import { useReviewerStore } from '../../store/reviewerStore'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import { IntakeModal, type RunDescriptor } from '../../components/reviewer/IntakeModal'
import { VERDICT_CONFIG } from '../../config/reviewerCategories'
import type { DocumentReviewSummary, ReviewType } from '../../types/reviewer'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<ReviewType, { icon: React.ReactNode; label: string; description: string }> = {
  Proposal: {
    icon: <ScrollText size={15} />,
    label: 'Proposal',
    description: 'Before supervisor approval or data collection — checks alignment, feasibility, ethics, gaps.',
  },
  Thesis: {
    icon: <GraduationCap size={15} />,
    label: 'Thesis',
    description: 'Chapter coherence, examiner concerns, defense prep.',
  },
  Manuscript: {
    icon: <FileSearch size={15} />,
    label: 'Manuscript',
    description: 'Journal fit, peer review, submission readiness.',
  },
  LiteratureReview: {
    icon: <ClipboardList size={15} />,
    label: 'Literature review',
    description: 'Coverage, synthesis, source quality, research gap.',
  },
}

const FILTER_VALUES: (ReviewType | 'all')[] = ['all', 'Proposal', 'Thesis', 'Manuscript', 'LiteratureReview']

const PAGE_SIZE = 25
const DISCLOSURE_KEY = 'reviewer_hide_disclosure'

type SortBy = 'updated' | 'score' | 'title'

// ── Pending (in-flight) run tracking ────────────────────────────────────────
// Review creation is a single synchronous backend call (confirmed via
// discovery — no job/status field exists), so a row never exists on the
// server until it's already complete. This is a genuine client-side
// optimistic placeholder for the in-flight window, not invented server data —
// it disappears (success) or flips to Failed (error) the moment the real
// response lands.

interface PendingRun {
  tempId:        string
  reviewType:    ReviewType
  documentTitle: string
  createdAt:     string
  status:        'running' | 'failed'
  run:           () => void
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReviewerPage() {
  const navigate = useNavigate()
  const reviewerStore = useReviewerStore()

  const [filter,        setFilter]        = useState<ReviewType | 'all'>('all')
  const [search,        setSearch]        = useState('')
  const [sortBy,        setSortBy]        = useState<SortBy>('updated')
  const [showIntake,    setShowIntake]    = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentReviewSummary | null>(null)
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE)
  const [pendingRuns,   setPendingRuns]   = useState<PendingRun[]>([])
  const [disclosureOpen, setDisclosureOpen] = useState(() => {
    try { return localStorage.getItem(DISCLOSURE_KEY) === 'true' } catch { return false }
  })
  const newReviewTriggerRef = useRef<HTMLButtonElement>(null)

  const toggleDisclosure = () => {
    setDisclosureOpen(open => {
      const next = !open
      try { localStorage.setItem(DISCLOSURE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  useEffect(() => {
    reviewerStore.loadReviews().catch(() => {})
  }, [])

  // ── Pending-run lifecycle ───────────────────────────────────────────────

  const startRun = (descriptor: RunDescriptor) => {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const run = () => {
      setPendingRuns(rs => rs.map(r => (r.tempId === tempId ? { ...r, status: 'running' } : r)))
      descriptor.perform()
        .then(() => {
          setPendingRuns(rs => rs.filter(r => r.tempId !== tempId))
          reviewerStore.loadReviews().catch(() => {})
        })
        .catch(() => {
          setPendingRuns(rs => rs.map(r => (r.tempId === tempId ? { ...r, status: 'failed' } : r)))
          toast.error('Review failed. You can retry from the row, or dismiss it.')
        })
    }

    setPendingRuns(rs => [
      { tempId, reviewType: descriptor.reviewType, documentTitle: descriptor.documentTitle, createdAt: new Date().toISOString(), status: 'running', run },
      ...rs,
    ])
    run()
  }

  const dismissPendingRun = (tempId: string) => setPendingRuns(rs => rs.filter(r => r.tempId !== tempId))

  // ── Counts (unfiltered by search, so they stay stable while typing) ─────

  const counts = useMemo(() => {
    const c: Record<ReviewType | 'all', number> = { all: reviewerStore.reviews.length, Proposal: 0, Thesis: 0, Manuscript: 0, LiteratureReview: 0 }
    for (const r of reviewerStore.reviews) c[r.reviewType]++
    return c
  }, [reviewerStore.reviews])

  const hasAnyReviews = reviewerStore.reviews.length > 0 || pendingRuns.length > 0

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return reviewerStore.reviews.filter(r => {
      if (filter !== 'all' && r.reviewType !== filter) return false
      if (q && !r.documentTitle.toLowerCase().includes(q)) return false
      return true
    })
  }, [reviewerStore.reviews, filter, search])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    if (sortBy === 'title') copy.sort((a, b) => a.documentTitle.localeCompare(b.documentTitle))
    else if (sortBy === 'score') copy.sort((a, b) => b.overallScore - a.overallScore)
    else copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return copy
  }, [filtered, sortBy])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filter, search])

  const visibleReviews = sorted.slice(0, visibleCount)
  const hasMore = sorted.length > visibleReviews.length

  const visiblePendingRuns = pendingRuns.filter(p => filter === 'all' || p.reviewType === filter)

  // ── Rows ──────────────────────────────────────────────────────────────────

  const pendingEntries: DocumentListEntry[] = visiblePendingRuns.map(p => ({
    id: p.tempId,
    icon: TYPE_META[p.reviewType].icon,
    iconClassName: 'bg-[var(--color-purple-tint)] border-transparent text-[var(--color-purple-text)]',
    title: p.documentTitle,
    metaLine: `${TYPE_META[p.reviewType].label} · Started ${formatShortDate(p.createdAt)}`,
    statusBadge: p.status === 'failed'
      ? { label: 'Failed', className: 'bg-red-100 text-red-700' }
      : { label: 'Reviewing…', className: 'bg-[var(--color-purple-tint)] text-[var(--color-purple-text)]' },
    onOpen: () => toast(p.status === 'failed' ? 'This review failed — use Retry or Dismiss.' : 'Still running — hang tight.'),
    inlineActions: p.status === 'failed'
      ? [{ key: 'retry', icon: <RotateCw size={14} />, label: 'Retry', onClick: (e) => { e.stopPropagation(); p.run() } }]
      : [],
    overflowActions: p.status === 'failed'
      ? [{ key: 'dismiss', icon: <X size={14} />, label: 'Dismiss', destructive: false, onClick: () => dismissPendingRun(p.tempId) }]
      : [],
  }))

  const reviewEntries: DocumentListEntry[] = visibleReviews.map(review => {
    const verdict = VERDICT_CONFIG[review.verdict]
    const openReport = () => navigate(`/app/reviewer/${review.id}`)
    return {
      id: review.id,
      icon: TYPE_META[review.reviewType].icon,
      iconClassName: 'bg-[var(--color-purple-tint)] border-transparent text-[var(--color-purple-text)]',
      title: review.documentTitle,
      metaLine: `${TYPE_META[review.reviewType].label} · ${review.overallScore}/100 · Updated ${formatShortDate(review.createdAt)}`,
      statusBadge: { label: verdict.label, className: verdict.chipCls },
      onOpen: openReport,
      inlineActions: [
        { key: 'open', icon: <Eye size={14} />, label: 'Open report', onClick: (e) => { e.stopPropagation(); openReport() } },
      ],
      overflowActions: [
        { key: 'open', icon: <Eye size={14} />, label: 'Open report', destructive: false, onClick: () => openReport() },
        { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', onClick: () => setPendingDelete(review) },
      ],
    }
  })

  const documentEntries = [...pendingEntries, ...reviewEntries]

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="w-full px-6 py-8">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        {/* AppNavbar already renders the page's <h1> ("Document Reviewer") —
            this body only adds the descriptive subtitle, not a second,
            repeating heading. */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <p className="text-[13px] text-slate-500 mt-1">
            Get an AI review of your proposal, thesis, manuscript, or literature review before you submit it.
          </p>

          {/* The only filled-purple CTA on this page. */}
          <button
            ref={newReviewTriggerRef}
            onClick={() => setShowIntake(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold transition-colors shadow-sm shrink-0"
          >
            <Plus size={14} /> New review
          </button>
        </div>

        {/* ── What can you do here? ────────────────────────────────────────── */}
        {hasAnyReviews && (
          <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={toggleDisclosure}
              aria-expanded={disclosureOpen}
              className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-[12px] font-medium text-slate-600">What can you do here?</span>
              {disclosureOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
            {disclosureOpen && (
              <div className="px-4 pb-3.5 pt-0.5 flex flex-col gap-2 border-t border-slate-100">
                {(Object.keys(TYPE_META) as ReviewType[]).map(type => (
                  <p key={type} className="text-[12px] text-slate-500 flex items-start gap-2">
                    <span className="text-[var(--color-purple-text)] mt-0.5 shrink-0">{TYPE_META[type].icon}</span>
                    <span><span className="font-medium text-slate-700">{TYPE_META[type].label}.</span> {TYPE_META[type].description}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state (no reviews at all yet) ──────────────────────────── */}
        {!hasAnyReviews && (
          <div className="border border-slate-200 rounded-xl py-12 px-6 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-purple-tint)] flex items-center justify-center">
              <FileText size={22} className="text-[var(--color-purple-text)]" />
            </div>
            <div>
              <p className="text-[14px] text-slate-700 font-semibold mb-1">No reviews yet</p>
              <p className="text-[12px] text-slate-500 max-w-sm">
                Use <span className="font-medium">+ New review</span> above to check a proposal, thesis, manuscript, or literature review before you submit it.
              </p>
            </div>
          </div>
        )}

        {hasAnyReviews && (
          <>
            <div className="mt-2">
              <DocumentList
                entries={documentEntries}
                totalCount={reviewerStore.reviews.length}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search reviews..."
                filterBar={
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
                    {FILTER_VALUES.map(v => (
                      <button
                        key={v}
                        onClick={() => setFilter(v)}
                        className={cn(
                          'px-3 py-1 rounded-md text-[12px] font-medium transition-all whitespace-nowrap',
                          filter === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                        )}
                      >
                        {v === 'all' ? 'All' : TYPE_META[v].label} {counts[v]}
                      </button>
                    ))}
                  </div>
                }
                headerRight={
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortBy)}
                    aria-label="Sort reviews"
                    className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-tint transition"
                  >
                    <option value="updated">Last modified</option>
                    <option value="score">Score</option>
                    <option value="title">Title</option>
                  </select>
                }
                emptyIcon={<FileText size={22} className="text-slate-400" />}
                emptyTitle="No reviews match your search"
                emptySubtitle="Try a different title or clear the search."
              />
            </div>

            {hasMore && (
              <div className="flex items-center justify-center pt-4">
                <button
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                >
                  Load more ({sorted.length - visibleReviews.length} remaining)
                </button>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Intake modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showIntake && (
          <IntakeModal
            initialReviewType="Proposal"
            onClose={() => { setShowIntake(false); newReviewTriggerRef.current?.focus() }}
            onSubmit={startRun}
          />
        )}
      </AnimatePresence>

      {/* ── Delete confirmation modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {pendingDelete && (
          <ConfirmActionModal
            title={`Delete "${pendingDelete.documentTitle}"?`}
            message="This action cannot be undone."
            confirmLabel="Delete"
            onClose={() => setPendingDelete(null)}
            onConfirm={async () => {
              await reviewerStore.deleteReview(pendingDelete.id)
              setPendingDelete(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
