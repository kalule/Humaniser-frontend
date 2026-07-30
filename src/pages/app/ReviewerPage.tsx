import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Eye, Trash2, MoreVertical, FileText, X,
  ScrollText, GraduationCap, FileSearch, ClipboardList,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useReviewerStore } from '../../store/reviewerStore'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { IntakeModal } from '../../components/reviewer/IntakeModal'
import type { DocumentReviewSummary, ReviewType, ReviewVerdict } from '../../types/reviewer'

// ── Constants ─────────────────────────────────────────────────────────────────

const REVIEW_TYPE_META: Record<ReviewType, {
  icon: React.ReactNode; color: string; bg: string; label: string; subtitle: string
}> = {
  Proposal: {
    icon:  <ScrollText size={22} />,
    color: 'text-amber-600',
    bg:    'bg-amber-50 border-amber-200',
    label: 'Proposal',
    subtitle: 'Before supervisor approval or data collection — checks alignment, feasibility, ethics, gaps.',
  },
  Thesis: {
    icon:  <GraduationCap size={22} />,
    color: 'text-emerald-600',
    bg:    'bg-emerald-50 border-emerald-200',
    label: 'Thesis',
    subtitle: 'Chapter coherence, examiner concerns, defense prep.',
  },
  Manuscript: {
    icon:  <FileSearch size={22} />,
    color: 'text-rose-600',
    bg:    'bg-rose-50 border-rose-200',
    label: 'Manuscript',
    subtitle: 'Journal fit, peer review, submission readiness.',
  },
  LiteratureReview: {
    icon:  <ClipboardList size={22} />,
    color: 'text-sky-600',
    bg:    'bg-sky-50 border-sky-200',
    label: 'Literature Review',
    subtitle: 'Coverage, synthesis, source quality, research gap.',
  },
}

const FILTER_TABS: { label: string; value: ReviewType | 'all' }[] = [
  { label: 'All',               value: 'all' },
  { label: 'Proposal',          value: 'Proposal' },
  { label: 'Thesis',            value: 'Thesis' },
  { label: 'Manuscript',        value: 'Manuscript' },
  { label: 'Literature Review', value: 'LiteratureReview' },
]

const VERDICT_STYLES: Record<ReviewVerdict, string> = {
  Accept: 'bg-green-100 text-green-700',
  Revise: 'bg-amber-tint text-amber-text',
  Reject: 'bg-red-100 text-red-700',
}

const PAGE_SIZE = 25

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Row overflow menu ────────────────────────────────────────────────────────

function RowActionsMenu({ onDeleteRequest }: { onDeleteRequest: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title="More actions"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
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
              className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden py-1"
            >
              <button
                onClick={() => { setOpen(false); onDeleteRequest() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({ review, onOpen, onDeleteRequest }: {
  review: DocumentReviewSummary
  onOpen: () => void
  onDeleteRequest: () => void
}) {
  const meta = REVIEW_TYPE_META[review.reviewType]

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onOpen}
      className="group border-b border-slate-200 last:border-0 even:bg-slate-50/50 hover:bg-orange-50/40 cursor-pointer transition-colors duration-150"
    >
      <td className="py-3 px-4">
        <div className="flex items-start gap-2.5">
          <span className={cn(meta.color, 'shrink-0 mt-0.5')} title={meta.label}>{meta.icon}</span>
          <p title={review.documentTitle} className="text-[13px] font-semibold text-slate-800 group-hover:text-orange-600 transition-colors truncate leading-snug min-w-0">
            {review.documentTitle}
          </p>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-[12px] font-semibold text-slate-700 tabular-nums">{review.overallScore}</span>
      </td>
      <td className="py-3 px-4">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', VERDICT_STYLES[review.verdict])}>
          {review.verdict}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-[12px] text-slate-500">{formatDate(review.createdAt)}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onOpen() }}
            title="Open"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#7c3aed] hover:bg-violet-50 transition-colors"
          >
            <Eye size={14} />
          </button>
          <RowActionsMenu onDeleteRequest={onDeleteRequest} />
        </div>
      </td>
    </motion.tr>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReviewerPage() {
  const navigate = useNavigate()
  const reviewerStore = useReviewerStore()

  const [filter,        setFilter]        = useState<ReviewType | 'all'>('all')
  const [search,        setSearch]        = useState('')
  const [intakeType,    setIntakeType]    = useState<ReviewType | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentReviewSummary | null>(null)
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE)
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('reviewer_hide_onboarding') !== 'true',
  )

  const dismissOnboarding = () => {
    localStorage.setItem('reviewer_hide_onboarding', 'true')
    setShowOnboarding(false)
  }
  const restoreOnboarding = () => {
    localStorage.removeItem('reviewer_hide_onboarding')
    setShowOnboarding(true)
  }

  useEffect(() => {
    reviewerStore.loadReviews().catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return reviewerStore.reviews.filter(r => {
      if (filter !== 'all' && r.reviewType !== filter) return false
      if (q && !r.documentTitle.toLowerCase().includes(q)) return false
      return true
    })
  }, [reviewerStore.reviews, filter, search])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filter, search])

  const visibleReviews = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleReviews.length

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="w-full px-6 py-8">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        {/* Matches Proposal Studio's header: plain H1 + subtitle, no eyebrow —
            the top app header (AppNavbar) already states the page name once. */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Document Reviewer</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Get an AI review of your proposal, thesis, manuscript, or literature review before you submit it.
            </p>
          </div>
          {!showOnboarding && (
            <button
              onClick={restoreOnboarding}
              className="text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            >
              Show tips
            </button>
          )}
        </div>

        {/* ── Review-type cards ─────────────────────────────────────────────── */}
        {showOnboarding && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] text-slate-500 font-medium">What can you do with Document Reviewer?</p>
            <button
              onClick={dismissOnboarding}
              title="Hide tips"
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {(Object.keys(REVIEW_TYPE_META) as ReviewType[]).map(type => {
              const meta = REVIEW_TYPE_META[type]
              return (
                <div
                  key={type}
                  className="flex flex-col bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3 border shrink-0', meta.bg, meta.color)}>
                    {meta.icon}
                  </div>
                  <h3 className="text-[13px] font-bold text-slate-800 leading-snug mb-1.5">{meta.label}</h3>
                  <p className="text-[12px] text-slate-500 leading-relaxed mb-3 flex-1">{meta.subtitle}</p>
                  <button
                    onClick={() => setIntakeType(type)}
                    className="self-start px-3.5 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200"
                  >
                    Review a {meta.label.toLowerCase()}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
            {FILTER_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setFilter(t.value)}
                className={cn(
                  'px-3 py-1 rounded-md text-[12px] font-medium transition-all whitespace-nowrap',
                  filter === t.value
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative max-w-xs w-full shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reviews"
              className="w-full pl-8 pr-4 py-2 text-[13px] text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-500"
            />
          </div>
        </div>

        {/* ── Review table ──────────────────────────────────────────────────── */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-32" />
              <col className="w-20" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                {['DOCUMENT', 'SCORE', 'VERDICT', 'UPDATED', 'ACTIONS'].map(col => (
                  <th key={col} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest px-4 py-2.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                          {search ? <Search size={20} className="text-slate-400" /> : <FileText size={22} className="text-slate-400" />}
                        </div>
                        {reviewerStore.reviews.length === 0 ? (
                          <>
                            <p className="text-[14px] text-slate-600 font-medium">No reviews yet</p>
                            <p className="text-[12px] text-slate-400">Pick a document type above to run your first review.</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[14px] text-slate-600 font-medium">No reviews match your search</p>
                            <p className="text-[12px] text-slate-400">Try a different title or clear the search.</p>
                            {search && (
                              <button
                                onClick={() => setSearch('')}
                                className="mt-1 text-[12px] font-medium text-[#7c3aed] hover:text-[#4c1d95] transition-colors"
                              >
                                Clear search
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleReviews.map(review => (
                    <ReviewRow
                      key={review.id}
                      review={review}
                      onOpen={() => navigate(`/app/reviewer/${review.id}`)}
                      onDeleteRequest={() => setPendingDelete(review)}
                    />
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* ── Load more ─────────────────────────────────────────────────────── */}
        {hasMore && (
          <div className="flex items-center justify-center pt-4">
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              Load more ({filtered.length - visibleReviews.length} remaining)
            </button>
          </div>
        )}

      </div>

      {/* ── Intake modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {intakeType && (
          <IntakeModal
            reviewType={intakeType}
            onClose={() => setIntakeType(null)}
            onCreated={review => { setIntakeType(null); navigate(`/app/reviewer/${review.id}`) }}
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
