import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Trash2, X, Loader2, ClipboardList, FileSearch, UploadCloud, Upload, ArrowRight,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import type { ReviewCreationPath, SystematicReview, SystematicReviewStatus } from '../../types/systematicReview'

// ── Constants ─────────────────────────────────────────────────────────────────

const CREATION_CARDS: {
  path:     ReviewCreationPath
  icon:     React.ReactNode
  title:    string
  subtitle: string
  color:    string
  bg:       string
}[] = [
  {
    path:     'PrismaFirst',
    icon:     <ClipboardList size={22} />,
    title:    'Create PRISMA first systematic Review',
    subtitle: 'Start with screening, dedupe, PRISMA flow, and manuscript-ready outputs.',
    color:    'text-violet-600',
    bg:       'bg-violet-50 border-violet-200',
  },
  {
    path:     'DatabaseSearch',
    icon:     <FileSearch size={22} />,
    title:    'Create Review from database search',
    subtitle: 'Search broad literature sources and build a review workspace quickly.',
    color:    'text-sky-600',
    bg:       'bg-sky-50 border-sky-200',
  },
  {
    path:     'UploadOwn',
    icon:     <UploadCloud size={22} />,
    title:    'Upload papers or import from academic databases',
    subtitle: 'Bring your own papers or start from connected academic databases.',
    color:    'text-amber-600',
    bg:       'bg-amber-50 border-amber-200',
  },
]

const PAGE_SIZE = 25

const STATUS_STYLES: Record<SystematicReviewStatus, string> = {
  Draft:      'bg-slate-100 text-slate-500',
  InProgress: 'bg-amber-tint text-amber-text',
  Completed:  'bg-green-tint text-green-text',
}

const STATUS_LABELS: Record<SystematicReviewStatus, string> = {
  Draft: 'Draft', InProgress: 'In progress', Completed: 'Completed',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Data-driven so these can be swapped for domain-relevant examples later.
const EXAMPLE_QUESTIONS = [
  'In adults with asthma, do biologic therapies improve symptom control compared with standard care?',
  'Among undergraduate students, how effective are spaced-repetition interventions for long-term retention?',
  'In patients with type 2 diabetes, does continuous glucose monitoring improve glycemic outcomes?',
]

const MIN_QUESTION_LENGTH = 15
// Below this length the question likely lacks a population/intervention/outcome — nudge, don't block.
const HINT_THRESHOLD_LENGTH = 40

// ── Delete confirmation modal ──────────────────────────────────────────────────

function DeleteModal({
  review,
  onClose,
  onConfirm,
}: {
  review:    SystematicReview
  onClose:   () => void
  onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>

        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>

        <h3 className="text-[17px] font-bold text-slate-900 mb-1">Delete this review?</h3>
        <p className="text-[13px] text-slate-500 mb-1">You are about to delete:</p>
        <p className="text-[13px] font-semibold text-slate-800 truncate mb-5">
          "{review.researchQuestion || 'Untitled systematic review'}"
        </p>
        <p className="text-[12px] text-slate-400 mb-6">
          Screening progress and imported papers will be removed. This cannot be undone.
        </p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm() }}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── New review modal ────────────────────────────────────────────────────────
// Triggered by "+ New Review" (no visible preset) and by each creation card's
// "Get Started" (creationPath preset invisibly, per the calling convention —
// there's no project selector here since reviews aren't grouped into a
// separate "Project" entity in this app; they belong directly to the user.

function NewReviewModal({
  creationPath,
  onClose,
  onCreated,
}: {
  creationPath: ReviewCreationPath
  onClose:      () => void
  onCreated:    (review: SystematicReview) => void
}) {
  const store = useSystematicReviewStore()
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  const trimmed = question.trim()
  const isValid = trimmed.length >= MIN_QUESTION_LENGTH

  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const review = await store.createReview({ researchQuestion: trimmed, creationPath })
      onCreated(review)
    } catch {
      setError('Could not create the review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 shrink-0 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
            <ClipboardList size={18} />
          </div>
          <div>
            <p className="text-[11px] text-violet-500 font-semibold uppercase tracking-widest mb-1">Systematic Review</p>
            <h3 className="text-[17px] font-bold text-slate-900">New systematic review</h3>
            <p className="text-[13px] text-slate-500 mt-1">
              Enter one research question. We'll create the review workspace and guide the next steps.
            </p>
          </div>
        </div>

        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
          Research question
        </label>
        <textarea
          autoFocus
          rows={4}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onBlur={() => setShowHint(trimmed.length > 0 && trimmed.length < HINT_THRESHOLD_LENGTH)}
          placeholder="Example: In adults with asthma, do biologic therapies improve symptom control?"
          className="w-full resize-y border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400"
        />
        {showHint && (
          <p className="text-[11px] text-slate-400 mt-1.5">
            Tip: strong research questions usually name a population, an intervention or focus, and an outcome you're measuring.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-3 mb-5">
          {EXAMPLE_QUESTIONS.map(example => (
            <button
              key={example}
              onClick={() => { setQuestion(example); setShowHint(false) }}
              className="text-[11px] text-left text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Create Review {!submitting && <ArrowRight size={14} />}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({ review, onOpen, onDeleteRequest }: {
  review: SystematicReview
  onOpen: () => void
  onDeleteRequest: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onOpen}
      className="group flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 cursor-pointer transition-colors"
    >
      <div className="w-8 h-8 shrink-0 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-[11px] font-bold">
        SR
      </div>

      <div className="min-w-0 flex-1">
        <p
          title={review.researchQuestion ?? undefined}
          className="text-[13px] font-semibold text-slate-800 group-hover:text-violet-600 transition-colors truncate leading-snug"
        >
          {review.researchQuestion || 'Untitled systematic review'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {review.paperCount} paper{review.paperCount === 1 ? '' : 's'} · Created {formatDate(review.createdAt)}
        </p>
      </div>

      <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0', STATUS_STYLES[review.status])}>
        {STATUS_LABELS[review.status]}
      </span>

      <button
        onClick={e => { e.stopPropagation(); onDeleteRequest() }}
        title="Delete"
        className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SystematicReviewPage() {
  const navigate = useNavigate()
  const store = useSystematicReviewStore()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [newReviewPath, setNewReviewPath] = useState<ReviewCreationPath | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SystematicReview | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('systematic_review_hide_onboarding') !== 'true',
  )

  const dismissOnboarding = () => {
    localStorage.setItem('systematic_review_hide_onboarding', 'true')
    setShowOnboarding(false)
  }
  const restoreOnboarding = () => {
    localStorage.removeItem('systematic_review_hide_onboarding')
    setShowOnboarding(true)
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset paging whenever the search changes, so a shorter result set can't
  // leave visibleCount pointing past the end of it.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [debouncedSearch])

  useEffect(() => {
    store.loadReviews(debouncedSearch || undefined)
      .catch(() => {})
      .finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const reviews = store.reviews
  const hasAnyReviews = loaded && reviews.length > 0
  const showListArea = hasAnyReviews || debouncedSearch !== ''
  const visibleReviews = reviews.slice(0, visibleCount)
  const hasMore = reviews.length > visibleReviews.length

  const handleReviewCreated = (review: SystematicReview) => {
    setNewReviewPath(null)
    navigate(`/app/systematic-review/${review.id}`)
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    await store.deleteReview(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="w-full px-6 py-8">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        {/* Matches Proposal Studio's header: plain H1 + subtitle, no eyebrow —
            the top app header (AppNavbar) already states the page name once. */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Systematic Reviews</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              {loaded ? `${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!showOnboarding && (
              <button
                onClick={restoreOnboarding}
                className="text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors mr-1"
              >
                Show tips
              </button>
            )}
            <button
              onClick={() => setNewReviewPath('UploadOwn')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 text-[13px] font-semibold transition-colors"
            >
              <Upload size={14} /> Import Papers
            </button>
            <button
              onClick={() => setNewReviewPath('PrismaFirst')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-md shadow-violet-200"
            >
              + New Review
            </button>
          </div>
        </div>

        {/* ── Creation cards ────────────────────────────────────────────────── */}
        {showOnboarding && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] text-slate-500 font-medium">What can you do with Systematic Review?</p>
            <button
              onClick={dismissOnboarding}
              title="Hide tips"
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', showListArea ? 'mb-8' : 'mb-2')}>
            {CREATION_CARDS.map(card => (
              <div
                key={card.path}
                className="flex flex-col bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-4 border', card.bg, card.color)}>
                  {card.icon}
                </div>
                <h3 className="text-[14px] font-bold text-slate-800 leading-snug mb-2 flex-1">{card.title}</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed mb-4">{card.subtitle}</p>
                <button
                  onClick={() => setNewReviewPath(card.path)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200"
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
        )}

        {showListArea && (
          <>
            {/* ── Search ────────────────────────────────────────────────────── */}
            <div className="relative max-w-xs w-full mb-4">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reviews..."
                className="w-full pl-8 pr-4 py-2 text-[13px] text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400"
              />
            </div>

            {/* ── Review list ───────────────────────────────────────────────── */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <AnimatePresence>
                {reviews.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                        <ClipboardList size={22} className="text-slate-400" />
                      </div>
                      <p className="text-[14px] text-slate-600 font-medium">No reviews found</p>
                      <p className="text-[12px] text-slate-400">No reviews match "{debouncedSearch}".</p>
                    </div>
                  </div>
                ) : (
                  visibleReviews.map(review => (
                    <ReviewRow
                      key={review.id}
                      review={review}
                      onOpen={() => navigate(`/app/systematic-review/${review.id}`)}
                      onDeleteRequest={() => setPendingDelete(review)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="flex items-center justify-center pt-4">
                <button
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                >
                  Load more ({reviews.length - visibleReviews.length} remaining)
                </button>
              </div>
            )}
          </>
        )}

      </div>

      <AnimatePresence>
        {newReviewPath && (
          <NewReviewModal
            creationPath={newReviewPath}
            onClose={() => setNewReviewPath(null)}
            onCreated={handleReviewCreated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <DeleteModal
            review={pendingDelete}
            onClose={() => setPendingDelete(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
