import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Trash2, Wand2, Clock, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { AppNavbar } from '../components/layout/AppNavbar'
import { detectorApi } from '../api/detector'
import { cn } from '../lib/utils'
import type { DetectionHistoryItem } from '../types/detector'

function getScoreColor(humanScore: number): string {
  if (humanScore >= 80) return 'text-emerald-400'
  if (humanScore >= 60) return 'text-lime-400'
  if (humanScore >= 40) return 'text-amber-400'
  if (humanScore >= 20) return 'text-orange-400'
  return 'text-red-400'
}

function MiniScoreCircle({ humanScore }: { humanScore: number }) {
  const r = 22
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - humanScore / 100)
  const stroke = humanScore >= 80 ? '#10B981' : humanScore >= 60 ? '#84CC16' : humanScore >= 40 ? '#F59E0B' : humanScore >= 20 ? '#F97316' : '#EF4444'

  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#334155" strokeWidth="5" />
      <circle
        cx="30" cy="30" r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transformOrigin: '30px 30px', transform: 'rotate(-90deg)' }}
      />
      <text x="30" y="34" textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="700">
        {humanScore}%
      </text>
    </svg>
  )
}

function HistoryCard({ item, onDelete }: { item: DetectionHistoryItem; onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (mins > 0) return `${mins}m ago`
    return 'Just now'
  }

  const handleRestore = () => {
    sessionStorage.setItem('humanise_input', item.inputPreview.replace(/\.\.\.$/, ''))
    navigate('/app/detector')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex gap-4 items-start"
    >
      <MiniScoreCircle humanScore={item.humanScore} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={cn('text-sm font-semibold', getScoreColor(item.humanScore))}>
            {item.verdict}
          </span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <FileText size={11} />
            {item.wordCount} words
          </span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock size={11} />
            {relativeTime(item.createdAt)}
          </span>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{item.inputPreview}</p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleRestore}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                       bg-indigo-500/15 text-indigo-300 border border-indigo-500/20
                       hover:bg-indigo-500/25 transition-colors"
          >
            <Wand2 size={11} />
            Analyse again
          </button>

          {confirming ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                         text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={11} />
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function DetectorHistoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const pageSize = 15

  const { data, isLoading } = useQuery({
    queryKey: ['detector-history', page],
    queryFn: () => detectorApi.getHistory(page, pageSize),
  })

  const deleteMutation = useMutation({
    mutationFn: detectorApi.deleteHistoryItem,
    onSuccess: () => {
      toast.success('Deleted.')
      queryClient.invalidateQueries({ queryKey: ['detector-history'] })
    },
    onError: () => toast.error('Delete failed.'),
  })

  const filteredItems = (data?.items ?? []).filter((item) =>
    search === '' || item.inputPreview.toLowerCase().includes(search.toLowerCase()) ||
    item.verdict.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil((data?.totalCount ?? 0) / pageSize)

  return (
    <div className="min-h-screen bg-slate-900">
      <AppNavbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate('/app/detector')}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Back to Detector
          </button>
          <div className="flex-1" />
          <h1 className="text-xl font-bold text-slate-100">Detection History</h1>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search history…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-5 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                     text-slate-200 placeholder:text-slate-500 focus:outline-none
                     focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 text-sm"
        />

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 bg-slate-800 border border-slate-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={40} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No detection history yet</p>
            <p className="text-slate-500 text-sm mt-1">Analysed texts will appear here</p>
            <button
              type="button"
              onClick={() => navigate('/app/detector')}
              className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              Start Detecting
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700
                         text-slate-400 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="text-slate-400 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700
                         text-slate-400 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
