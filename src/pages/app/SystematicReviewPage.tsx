import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, X, Loader2, ClipboardList, FileSearch, UploadCloud, ArrowRight, Eye,
  Plus, ChevronDown, ChevronUp, CheckCircle2, FileText,
} from 'lucide-react'
import { cn, formatShortDate } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import type { ReviewCreationPath, SystematicReview, SystematicReviewStatus } from '../../types/systematicReview'
import { screeningLedgerApi } from '../../api/screeningLedger'
import type { SharedReview } from '../../types/screeningLedger'

// ── Constants ─────────────────────────────────────────────────────────────────

const PATH_OPTIONS: {
  path:        ReviewCreationPath
  icon:        React.ReactNode
  title:       string
  description: string
}[] = [
  {
    path:        'PrismaFirst',
    icon:        <ClipboardList size={15} />,
    title:       'Start from a research question',
    description: "Describe what you want to answer; we'll set up the review workspace.",
  },
  {
    path:        'DatabaseSearch',
    icon:        <FileSearch size={15} />,
    title:       'Search databases',
    description: 'Search literature sources and build the review from the results.',
  },
  {
    path:        'UploadOwn',
    icon:        <UploadCloud size={15} />,
    title:       'Import papers you already have',
    description: 'Upload files or import from connected academic databases.',
  },
]

// Eyebrow-only labels for NewReviewModal — creationPath has no effect on
// workspace behaviour today (see discovery), so this just reflects back the
// user's chosen starting intent rather than implying a different flow.
const PATH_EYEBROWS: Record<ReviewCreationPath, string> = {
  PrismaFirst:    'Research question',
  DatabaseSearch: 'Database search',
  UploadOwn:      'Import papers',
}

const PAGE_SIZE = 25
const DISCLOSURE_KEY = 'systematic_review_hide_disclosure'

type SortBy = 'updated' | 'title' | 'created'

const STATUS_STYLES: Record<SystematicReviewStatus, string> = {
  Draft:      'bg-slate-100 text-slate-500',
  InProgress: 'bg-amber-tint text-amber-text',
  Completed:  'bg-green-tint text-green-text',
}

const STATUS_LABELS: Record<SystematicReviewStatus, string> = {
  Draft: 'Draft', InProgress: 'In progress', Completed: 'Completed',
}

// Data-driven so these can be swapped for domain-relevant examples later.
const EXAMPLE_QUESTIONS = [
  'In adults with asthma, do biologic therapies improve symptom control compared with standard care?',
  'Among undergraduate students, how effective are spaced-repetition interventions for long-term retention?',
  'In patients with type 2 diabetes, does continuous glucose monitoring improve glycemic outcomes?',
]

const MIN_QUESTION_LENGTH = 15
// Below this length the question likely lacks a population/intervention/outcome — nudge, don't block.
const HINT_THRESHOLD_LENGTH = 30

// ── Delete confirmation modal ──────────────────────────────────────────────────

function DeleteModal({
  review,
  onClose,
  onConfirm,
}: {
  review:    SystematicReview
  onClose:   () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6"
      >
        <button onClick={onClose} disabled={loading} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40">
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
            disabled={loading}
            className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl transition-colors disabled:opacity-40"
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

function NewReviewModal({
  creationPath,
  existingQuestions,
  onClose,
  onCreated,
}: {
  creationPath:      ReviewCreationPath
  existingQuestions: string[]
  onClose:           () => void
  onCreated:         (review: SystematicReview) => void
}) {
  const store = useSystematicReviewStore()
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = question.trim()
  const isValid = trimmed.length >= MIN_QUESTION_LENGTH
  const looksWellFormed = trimmed.length >= HINT_THRESHOLD_LENGTH && trimmed.endsWith('?')
  const canSubmit = isValid && !submitting

  // Never offer an example that would create a duplicate of an existing review.
  const visibleExamples = useMemo(() => {
    const existing = new Set(existingQuestions.map(q => q.trim().toLowerCase()))
    return EXAMPLE_QUESTIONS.filter(q => !existing.has(q.trim().toLowerCase()))
  }, [existingQuestions])

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const review = await store.createReview({ researchQuestion: trimmed, creationPath })
      onCreated(review)
    } catch {
      setError('Could not create the review. Please try again.')
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !submitting) { onClose(); return }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleSubmit() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6"
      >
        <button onClick={onClose} disabled={submitting} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40">
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--color-purple-tint)] text-[var(--color-purple-text)] flex items-center justify-center">
            <ClipboardList size={18} />
          </div>
          <div>
            <p className="text-[11px] text-[var(--color-purple-text)] font-semibold uppercase tracking-widest mb-1">
              {PATH_EYEBROWS[creationPath]}
            </p>
            <h3 className="text-[17px] font-bold text-slate-900">New systematic review</h3>
            <p className="text-[13px] text-slate-500 mt-1">
              Enter one research question. We'll create the review workspace and guide the next steps.
            </p>
          </div>
        </div>

        <label htmlFor="sr-research-question" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
          Research question
        </label>
        <textarea
          id="sr-research-question"
          autoFocus
          rows={4}
          value={question}
          disabled={submitting}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Type your research question"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          className="w-full resize-none border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-[var(--color-purple)] focus:ring-2 focus:ring-[var(--color-purple-tint)] transition placeholder-slate-400 disabled:opacity-60 disabled:bg-slate-50"
        />
        <p className={cn(
          'text-[11px] mt-1.5 flex items-center gap-1',
          looksWellFormed ? 'text-[var(--color-purple-text)]' : 'text-slate-400',
        )}>
          {looksWellFormed && <CheckCircle2 size={12} />}
          {looksWellFormed
            ? 'Looks like a well-formed question.'
            : "Tip: include who, what you're testing, and the outcome."}
        </p>

        {visibleExamples.length > 0 && (
          <div className="mt-3 mb-5">
            <p className="text-[11px] font-medium text-slate-400 mb-1.5">Or try an example</p>
            <div className="flex flex-wrap gap-2">
              {visibleExamples.map(example => (
                <button
                  key={example}
                  type="button"
                  disabled={submitting}
                  onClick={() => setQuestion(example)}
                  className="text-[11px] text-left text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {visibleExamples.length === 0 && <div className="mb-5" />}

        {error && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Ctrl + Enter to create</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition-colors',
                canSubmit
                  ? 'bg-purple-accent hover:bg-purple-deep text-white'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed',
              )}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? 'Creating…' : 'Create review'}
              {!submitting && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SystematicReviewPage() {
  const navigate = useNavigate()
  const store = useSystematicReviewStore()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [newReviewPath, setNewReviewPath] = useState<ReviewCreationPath | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SystematicReview | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [disclosureOpen, setDisclosureOpen] = useState(() => {
    try { return localStorage.getItem(DISCLOSURE_KEY) === 'true' } catch { return false }
  })
  const [newReviewMenuOpen, setNewReviewMenuOpen] = useState(false)
  const newReviewMenuRef = useRef<HTMLDivElement>(null)
  const newReviewTriggerRef = useRef<HTMLButtonElement>(null)
  const menuItemRefs = useRef<(HTMLElement | null)[]>([])

  const toggleDisclosure = () => {
    setDisclosureOpen(open => {
      const next = !open
      try { localStorage.setItem(DISCLOSURE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  const closeNewReviewMenu = (returnFocus: boolean) => {
    setNewReviewMenuOpen(false)
    if (returnFocus) newReviewTriggerRef.current?.focus()
  }

  useEffect(() => {
    if (!newReviewMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (!newReviewMenuRef.current?.contains(e.target as Node)) setNewReviewMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [newReviewMenuOpen])

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      setNewReviewMenuOpen(true)
      requestAnimationFrame(() => menuItemRefs.current[0]?.focus())
    }
  }

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = menuItemRefs.current.filter(Boolean) as HTMLElement[]
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); closeNewReviewMenu(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(currentIndex + 1) % items.length]?.focus(); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); items[(currentIndex - 1 + items.length) % items.length]?.focus(); return }
    if (e.key === 'Home')      { e.preventDefault(); items[0]?.focus(); return }
    if (e.key === 'End')       { e.preventDefault(); items[items.length - 1]?.focus(); return }
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

  // Reviews other people own that this user was added to as a screener.
  const [shared, setShared] = useState<SharedReview[]>([])
  useEffect(() => {
    screeningLedgerApi.listShared().then(setShared).catch(() => setShared([]))
  }, [])

  const reviews = store.reviews
  const hasAnyReviews = loaded && reviews.length > 0
  const showListArea = hasAnyReviews || debouncedSearch !== ''

  const sorted = useMemo(() => {
    const copy = [...reviews]
    if (sortBy === 'title') copy.sort((a, b) => (a.researchQuestion || '').localeCompare(b.researchQuestion || ''))
    else if (sortBy === 'created') copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return copy
  }, [reviews, sortBy])

  const visibleReviews = sorted.slice(0, visibleCount)
  const hasMore = sorted.length > visibleReviews.length

  const documentEntries: DocumentListEntry[] = visibleReviews.map(review => {
    const needsPapers = review.paperCount === 0
    const openReview = () => navigate(`/app/systematic-review/${review.id}`)
    return {
      id: review.id,
      icon: <ClipboardList size={16} />,
      iconClassName: 'bg-[var(--color-purple-tint)] border-transparent text-[var(--color-purple-text)]',
      title: review.researchQuestion || 'Untitled systematic review',
      metaLine: `Created ${formatShortDate(review.createdAt)} · Updated ${formatShortDate(review.updatedAt)}`,
      statusBadge: needsPapers
        ? { label: 'Add papers', className: 'bg-[var(--color-purple-tint)] text-[var(--color-purple-text)]' }
        : { label: STATUS_LABELS[review.status], className: STATUS_STYLES[review.status] },
      onOpen: openReview,
      inlineActions: [
        needsPapers
          ? {
              key: 'add-papers',
              icon: <UploadCloud size={14} />,
              label: 'Add papers',
              onClick: (e) => { e.stopPropagation(); navigate(`/app/systematic-review/${review.id}?step=fetch-papers`) },
            }
          : {
              key: 'preview',
              icon: <Eye size={14} />,
              label: 'Preview',
              onClick: (e) => { e.stopPropagation(); openReview() },
            },
      ],
      overflowActions: [
        { key: 'open', icon: <FileText size={14} />, label: 'Open', destructive: false, onClick: () => openReview() },
        { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', onClick: () => setPendingDelete(review) },
      ],
    }
  })

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
        {/* AppNavbar already renders the page's <h1> ("Systematic Review") —
            this body only adds the review count as a subtitle, not a second,
            disagreeing heading (it used to say "Systematic Reviews"). */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <p className="text-[13px] text-slate-500 mt-1">
            {loaded ? `${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>

          {/* The only filled-purple CTA on this page. */}
          <div className="relative shrink-0" ref={newReviewMenuRef}>
            <button
              ref={newReviewTriggerRef}
              onClick={() => setNewReviewMenuOpen(v => !v)}
              onKeyDown={handleTriggerKeyDown}
              aria-haspopup="menu"
              aria-expanded={newReviewMenuOpen}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold transition-colors shadow-sm"
            >
              <Plus size={14} /> New review <ChevronDown size={14} className={cn('transition-transform', newReviewMenuOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {newReviewMenuOpen && (
                <motion.div
                  role="menu"
                  aria-label="New review"
                  onKeyDown={handleMenuKeyDown}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden py-1.5 z-30"
                >
                  {PATH_OPTIONS.map((opt, i) => (
                    <button
                      key={opt.path}
                      ref={el => { menuItemRefs.current[i] = el }}
                      role="menuitem"
                      onClick={() => { closeNewReviewMenu(false); setNewReviewPath(opt.path) }}
                      className="flex items-start gap-2.5 w-full px-3.5 py-2.5 text-left hover:bg-slate-50 focus:bg-slate-50 outline-none transition-colors"
                    >
                      <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-[var(--color-purple-tint)] text-[var(--color-purple-text)]">
                        {opt.icon}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-semibold text-slate-800">{opt.title}</span>
                        <span className="text-[12px] text-slate-600">{opt.description}</span>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {shared.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[13px] font-bold text-slate-800 mb-2">Shared with me for screening</h2>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {shared.map(r => (
                <button key={r.reviewId} onClick={() => navigate(`/app/systematic-review/${r.reviewId}/screen`)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/60">
                  <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate">{r.researchQuestion || 'Untitled review'}</span>
                  <span className="text-[11px] text-slate-500">{r.ownerEmail} · {r.role === 'Adjudicator' ? 'screen and adjudicate' : 'screen'}</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        )}


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
                {PATH_OPTIONS.map(opt => (
                  <p key={opt.path} className="text-[12px] text-slate-500 flex items-start gap-2">
                    <span className="text-[var(--color-purple-text)] mt-0.5 shrink-0">{opt.icon}</span>
                    <span><span className="font-medium text-slate-700">{opt.title}.</span> {opt.description}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state (no reviews at all yet) ──────────────────────────── */}
        {loaded && !hasAnyReviews && debouncedSearch === '' && (
          <div className="border border-slate-200 rounded-xl py-12 px-6 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-purple-tint)] flex items-center justify-center">
              <ClipboardList size={22} className="text-[var(--color-purple-text)]" />
            </div>
            <div>
              <p className="text-[14px] text-slate-700 font-semibold mb-1">No systematic reviews yet</p>
              <p className="text-[12px] text-slate-500 max-w-sm">
                Use <span className="font-medium">+ New review</span> above to start from a research question, search databases, or import papers you already have.
              </p>
            </div>
          </div>
        )}

        {showListArea && (
          <>
            <div className="mt-2">
              <DocumentList
                entries={documentEntries}
                totalCount={reviews.length}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search reviews..."
                headerRight={
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortBy)}
                    aria-label="Sort reviews"
                    className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-tint transition"
                  >
                    <option value="updated">Last modified</option>
                    <option value="title">Title</option>
                    <option value="created">Created</option>
                  </select>
                }
                emptyIcon={<ClipboardList size={22} className="text-slate-400" />}
                emptyTitle="No reviews found"
                emptySubtitle={`No reviews match "${debouncedSearch}".`}
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

      <AnimatePresence>
        {newReviewPath && (
          <NewReviewModal
            creationPath={newReviewPath}
            existingQuestions={reviews.map(r => r.researchQuestion).filter((q): q is string => !!q)}
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
