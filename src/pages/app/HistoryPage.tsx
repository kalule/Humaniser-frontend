import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search,
  FileX,
  Clock,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Zap,
  Wand2,
  RefreshCw,
} from 'lucide-react'
import { cn, truncate, formatNumber } from '../../lib/utils'
import { useHumaniserStore } from '../../store/humaniserStore'
import { humaniseApi } from '../../api/humanise'
import { Badge } from '../../components/ui/Badge'
import type { HistoryItem, Tone } from '../../types'

// ─── Relative time helper ─────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-white/10 rounded-full" />
        <div className="h-5 w-16 bg-white/10 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-white/10 rounded-full" />
        <div className="h-3 w-4/5 bg-white/10 rounded-full" />
      </div>
      <div className="flex items-center justify-center">
        <div className="h-3 w-3 bg-white/10 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-white/10 rounded-full" />
        <div className="h-3 w-3/4 bg-white/10 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="h-7 w-28 bg-white/10 rounded-md" />
        <div className="h-7 w-16 bg-white/10 rounded-md" />
      </div>
    </div>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({
  onConfirm,
  onCancel,
  isDeleting,
}: {
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative bg-card border border-border rounded-lg p-6 max-w-sm w-full shadow-elevated"
      >
        <h3 className="text-base font-semibold text-text-main mb-2">Delete History Item</h3>
        <p className="text-sm text-muted mb-5">
          Are you sure you want to delete this history item? This action cannot be undone.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-text-main bg-white/5 hover:bg-white/10 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
          >
            {isDeleting && (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── History card ─────────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onRestore,
}: {
  item: HistoryItem
  onRestore: (item: HistoryItem) => void
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => humaniseApi.deleteHistory(item.id),
    onSuccess: () => {
      toast.success('History item deleted')
      queryClient.invalidateQueries({ queryKey: ['history'] })
      setShowDeleteModal(false)
    },
    onError: () => {
      toast.error('Failed to delete history item')
    },
  })

  const toneBadgeVariant = 'tone' as const

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-border/80 hover:shadow-card transition-all duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted min-w-0">
            <Clock size={11} className="shrink-0" />
            <span className="truncate">{timeAgo(item.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={toneBadgeVariant} className="capitalize">
              {item.tone}
            </Badge>
            <span className="text-xs text-muted">{formatNumber(item.wordCount)}w</span>
          </div>
        </div>

        {/* Input preview */}
        <div>
          <p className="text-xs text-muted/60 uppercase tracking-wider font-medium mb-1">Original</p>
          <p className="text-xs text-muted leading-relaxed">
            {truncate(item.inputText, 100)}
          </p>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <ArrowRight size={14} className="text-primary/50" />
        </div>

        {/* Output preview */}
        <div>
          <p className="text-xs text-muted/60 uppercase tracking-wider font-medium mb-1">Humanised</p>
          <p className="text-xs text-text-main/80 leading-relaxed">
            {truncate(item.outputText, 100)}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
          <button
            type="button"
            onClick={() => onRestore(item)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-secondary transition-colors"
          >
            <RotateCcw size={12} />
            Restore to Editor
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-white/5 text-muted">
              <Zap size={9} className="text-primary" />
              {item.processingTimeMs}ms
            </span>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showDeleteModal && (
          <DeleteModal
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => setShowDeleteModal(false)}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Main HistoryPage ─────────────────────────────────────────────────────────

const TONE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Tones' },
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'academic', label: 'Academic' },
  { value: 'conversational', label: 'Conversational' },
]

export function HistoryPage() {
  const { setInputText, setTone, setStrength } = useHumaniserStore()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [toneFilter, setToneFilter] = useState<Tone | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [toneFilter, dateFrom, dateTo])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['history', { page, tone: toneFilter, from: dateFrom, to: dateTo, search: debouncedSearch }],
    queryFn: () =>
      humaniseApi
        .getHistory({
          page,
          pageSize: 9,
          tone: toneFilter ? (toneFilter as Tone) : undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const handleRestore = useCallback(
    (item: HistoryItem) => {
      setInputText(item.inputText)
      setTone(item.tone)
      setStrength(item.strength)
      toast.success('Restored to editor!')
      navigate('/app/humaniser')
    },
    [setInputText, setTone, setStrength, navigate],
  )

  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const hasNext = data?.hasNextPage ?? false
  const hasPrev = data?.hasPreviousPage ?? false

  return (
    <div className="min-h-screen bg-dark px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-main">History</h1>
          <p className="text-sm text-muted mt-1">Your past humanisations</p>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history…"
            className="w-full bg-card border border-border rounded-md pl-10 pr-4 py-2.5 text-sm text-text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={toneFilter}
            onChange={(e) => setToneFilter(e.target.value as Tone | '')}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            {TONE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">
                {o.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-card border border-border rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-card border border-border rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all [color-scheme:dark]"
            />
          </div>

          {(toneFilter || dateFrom || dateTo || search) && (
            <button
              type="button"
              onClick={() => {
                setToneFilter('')
                setDateFrom('')
                setDateTo('')
                setSearch('')
              }}
              className="text-xs text-muted hover:text-text-main transition-colors underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Grid */}
        {isError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <FileX size={24} className="text-red-400" />
            </div>
            <p className="text-text-main font-semibold mb-1">Failed to load history</p>
            <p className="text-sm text-muted mb-5">Something went wrong connecting to the server.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-border text-sm font-medium text-text-main hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
          </motion.div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            {debouncedSearch || toneFilter || dateFrom || dateTo ? (
              /* ── Filtered empty state ── */
              <>
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Search size={22} className="text-muted/50" />
                </div>
                <p className="text-text-main font-semibold mb-1">No results found</p>
                <p className="text-sm text-muted mb-5">No history items match your current filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setToneFilter('')
                    setDateFrom('')
                    setDateTo('')
                    setSearch('')
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-border text-sm font-medium text-text-main hover:bg-white/10 transition-colors"
                >
                  <RefreshCw size={14} />
                  Clear Filters
                </button>
              </>
            ) : (
              /* ── First-time empty state ── */
              <>
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                  <Wand2 size={28} className="text-indigo-400" />
                </div>
                <p className="text-text-main font-semibold text-lg mb-2">No history yet</p>
                <p className="text-sm text-muted max-w-xs mb-6 leading-relaxed">
                  Every text you humanise is saved here so you can review, restore, or reuse it later.
                </p>
                <Link
                  to="/app/humaniser"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-indigo-900/30"
                >
                  <Wand2 size={16} />
                  Humanise your first text
                </Link>
              </>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {!isLoading && items.length > 0 && (
          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                hasPrev
                  ? 'bg-card border border-border text-text-main hover:bg-white/5'
                  : 'bg-card/50 border border-border/50 text-muted cursor-not-allowed',
              )}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <span className="text-sm text-muted">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                hasNext
                  ? 'bg-card border border-border text-text-main hover:bg-white/5'
                  : 'bg-card/50 border border-border/50 text-muted cursor-not-allowed',
              )}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
