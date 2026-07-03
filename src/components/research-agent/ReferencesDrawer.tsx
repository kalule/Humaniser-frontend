import { motion } from 'framer-motion'
import { BookMarked, ChevronRight, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ParsedReference } from '../../lib/citationFormat'
import type { CitationStyle } from '../../types/research'

interface ReferencesDrawerProps {
  open:          boolean
  onClose:       () => void
  loading:       boolean
  entries:       ParsedReference[]
  citationStyle: CitationStyle
  onInsert:      (ref: ParsedReference, index: number) => void
  onRefresh:     () => void
  onManageFull:  () => void
}

const CITATION_LABELS: Record<CitationStyle, string> = {
  apa7:    'APA 7',
  harvard: 'Harvard',
  mla:     'MLA',
  ieee:    'IEEE',
}

export function ReferencesDrawer({
  open, onClose, loading, entries, citationStyle, onInsert, onRefresh, onManageFull,
}: ReferencesDrawerProps) {
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
          <BookMarked size={16} className="text-[#7c3aed]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 leading-none">References</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {loading ? 'Compiling…' : `${entries.length} reference${entries.length !== 1 ? 's' : ''} · ${CITATION_LABELS[citationStyle]}`}
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
            <p className="text-[12px] text-slate-400">Compiling bibliography…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <BookMarked size={22} className="text-slate-300" />
            <p className="text-[12px] text-slate-500 font-medium">No references yet</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Generate at least one section first, then refresh this panel.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((ref, i) => (
              <li key={ref.id} className="group relative rounded-lg border border-slate-100 hover:border-[#ddd6fe] hover:bg-[#faf5ff] transition-colors">
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <p className="flex-1 min-w-0 text-[12px] text-slate-600 leading-relaxed line-clamp-3">
                    {ref.raw}
                  </p>
                  <button
                    onClick={() => onInsert(ref, i)}
                    title="Insert citation at cursor"
                    className={cn(
                      'shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all',
                      'bg-[#ede9fe] text-[#7c3aed] opacity-70 group-hover:opacity-100 hover:bg-[#7c3aed] hover:text-white',
                    )}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-3 py-2.5 shrink-0">
        <button
          onClick={onManageFull}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] text-slate-500 hover:text-[#7c3aed] hover:bg-[#faf5ff] transition-colors"
        >
          <span>Manage full bibliography</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </motion.div>
  )
}
