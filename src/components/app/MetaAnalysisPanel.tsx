import { useCallback, useEffect, useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp, Loader2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import {
  metaAnalysisApi,
  type EffectDataRow,
  type EffectDataType,
  type MetaAnalysisResponse,
  type OutcomeMetaAnalysis,
  type UpdateEffectDataPayload,
} from '../../api/metaAnalysis'

const f2 = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2))

const STATUS_STYLE: Record<EffectDataRow['status'], string> = {
  Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ReviewerEntered: 'bg-violet-50 text-violet-700 border-violet-200',
  Unverified: 'bg-amber-50 text-amber-700 border-amber-200',
  NotReported: 'bg-slate-50 text-slate-500 border-slate-200',
}
const STATUS_LABEL: Record<EffectDataRow['status'], string> = {
  Verified: 'Verified', ReviewerEntered: 'Entered by reviewer', Unverified: 'Needs checking', NotReported: 'Not reported',
}

/**
 * Meta-analysis for the Evidence Grading step. Arm-level numbers are extracted per included study and checked against
 * the study's own text; only verified or reviewer-entered numbers are pooled. The pooled result, its heterogeneity and
 * the GRADE inconsistency/imprecision ratings computed from it are all calculated in code, never by the model.
 */
export default function MetaAnalysisPanel({ reviewId, onChanged }: { reviewId: string; onChanged?: () => void }) {
  const hasEnoughCredits = useCreditGate()
  const [expanded, setExpanded] = useState(true)
  const [data, setData] = useState<MetaAnalysisResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await metaAnalysisApi.get(reviewId)
      setData(result)
      setRunning(result.isExtracting)
    } catch {
      setData(null)
    }
  }, [reviewId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!running) return
    let cancelled = false
    let timer: number | null = null
    const poll = async () => {
      try {
        const s = await metaAnalysisApi.extractStatus(reviewId)
        if (cancelled) return
        setProgress({ done: s.done, total: s.total })
        if (s.isRunning) timer = window.setTimeout(poll, 2500)
        else { setRunning(false); await load(); onChanged?.() }
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 5000)
      }
    }
    poll()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [running, reviewId, load, onChanged])

  const extract = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewEffectDataExtraction)) return
    try {
      setRunning(true)
      await metaAnalysisApi.extract(reviewId)
    } catch (err) {
      setRunning(false)
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? 'Could not start outcome data extraction.')
    }
  }

  const outcomes = data?.outcomes ?? []
  return (
    <div className="border border-slate-200 rounded-xl mb-6 overflow-hidden">
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50/60 text-left">
        <BarChart3 size={15} className="text-violet-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold text-slate-800">Meta-analysis</span>
          <span className="text-[11px] text-slate-400 ml-2">Pooled results computed from verified study numbers</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          <p className="text-[12px] text-slate-500 my-3 leading-relaxed">
            The AI copies each study's group sizes, means and SDs (or event counts) for every outcome, with the sentence they came
            from. A number is used only if that sentence is in the study and the number is in that sentence, or once you have
            checked or entered it yourself. {data?.method}
          </p>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={extract} disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold disabled:opacity-70">
              {running ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />}
              {running ? `Extracting... ${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Extract outcome data'}
            </button>
            <span className="text-[11px] text-slate-400">{CREDIT_COSTS.systematicReviewEffectDataExtraction} credits. Only studies and outcomes without data are read.</span>
          </div>

          {outcomes.length === 0 && (
            <p className="text-[12px] text-slate-400">Flag at least one extracted variable as an outcome to run a meta-analysis.</p>
          )}
          {outcomes.map(o => <OutcomeCard key={o.outcomeId} reviewId={reviewId} outcome={o} onSaved={async () => { await load(); onChanged?.() }} />)}
        </div>
      )}
    </div>
  )
}

function OutcomeCard({ reviewId, outcome, onSaved }: { reviewId: string; outcome: OutcomeMetaAnalysis; onSaved: () => Promise<void> }) {
  const [showRows, setShowRows] = useState(false)
  const isRatio = outcome.dataType === 'Dichotomous'
  const measureShort = isRatio ? 'RR' : 'SMD'

  return (
    <div className="border border-slate-200 rounded-lg mb-3 overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50/60">
        <p className="text-[13px] font-semibold text-slate-800">{outcome.outcomeName}</p>
        {outcome.estimate != null ? (
          <p className="text-[12px] text-slate-600 mt-0.5 tabular-nums">
            {outcome.measure}: <span className="font-semibold text-slate-900">{measureShort} {f2(outcome.estimate)}</span>{' '}
            (95% CI {f2(outcome.ciLow)} to {f2(outcome.ciHigh)}) · {outcome.studiesPooled} studies · I² = {outcome.i2?.toFixed(0)}%
            {outcome.predictionLow != null && <> · 95% prediction interval {f2(outcome.predictionLow)} to {f2(outcome.predictionHigh)}</>}
            {outcome.eggerP != null && <> · Egger P = {f2(outcome.eggerP)}</>}
          </p>
        ) : (
          <p className="text-[12px] text-slate-500 mt-0.5">{outcome.notPooledReason}</p>
        )}
        {outcome.gradeReasons.length > 0 && (
          <p className="text-[11px] text-slate-500 mt-1">GRADE: {outcome.gradeReasons.join('; ')}</p>
        )}
      </div>

      {outcome.studies.length > 0 && <ForestPlot outcome={outcome} isRatio={isRatio} />}

      <button onClick={() => setShowRows(v => !v)}
        className="w-full flex items-center gap-1 px-3 py-2 text-[12px] font-semibold text-violet-600 hover:text-violet-700 border-t border-slate-100">
        {outcome.rows.length} stud{outcome.rows.length === 1 ? 'y' : 'ies'} with data
        {outcome.rows.some(r => r.status === 'Unverified') && <span className="text-amber-600 font-medium ml-1">· some need checking</span>}
        {showRows ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {showRows && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {outcome.rows.map(r => <RowEditor key={r.id} reviewId={reviewId} row={r} onSaved={onSaved} />)}
        </div>
      )}
    </div>
  )
}

/** Studies' effects with 95% CIs, square size by weight, and the pooled diamond. Ratio measures on a log axis. */
function ForestPlot({ outcome, isRatio }: { outcome: OutcomeMetaAnalysis; isRatio: boolean }) {
  const t = (v: number) => (isRatio ? Math.log(Math.max(v, 1e-6)) : v)
  const nullValue = isRatio ? 1 : 0
  const values = [nullValue, ...outcome.studies.flatMap(s => [s.ciLow, s.ciHigh])]
  if (outcome.ciLow != null && outcome.ciHigh != null) values.push(outcome.ciLow, outcome.ciHigh)
  let lo = Math.min(...values.map(t))
  let hi = Math.max(...values.map(t))
  const pad = (hi - lo) * 0.08 || 0.5
  lo -= pad; hi += pad

  const labelW = 210, plotW = 300, valueW = 150, rowH = 20
  const width = labelW + plotW + valueW
  const rows = outcome.studies.length + (outcome.estimate != null ? 1 : 0)
  const height = rows * rowH + 28
  const x = (v: number) => labelW + ((t(v) - lo) / (hi - lo)) * plotW
  const maxW = Math.max(...outcome.studies.map(s => s.weightPercent ?? 0), 1)
  const short = (s: string) => (s.length > 34 ? s.slice(0, 33) + '…' : s)

  return (
    <div className="px-3 py-2 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px]" role="img" aria-label={`Forest plot for ${outcome.outcomeName}`}>
        <line x1={x(nullValue)} x2={x(nullValue)} y1={4} y2={height - 20} stroke="#94a3b8" strokeDasharray="3 3" />
        {outcome.studies.map((s, i) => {
          const y = 12 + i * rowH
          const size = 4 + 6 * Math.sqrt((s.weightPercent ?? 0) / maxW)
          return (
            <g key={s.paperId}>
              <title>{`${s.paperTitle}: ${f2(s.estimate)} (${f2(s.ciLow)} to ${f2(s.ciHigh)})${s.weightPercent != null ? `, weight ${s.weightPercent.toFixed(1)}%` : ''}`}</title>
              <text x={0} y={y + 4} fontSize={10} fill="#334155">{short(s.paperTitle)}</text>
              <line x1={x(s.ciLow)} x2={x(s.ciHigh)} y1={y} y2={y} stroke="#475569" />
              <rect x={x(s.estimate) - size / 2} y={y - size / 2} width={size} height={size} fill="#7c3aed" />
              <text x={labelW + plotW + 8} y={y + 4} fontSize={10} fill="#475569" className="tabular-nums">
                {f2(s.estimate)} [{f2(s.ciLow)}, {f2(s.ciHigh)}]
              </text>
            </g>
          )
        })}
        {outcome.estimate != null && outcome.ciLow != null && outcome.ciHigh != null && (() => {
          const y = 12 + outcome.studies.length * rowH
          return (
            <g>
              <text x={0} y={y + 4} fontSize={10} fontWeight={700} fill="#0f172a">Pooled (random effects)</text>
              <polygon points={`${x(outcome.ciLow)},${y} ${x(outcome.estimate)},${y - 6} ${x(outcome.ciHigh)},${y} ${x(outcome.estimate)},${y + 6}`} fill="#0f172a" />
              <text x={labelW + plotW + 8} y={y + 4} fontSize={10} fontWeight={700} fill="#0f172a">
                {f2(outcome.estimate)} [{f2(outcome.ciLow)}, {f2(outcome.ciHigh)}]
              </text>
            </g>
          )
        })()}
        <text x={labelW} y={height - 6} fontSize={9} fill="#64748b">Favours lower in intervention ←</text>
        <text x={labelW + plotW} y={height - 6} fontSize={9} fill="#64748b" textAnchor="end">→ higher in intervention</text>
      </svg>
    </div>
  )
}

const num = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v))
const int = (v: string): number | null => (num(v) == null ? null : Math.round(Number(v)))

function RowEditor({ reviewId, row, onSaved }: { reviewId: string; row: EffectDataRow; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<EffectDataType>(row.dataType)
  const [v, setV] = useState<Record<string, string>>({})
  const field = (k: keyof EffectDataRow) => v[k] ?? (row[k] == null ? '' : String(row[k]))
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV(prev => ({ ...prev, [k]: e.target.value }))

  const save = async (notReported: boolean) => {
    const payload: UpdateEffectDataPayload = {
      dataType: type, notReported,
      group1Label: field('group1Label') || null, group2Label: field('group2Label') || null, timepoint: field('timepoint') || null,
      n1: int(field('n1')), mean1: num(field('mean1')), sd1: num(field('sd1')), events1: int(field('events1')),
      n2: int(field('n2')), mean2: num(field('mean2')), sd2: num(field('sd2')), events2: int(field('events2')),
    }
    setSaving(true)
    try {
      await metaAnalysisApi.updateRow(reviewId, row.id, payload)
      setEditing(false)
      await onSaved()
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? 'Could not save these numbers.')
    } finally {
      setSaving(false)
    }
  }

  const arm = (n: number | null, a: number | null, b: number | null) =>
    row.dataType === 'Dichotomous' ? `${a ?? '—'}/${n ?? '—'}` : `n ${n ?? '—'}, mean ${a ?? '—'}, SD ${b == null ? '—' : f2(b)}`

  const input = (k: string, label: string) => (
    <label className="flex flex-col text-[10px] text-slate-500 gap-0.5">
      {label}
      <input value={field(k as keyof EffectDataRow)} onChange={set(k)} inputMode="decimal"
        className="w-20 px-2 py-1 text-[12px] text-slate-800 border border-slate-200 rounded" />
    </label>
  )

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-slate-800">{row.paperTitle}</p>
          {row.status !== 'NotReported' && (
            <p className="text-[11px] text-slate-600 tabular-nums mt-0.5">
              {row.group1Label ?? 'Intervention'}: {arm(row.n1, row.dataType === 'Dichotomous' ? row.events1 : row.mean1, row.sd1)} ·{' '}
              {row.group2Label ?? 'Comparator'}: {arm(row.n2, row.dataType === 'Dichotomous' ? row.events2 : row.mean2, row.sd2)}
              {row.timepoint && <> · {row.timepoint}</>}
            </p>
          )}
          {row.verificationNote && <p className="text-[11px] text-amber-700 mt-0.5">{row.verificationNote}</p>}
          {row.sourceExcerpt && <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-2" title={row.sourceExcerpt}>"{row.sourceExcerpt}"</p>}
        </div>
        <span className={cn('text-[10px] font-semibold border rounded px-1.5 py-0.5 shrink-0', STATUS_STYLE[row.status])}>{STATUS_LABEL[row.status]}</span>
        <button onClick={() => setEditing(e => !e)} className="text-slate-400 hover:text-violet-600 shrink-0" title="Check or correct these numbers">
          <Pencil size={13} />
        </button>
      </div>

      {editing && (
        <div className="mt-2 p-2 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2 text-[11px]">
            {(['Continuous', 'Dichotomous'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={cn('px-2 py-0.5 rounded border', type === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200')}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {input('n1', 'n (intervention)')}
            {type === 'Continuous' ? <>{input('mean1', 'mean')}{input('sd1', 'SD')}</> : input('events1', 'events')}
            {input('n2', 'n (comparator)')}
            {type === 'Continuous' ? <>{input('mean2', 'mean')}{input('sd2', 'SD')}</> : input('events2', 'events')}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => save(false)} disabled={saving}
              className="px-3 py-1 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded disabled:opacity-60">
              {saving ? 'Saving…' : 'Save and use these numbers'}
            </button>
            <button onClick={() => save(true)} disabled={saving}
              className="px-3 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200 bg-white rounded">
              Study does not report this
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
