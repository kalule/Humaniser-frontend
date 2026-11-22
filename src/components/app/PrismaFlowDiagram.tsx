import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Download, Loader2, X } from 'lucide-react'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { downloadBlob } from '../../lib/utils'
import { buildPrismaBoxes, layoutPrisma, type PrismaFlowExtended, type PrismaLayout } from '../../lib/prismaLayout'
import { SVG_FONT_FAMILY } from '../../lib/svgText'
import FigureDownloadButtons from './FigureDownloadButtons'

interface PrismaFlowDiagramProps {
  reviewId: string
  onClose:  () => void
}

const INK = '#1f2937'
const MUTED = '#6b7280'
const BOX_STROKE = '#334155'
const PHASE_FILL = '#c6dbef'
const PHASE_INK = '#08306b'

const LINE_FILL: Record<string, string> = { heading: INK, count: INK, detail: '#374151', muted: MUTED }

/**
 * The PRISMA 2020 flow as a standalone SVG: inline presentation attributes only (no CSS classes),
 * so the serialised file and the PNG render exactly like the on-screen figure.
 */
export function PrismaFlowSvg({ layout, svgRef }: { layout: PrismaLayout; svgRef?: React.Ref<SVGSVGElement> }) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width="100%"
      role="img"
      aria-label="PRISMA 2020 flow diagram"
      fontFamily={SVG_FONT_FAMILY}
      style={{ maxWidth: layout.width, height: 'auto', display: 'block' }}
    >
      <title>PRISMA 2020 flow diagram</title>
      <defs>
        <marker id="prisma-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={BOX_STROKE} />
        </marker>
      </defs>
      <rect x={0} y={0} width={layout.width} height={layout.height} fill="#ffffff" />

      {layout.phases.map(p => (
        <g key={p.label}>
          <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={8} fill={PHASE_FILL} />
          <text
            x={p.x + p.width / 2}
            y={p.y + p.height / 2}
            transform={`rotate(-90 ${p.x + p.width / 2} ${p.y + p.height / 2})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fontWeight={700}
            fill={PHASE_INK}
          >
            {p.label}
          </text>
        </g>
      ))}

      {layout.arrows.map((a, i) => (
        <polyline
          key={i}
          points={a.points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={BOX_STROKE}
          strokeWidth={1.5}
          markerEnd="url(#prisma-arrow)"
        />
      ))}

      {layout.boxes.map(b => (
        <g key={b.id} data-box={b.id}>
          <rect x={b.x} y={b.y} width={b.width} height={b.height} fill="#ffffff" stroke={BOX_STROKE} strokeWidth={1.2} />
          {b.lines.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              fontSize={l.fontSize}
              fontWeight={l.bold ? 700 : 400}
              fontStyle={l.kind === 'muted' ? 'italic' : 'normal'}
              fill={LINE_FILL[l.kind]}
            >
              {l.text}
            </text>
          ))}
        </g>
      ))}

      {layout.notes.map((l, i) => (
        <text key={i} x={l.x} y={l.y} fontSize={l.fontSize} fontStyle="italic" fill={MUTED}>{l.text}</text>
      ))}
    </svg>
  )
}

export default function PrismaFlowDiagram({ reviewId, onClose }: PrismaFlowDiagramProps) {
  const getPrismaFlow = useSystematicReviewStore(s => s.getPrismaFlow)
  const [flow, setFlow] = useState<PrismaFlowExtended | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

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

  const layout = useMemo(() => (flow ? layoutPrisma(buildPrismaBoxes(flow)) : null), [flow])

  const handleDownloadJson = () => {
    if (!flow) return
    downloadBlob(new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' }), 'prisma-flow.json')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6"
      >
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1">PRISMA 2020</p>
        <h3 className="text-[17px] font-bold text-slate-900 mb-1">Study selection flow diagram</h3>
        {flow?.countsSource && (
          <p className="text-[12px] text-slate-500 mb-4">
            {flow.countsSource === 'ledger'
              ? "Counts come from reviewers' recorded screening decisions."
              : 'Counts come from AI screening verdicts, with any manual overrides applied.'}
          </p>
        )}

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : error || !flow || !layout ? (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-600">Couldn't load PRISMA counts. Please try again.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <PrismaFlowSvg layout={layout} svgRef={svgRef} />
          </div>
        )}

        {flow && layout && (
          <div className="flex flex-wrap justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            <FigureDownloadButtons svgRef={svgRef} filename="prisma-flow" />
            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors"
            >
              <Download size={13} />
              Download as JSON
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
