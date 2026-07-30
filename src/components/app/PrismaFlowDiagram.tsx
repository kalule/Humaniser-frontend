import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowDown, Download, Loader2, X } from 'lucide-react'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { downloadBlob } from '../../lib/utils'
import type { PrismaFlow } from '../../types/systematicReview'

interface PrismaFlowDiagramProps {
  reviewId: string
  onClose:  () => void
}

function FlowBox({ label, count, sub }: { label: string; count: number; sub?: string }) {
  return (
    <div className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 bg-white text-center">
      <p className="text-[22px] font-bold text-slate-900 tabular-nums leading-none mb-1">{count.toLocaleString()}</p>
      <p className="text-[12px] font-semibold text-slate-700">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function ExcludedNote({ lines }: { lines: { label: string; value: number }[] }) {
  const visible = lines.filter(l => l.value > 0)
  if (visible.length === 0) return null
  return (
    <div className="border border-amber-accent/30 bg-amber-tint rounded-lg px-3 py-2 max-w-[220px]">
      {visible.map(l => (
        <div key={l.label} className="flex items-center justify-between gap-3 text-[11px] text-amber-900">
          <span>{l.label}</span>
          <span className="font-semibold tabular-nums">{l.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center py-1.5">
      <ArrowDown size={16} className="text-slate-300" />
    </div>
  )
}

function FlowStage({ box, excluded }: { box: React.ReactNode; excluded?: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-4">
      <div className="flex-1">{box}</div>
      {excluded && <div className="flex items-center shrink-0">{excluded}</div>}
    </div>
  )
}

export default function PrismaFlowDiagram({ reviewId, onClose }: PrismaFlowDiagramProps) {
  const getPrismaFlow = useSystematicReviewStore(s => s.getPrismaFlow)
  const [flow, setFlow] = useState<PrismaFlow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    getPrismaFlow(reviewId)
      .then(data => { if (!cancelled) setFlow(data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId])

  const handleDownload = async () => {
    if (!flow) return
    setDownloading(true)
    try {
      downloadBlob(new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' }), 'prisma-flow.json')
    } finally {
      setDownloading(false)
    }
  }

  const duplicatesRemoved = flow ? flow.duplicatesRemovedByDoi + flow.duplicatesRemovedByTitle : 0
  const mechanicallyExcluded = flow
    ? flow.excludedWithoutAbstract + flow.excludedByPublicationDate + flow.excludedByCitationThreshold
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1">PRISMA 2020</p>
        <h3 className="text-[17px] font-bold text-slate-900 mb-4">Study selection flow diagram</h3>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : error || !flow ? (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-600">Couldn't load PRISMA counts. Please try again.</p>
          </div>
        ) : (
          <div className="space-y-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Identification</p>
            <FlowBox
              label="Records identified from databases"
              count={flow.retrieved}
              sub={Object.entries(flow.retrievedBySource).filter(([, n]) => n > 0).map(([src, n]) => `${src} (${n})`).join(' · ') || undefined}
            />
            <Arrow />

            <FlowStage
              box={<FlowBox label="Records screened" count={flow.readyForScreening} />}
              excluded={
                <ExcludedNote
                  lines={[
                    { label: 'Duplicates removed (DOI)', value: flow.duplicatesRemovedByDoi },
                    { label: 'Duplicates removed (title)', value: flow.duplicatesRemovedByTitle },
                    { label: 'No abstract', value: flow.excludedWithoutAbstract },
                    { label: 'Outside date range', value: flow.excludedByPublicationDate },
                    { label: 'Below citation threshold', value: flow.excludedByCitationThreshold },
                  ]}
                />
              }
            />
            {(duplicatesRemoved > 0 || mechanicallyExcluded > 0) && (
              <p className="text-[10px] text-slate-400 text-right mt-1 mb-1">
                {duplicatesRemoved + mechanicallyExcluded} removed before screening
              </p>
            )}
            <Arrow />

            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 mt-3">Screening</p>
            <FlowStage
              box={<FlowBox label="Reports sought for retrieval" count={flow.titleAbstractIncluded} />}
              excluded={
                <ExcludedNote
                  lines={[
                    { label: 'Excluded at title/abstract', value: flow.titleAbstractExcluded },
                    { label: 'Needs manual review', value: flow.titleAbstractNeedsManualReview },
                  ]}
                />
              }
            />
            <Arrow />

            <FlowStage
              box={<FlowBox label="Reports assessed for eligibility" count={flow.fullTextAssessed - flow.fullTextNeedsPdf} />}
              excluded={
                <ExcludedNote
                  lines={[
                    { label: 'Reports not retrieved', value: flow.fullTextNeedsPdf },
                  ]}
                />
              }
            />
            <Arrow />

            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 mt-3">Included</p>
            <FlowStage
              box={<FlowBox label="Studies included in review" count={flow.fullTextIncluded} />}
              excluded={
                <ExcludedNote
                  lines={[
                    { label: 'Excluded at full text', value: flow.fullTextExcluded },
                  ]}
                />
              }
            />
          </div>
        )}

        {flow && (
          <div className="flex justify-end mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors disabled:opacity-60"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Download as JSON
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
