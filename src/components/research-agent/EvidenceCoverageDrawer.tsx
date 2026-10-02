import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SectionEvidenceCoverageAudit } from '../../types/research'

interface EvidenceCoverageDrawerProps {
  open:    boolean
  onClose: () => void
  loading: boolean
  audit:   SectionEvidenceCoverageAudit | null
  onRefresh: () => void
}

export function EvidenceCoverageDrawer({ open, onClose, loading, audit, onRefresh }: EvidenceCoverageDrawerProps) {
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
          <Sparkles size={16} className="text-[#7c3aed]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 leading-none">Evidence Coverage</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            Advisory only — never blocks generation or approval
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
            <p className="text-[12px] text-slate-400">Checking evidence coverage…</p>
          </div>
        ) : !audit ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <Sparkles size={22} className="text-slate-300" />
            <p className="text-[12px] text-slate-500 font-medium">No audit yet</p>
          </div>
        ) : (
          <>
            <section className="mb-4">
              <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Theme coverage
              </h3>
              <ul className="space-y-1.5">
                {audit.claimCoverage.map(c => (
                  <li
                    key={c.claim}
                    className={cn(
                      'flex items-start gap-2 rounded-lg px-3 py-2',
                      c.isShortfall ? 'bg-amber-50' : 'bg-slate-50',
                    )}
                  >
                    {c.isShortfall
                      ? <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      : <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-[12px] text-slate-700 capitalize">{c.claim}</p>
                      <p className="text-[11px] text-slate-400">
                        {c.isShortfall
                          ? 'No strong candidate source found for this theme.'
                          : `${c.recommendedSourceCount} recommended source${c.recommendedSourceCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Off-plan citations {audit.offPlanCitations.length > 0 && `(${audit.offPlanCitations.length})`}
              </h3>
              {audit.offPlanCitations.length === 0 ? (
                <p className="px-1 text-[11.5px] text-slate-400 leading-relaxed">
                  Every citation in this section matches a recommended theme source.
                </p>
              ) : (
                <ul className="space-y-2">
                  {audit.offPlanCitations.map(c => (
                    <li key={c.literatureId} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[11.5px] font-medium text-amber-800 mb-1">{c.citationText}</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{c.literatureTitle}</p>
                      <p className="text-[10.5px] text-amber-700 mt-1">
                        Doesn't clearly match any of this section's evidence themes — worth a second look.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </motion.div>
  )
}
