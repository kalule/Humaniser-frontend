import { motion } from 'framer-motion'
import { Clock, History, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ProjectSectionVersion } from '../../types/research'

interface SectionVersionHistoryDrawerProps {
  open:       boolean
  onClose:    () => void
  loading:    boolean
  versions:   ProjectSectionVersion[]
  restoringVersion: number | null
  onRestore:  (versionNumber: number) => void
  onRefresh:  () => void
}

const ORIGIN_LABELS: Record<string, string> = {
  Generated:          'Generated',
  Regenerated:        'Regenerated',
  StudentEdited:      'Hand-edited',
  Restored:           'Restored',
  ImportedFromProposal: 'Imported',
}

const ORIGIN_STYLES: Record<string, string> = {
  Generated:          'bg-violet-50 text-violet-600',
  Regenerated:        'bg-violet-50 text-violet-600',
  StudentEdited:      'bg-sky-50 text-sky-600',
  Restored:           'bg-amber-50 text-amber-600',
  ImportedFromProposal: 'bg-slate-100 text-slate-500',
}

function formatDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function SectionVersionHistoryDrawer({
  open, onClose, loading, versions, restoringVersion, onRestore, onRefresh,
}: SectionVersionHistoryDrawerProps) {
  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      className="fixed top-0 right-0 bottom-0 w-[360px] bg-white shadow-2xl border-l border-slate-100 z-40 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0">
          <History size={16} className="text-[#7c3aed]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 leading-none">Version History</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {loading ? 'Loading…' : `${versions.length} prior version${versions.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button
          onClick={onRefresh}
          title="Refresh"
          disabled={loading}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <Loader2 size={20} className="animate-spin text-[#7c3aed]" />
            <p className="text-[12px] text-slate-400">Loading version history…</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <Clock size={22} className="text-slate-300" />
            <p className="text-[12px] text-slate-500 font-medium">No prior versions yet</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              A version is saved automatically the first time this section is regenerated or hand-edited after a draft.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {versions.map(v => (
              <li key={v.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', ORIGIN_STYLES[v.changeOrigin] ?? 'bg-slate-100 text-slate-500')}>
                    {ORIGIN_LABELS[v.changeOrigin] ?? v.changeOrigin}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">v{v.versionNumber}</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-1.5">{formatDate(v.createdAt)} · {v.wordCount.toLocaleString()} words</p>
                <p className="text-[11.5px] text-slate-600 leading-relaxed line-clamp-3 mb-2">{v.content}</p>
                <button
                  onClick={() => onRestore(v.versionNumber)}
                  disabled={restoringVersion !== null}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7c3aed] hover:text-[#6d28d9] disabled:opacity-40 transition-colors"
                >
                  {restoringVersion === v.versionNumber
                    ? <Loader2 size={11} className="animate-spin" />
                    : <RotateCcw size={11} />}
                  Restore this version
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  )
}
