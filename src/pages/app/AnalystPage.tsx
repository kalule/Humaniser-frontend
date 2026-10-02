import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadCloud, BarChart2, Table2, User, Sparkles,
  FileSpreadsheet, RefreshCcw, Send, X, Pin,
  BookOpen, Code2, AlertTriangle, Terminal,
  RotateCcw, GraduationCap, Library, ExternalLink,
  Quote, FileText, Check, ChevronDown, ChevronUp,
  TrendingUp, Clipboard, ShieldAlert, CheckCircle,
  HelpCircle, ArrowUpRight, SlidersHorizontal,
  ClipboardList, Download, Table,
  Activity, Wand2, Trash2, Type, BadgeCheck,
  PieChart, FlaskConical, Lightbulb, ChevronLeft, ChevronRight, Shield,
  Loader2, Plus,
} from 'lucide-react'
import { AnalystErrorCard } from '../../components/ui/AnalystErrorCard'
import { cn } from '../../lib/utils'
import { useAnalystStore } from '../../store/analystStore'
import { useAuthStore } from '../../store/authStore'
import { CREDIT_COSTS } from '../../config/creditCosts'
import { useAnalyst } from '../../hooks/useAnalyst'
import { useSuggestedQuestions } from '../../hooks/useSuggestedQuestions'
import { useWorkbench } from '../../hooks/useWorkbench'
import { analystApi } from '../../api/analyst'
import { researchApi } from '../../api/research'
import type {
  AnalystResult, ColumnSchema, WorkbenchMode,
  AcademicStyleGuide, RegressionTelemetry, FormattedCitations,
  LiteratureCitation, LiteratureAlignment,
  DataAnomaly, CleanDatasetConfig,
  AnalyticalMethod, PreparationBlueprint,
  DiagnosticSampleRow, AcademicSynthesis,
} from '../../types/analyst'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

// ── Dtype badge ───────────────────────────────────────────────────────────────

function DtypeBadge({ dtype }: { dtype: string }) {
  const map: Record<string, string> = {
    int64:      'bg-blue-100 text-blue-700',
    float64:    'bg-indigo-100 text-indigo-700',
    object:     'bg-violet-100 text-violet-700',
    datetime64: 'bg-emerald-100 text-emerald-700',
    bool:       'bg-amber-100 text-amber-700',
  }
  const base = dtype.startsWith('datetime') ? 'datetime64' : dtype
  return (
    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold', map[base] ?? 'bg-slate-100 text-slate-600')}>
      {dtype.startsWith('datetime') ? 'date' : dtype}
    </span>
  )
}

// ── Null health badge ─────────────────────────────────────────────────────────

function NullBadge({ pct }: { pct: number }) {
  if (pct === 0) return null
  if (pct === 100)
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
        <X size={8} /> 100%
      </span>
    )
  if (pct >= 50)
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
        <AlertTriangle size={8} /> {Math.round(pct)}%
      </span>
    )
  return (
    <span className="text-[10px] text-slate-400">{Math.round(pct)}%</span>
  )
}

// ── Severity chip ─────────────────────────────────────────────────────────────

function SeverityChip({ severity }: { severity: string }) {
  return severity === 'critical' ? (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
      Critical
    </span>
  ) : (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
      Warning
    </span>
  )
}

// ── Diagnostic evidence table ─────────────────────────────────────────────────

function DiagnosticEvidenceTable({ rows, issueType }: { rows: DiagnosticSampleRow[]; issueType: string }) {
  const [expanded, setExpanded] = useState(false)
  const hasCountry = rows.some((r) => r.country !== undefined)
  const hasYear    = rows.some((r) => r.year    !== undefined)

  const valueClass = (v: DiagnosticSampleRow['value']) => {
    if (v === null || v === 'NaN' || v === '') return 'text-slate-400 italic'
    if (typeof v === 'string' && v.startsWith('DUPLICATE')) return 'text-amber-600'
    if (typeof v === 'string' && (v.startsWith('<') || v === 'N/A')) return 'text-orange-600 font-semibold'
    return 'text-slate-700'
  }

  const displayValue = (v: DiagnosticSampleRow['value']) => {
    if (v === null) return 'null'
    if (v === '') return '(empty)'
    return String(v)
  }

  return (
    <div className="mt-1.5 rounded-lg border overflow-hidden" style={{ borderColor: '#e0e0da' }}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 transition-colors"
        style={{ background: '#f8f9fa' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8f9fa' }}
      >
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
          <Table size={9} /> Evidence preview
          <span className="normal-case text-slate-400 font-normal tracking-normal">({rows.length} sample rows)</span>
        </span>
        {expanded ? <ChevronUp size={9} className="text-slate-400" /> : <ChevronDown size={9} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th className="text-left px-2.5 py-1.5 text-slate-500 font-semibold w-12" style={{ borderBottom: '0.5px solid #e0e0da' }}>Row</th>
                {hasCountry && <th className="text-left px-2.5 py-1.5 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Country</th>}
                {hasYear    && <th className="text-left px-2.5 py-1.5 text-slate-500 font-semibold w-12" style={{ borderBottom: '0.5px solid #e0e0da' }}>Year</th>}
                <th className="text-left px-2.5 py-1.5 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '0.5px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}
                >
                  <td className="px-2.5 py-1 text-slate-400 font-mono tabular-nums">{row.row_index}</td>
                  {hasCountry && <td className="px-2.5 py-1 text-slate-600 truncate max-w-[90px]">{row.country ?? '—'}</td>}
                  {hasYear    && <td className="px-2.5 py-1 text-slate-600 font-mono tabular-nums">{row.year ?? '—'}</td>}
                  <td className={cn('px-2.5 py-1 font-mono', valueClass(row.value))}>{displayValue(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {issueType === 'missing_values' && (
            <p className="px-2.5 py-1.5 text-[9px] text-slate-400" style={{ background: '#f8f9fa', borderTop: '0.5px solid #ebebea' }}>
              Showing temporal pattern — nulls follow a year-based boundary, not random
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Health report panel ───────────────────────────────────────────────────────

const FIX_ACTION_LABELS: Record<string, string> = {
  drop_rows:     'Drop rows',
  impute_median: 'Impute median',
  strip_symbols: 'Strip symbols',
  drop_column:   'Drop column',
}

const ISSUE_ICONS: Record<string, React.ReactNode> = {
  missing_values: <AlertTriangle size={11} />,
  type_mismatch:  <Type size={11} />,
  high_outliers:  <TrendingUp size={11} />,
  invariant_value:<Trash2 size={11} />,
}

function buildAutoFixConfig(
  datasetId: string,
  anomalies: DataAnomaly[],
  duplicateRowsCount: number,
): CleanDatasetConfig {
  const missingValueStrategies = anomalies
    .filter((a) => ['drop_rows', 'impute_median', 'drop_column'].includes(a.recommendedFixAction))
    .map((a) => ({
      columnName: a.columnName,
      action: a.recommendedFixAction === 'drop_rows'     ? 'drop'        as const
             : a.recommendedFixAction === 'impute_median' ? 'fill_median' as const
             : 'drop_column' as const,
    }))

  const typeConversions = anomalies
    .filter((a) => a.recommendedFixAction === 'strip_symbols')
    .map((a) => ({
      columnName:      a.columnName,
      targetType:      'float' as const,
      stripCharacters: ['$', ',', '£', '€', '%'],
    }))

  return {
    datasetId,
    dropDuplicates:        duplicateRowsCount > 0,
    stripWhitespace:       true,
    missingValueStrategies: missingValueStrategies.length > 0 ? missingValueStrategies : undefined,
    typeConversions:        typeConversions.length        > 0 ? typeConversions        : undefined,
  }
}

function AnomalyCard({ anomaly: a }: { anomaly: DataAnomaly }) {
  const isCritical = a.severity === 'critical'
  return (
    <div className={cn(
      'rounded-lg border p-2 space-y-1',
      isCritical ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
    )}>
      {/* Header row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[10px]', isCritical ? 'text-red-600' : 'text-amber-600')}>
          {ISSUE_ICONS[a.issueType] ?? <AlertTriangle size={11} />}
        </span>
        <span className="text-[11px] font-semibold text-slate-700 font-mono truncate flex-1 min-w-0">
          {a.columnName === '__row__' ? 'Duplicate rows' : a.columnName}
        </span>
        {a.nullPercent !== undefined && a.nullPercent > 0 && (
          <span className={cn(
            'text-[9px] font-mono font-bold shrink-0 tabular-nums',
            a.nullPercent === 100 ? 'text-red-600' : 'text-amber-600',
          )}>
            {a.nullPercent === 100 ? '100%' : `${a.nullPercent.toFixed(1)}%`} null
          </span>
        )}
        {a.totalAffectedRows !== undefined && (
          <span className="text-[9px] text-slate-400 shrink-0 tabular-nums">
            {a.totalAffectedRows.toLocaleString()} rows
          </span>
        )}
        <SeverityChip severity={a.severity} />
      </div>

      {/* Description */}
      <p className="text-[10px] text-slate-600 leading-snug">{a.description}</p>

      {/* Fix label */}
      <p className="text-[9px] text-slate-400">
        Fix: {FIX_ACTION_LABELS[a.recommendedFixAction] ?? a.recommendedFixAction}
      </p>

      {/* Inline evidence table */}
      {a.diagnosticSample && a.diagnosticSample.length > 0 && (
        <DiagnosticEvidenceTable rows={a.diagnosticSample} issueType={a.issueType} />
      )}
    </div>
  )
}

function HealthReportPanel() {
  const [open, setOpen]       = useState(true)
  const [nlText, setNlText]   = useState('')
  const report      = useAnalystStore((s) => s.healthReport)
  const datasetId   = useAnalystStore((s) => s.datasetId)
  const isProfiling = useAnalystStore((s) => s.isProfiling)
  const isCleaning  = useAnalystStore((s) => s.isCleaning)
  const { cleanDataset, parseAndApplyCleaningInstruction } = useAnalyst()

  if (!report) return null

  const criticalCount  = report.anomalies.filter((a) => a.severity === 'critical').length
  const warningCount   = report.anomalies.filter((a) => a.severity === 'warning').length
  const typeMismatches = report.anomalies.filter((a) => a.issueType === 'type_mismatch').length
  const missingCols    = report.anomalies.filter((a) => a.issueType === 'missing_values').length

  const handleAutoFix = () => {
    if (!datasetId) return
    const config = buildAutoFixConfig(datasetId, report.anomalies, report.duplicateRowsCount)
    void cleanDataset(config)
  }

  const handleNlClean = () => {
    if (!nlText.trim() || isCleaning) return
    void parseAndApplyCleaningInstruction(nlText.trim())
    setNlText('')
  }

  return (
    <div className="mb-3 rounded-xl border overflow-hidden" style={{ borderColor: '#e0e0da', background: '#ffffff' }}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 transition-colors"
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8f9fa' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          <Activity size={11} className="text-violet-600" />
          Data quality report
        </span>
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {warningCount} warn
            </span>
          )}
          {open ? <ChevronUp size={10} className="text-slate-400" /> : <ChevronDown size={10} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { label: 'Duplicates',     value: report.duplicateRowsCount, accent: report.duplicateRowsCount > 0 ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Missing cols',   value: missingCols,               accent: missingCols   > 0 ? 'text-red-600' : 'text-emerald-600' },
              { label: 'Type mismatches',value: typeMismatches,            accent: typeMismatches > 0 ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Issues total',   value: report.anomalies.length,   accent: report.anomalies.length > 0 ? 'text-orange-600' : 'text-emerald-600' },
            ]).map(({ label, value, accent }) => (
              <div key={label} className="border rounded-lg px-2 py-1.5 text-center" style={{ background: '#f8f9fa', borderColor: '#ebebea' }}>
                <p className={cn('text-base font-bold tabular-nums leading-none', accent)}>{value}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{label}</p>
              </div>
            ))}
          </div>

          {/* Anomaly list */}
          {report.anomalies.length > 0 && (
            <div className="space-y-1.5 max-h-[28rem] overflow-y-auto scrollbar-none pr-0.5">
              {report.anomalies.map((a, i) => (
                <AnomalyCard key={i} anomaly={a} />
              ))}
            </div>
          )}

          {report.anomalies.length === 0 && (
            <p className="text-[11px] text-emerald-600 flex items-center gap-1.5 py-1">
              <Check size={11} /> No anomalies detected
            </p>
          )}

          {/* Auto-Fix All button */}
          {report.anomalies.length > 0 && (
            <button
              onClick={handleAutoFix}
              disabled={isCleaning || isProfiling}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ borderColor: '#7c3aed', background: '#f5f3ff', color: '#5b21b6' }}
            >
              {isCleaning ? (
                <><span className="w-3 h-3 rounded-full border-2 border-violet-500/60 border-t-transparent animate-spin" /> Cleaning…</>
              ) : (
                <><Wand2 size={11} /> Auto-fix all issues</>
              )}
            </button>
          )}

          {/* NL cleaning input */}
          <div className="flex gap-1.5">
            <input
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNlClean() }}
              placeholder="e.g. Fix the salary column…"
              disabled={isCleaning}
              className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 placeholder-slate-400 outline-none disabled:opacity-40"
              style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}
            />
            <button
              onClick={handleNlClean}
              disabled={!nlText.trim() || isCleaning}
              className="shrink-0 w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send size={11} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Schema panel ──────────────────────────────────────────────────────────────

const MAX_DEDUCTION_PILLS = 5

function SchemaPanel({ onReset, showHeader = true }: { onReset: () => void; showHeader?: boolean }) {
  const schema      = useAnalystStore((s) => s.schema)
  const isCleaned   = useAnalystStore((s) => s.isCleaned)
  const isProfiling = useAnalystStore((s) => s.isProfiling)
  const { profileDataset } = useAnalyst()

  const [highlightedCol,    setHighlightedCol]    = useState<string | null>(null)
  const [showHealthTooltip, setShowHealthTooltip] = useState(false)
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!highlightedCol) return
    const t = setTimeout(() => setHighlightedCol(null), 2000)
    return () => clearTimeout(t)
  }, [highlightedCol])

  if (!schema) return null

  const colsWithPct = schema.columns.filter((c) => c.nullPercent !== undefined)
  const healthScore = colsWithPct.length > 0
    ? Math.round(100 - colsWithPct.reduce((sum, c) => sum + (c.nullPercent ?? 0), 0) / colsWithPct.length)
    : null

  const criticalCols = schema.columns.filter((c) => (c.nullPercent ?? 0) === 100)
  const warnCols     = schema.columns
    .filter((c) => { const p = c.nullPercent ?? 0; return p > 0 && p < 100 })
    .sort((a, b) => (b.nullPercent ?? 0) - (a.nullPercent ?? 0))

  const deductionList = [
    ...criticalCols.map((c) => ({ col: c, severity: 'critical' as const })),
    ...warnCols.map((c)     => ({ col: c, severity: 'warning'  as const })),
  ]
  const visibleDeductions = deductionList.slice(0, MAX_DEDUCTION_PILLS)
  const hiddenCount       = deductionList.length - visibleDeductions.length

  const scoreColor = healthScore === null ? 'text-slate-500'
    : healthScore >= 90 ? 'text-emerald-600'
    : healthScore >= 75 ? 'text-amber-600'
    : 'text-red-600'

  const barColor = healthScore === null ? 'bg-slate-400'
    : healthScore >= 90 ? 'bg-emerald-500'
    : healthScore >= 75 ? 'bg-amber-500'
    : 'bg-red-500'

  const scrollToCol = (name: string) => {
    const el = colRefs.current[name]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setHighlightedCol(name)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* File info + reset */}
      {showHeader && (
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-white truncate">{schema.fileName}</p>
              {isCleaned && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                  <BadgeCheck size={9} /> Cleaned
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {schema.rowCount.toLocaleString()} rows · {schema.columnCount} columns
            </p>
          </div>
          <button
            onClick={onReset}
            title="Load new file"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCcw size={13} />
          </button>
        </div>
      )}
      {!showHeader && isCleaned && (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 mb-2 self-start">
          <BadgeCheck size={9} /> Cleaned
        </span>
      )}

      {/* Data health card */}
      {healthScore !== null && (
        <div className="mb-3 p-2.5 rounded-xl border space-y-2" style={{ background: '#ffffff', borderColor: '#e0e0da' }}>

          {/* Score row + tooltip anchor */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Data health</span>
            <div
              className="relative"
              onMouseEnter={() => setShowHealthTooltip(true)}
              onMouseLeave={() => setShowHealthTooltip(false)}
            >
              <span className={cn('text-[13px] font-bold cursor-default select-none', scoreColor)}>
                {healthScore}%
              </span>

              {/* Hover breakdown tooltip */}
              {showHealthTooltip && deductionList.length > 0 && (
                <div className="absolute right-0 bottom-full mb-2 w-64 z-50 rounded-xl shadow-2xl p-3 space-y-2 pointer-events-none" style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Score breakdown</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] pb-1" style={{ borderBottom: '0.5px solid #ebebea' }}>
                      <span className="text-slate-500">Base score</span>
                      <span className="text-slate-700 font-mono font-semibold">100%</span>
                    </div>
                    {criticalCols.slice(0, 3).map((c) => (
                      <div key={c.name} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-red-600 font-mono truncate">{c.name}</span>
                        <span className="text-red-600 font-mono shrink-0 text-[10px]">100% null</span>
                      </div>
                    ))}
                    {warnCols.slice(0, 3).map((c) => (
                      <div key={c.name} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-amber-600 font-mono truncate">{c.name}</span>
                        <span className="text-amber-600 font-mono shrink-0 text-[10px]">{Math.round(c.nullPercent ?? 0)}% null</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] pt-1" style={{ borderTop: '0.5px solid #ebebea' }}>
                      <span className="text-slate-500">Net score</span>
                      <span className={cn('font-bold font-mono', scoreColor)}>{healthScore}%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-0.5">
                    Run "Analyse data quality" for actionable fixes
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor)}
              style={{ width: `${healthScore}%` }}
            />
          </div>

          {/* Deduction pills — named, clickable, scroll-to-highlight */}
          {visibleDeductions.length > 0 && (
            <div className="space-y-1 pt-0.5">
              {visibleDeductions.map(({ col, severity }) => (
                <button
                  key={col.name}
                  onClick={() => scrollToCol(col.name)}
                  title={`Jump to ${col.name} in schema`}
                  className={cn(
                    'w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-left transition-colors group',
                    severity === 'critical'
                      ? 'bg-red-50 hover:bg-red-100 border border-red-200'
                      : 'bg-amber-50 hover:bg-amber-100 border border-amber-200',
                  )}
                >
                  {severity === 'critical'
                    ? <X size={9} className="shrink-0 text-red-600" />
                    : <AlertTriangle size={9} className="shrink-0 text-amber-600" />
                  }
                  <span className={cn(
                    'text-[10px] font-mono flex-1 truncate',
                    severity === 'critical' ? 'text-red-700' : 'text-amber-700',
                  )}>
                    {col.name}
                  </span>
                  <span className={cn(
                    'text-[9px] shrink-0 tabular-nums font-semibold',
                    severity === 'critical' ? 'text-red-600' : 'text-amber-600',
                  )}>
                    {Math.round(col.nullPercent ?? 0)}% null
                  </span>
                  <ChevronRight size={9} className="shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
              ))}
              {hiddenCount > 0 && (
                <p className="text-[10px] text-slate-400 pl-1.5">
                  +{hiddenCount} more issue{hiddenCount !== 1 ? 's' : ''} — run analysis to view all
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Claude health report (after profiling) */}
      <HealthReportPanel />

      {/* Analyse Data Quality trigger */}
      <button
        onClick={() => void profileDataset()}
        disabled={isProfiling}
        className="mb-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ borderColor: '#e0e0da', color: '#6b7280' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e0e0da'; (e.currentTarget as HTMLButtonElement).style.background = '' }}
      >
        {isProfiling ? (
          <><span className="w-3 h-3 rounded-full border-2 border-violet-400/60 border-t-transparent animate-spin" /> Analysing…</>
        ) : (
          <><Activity size={11} /> Analyse Data Quality</>
        )}
      </button>

      {/* Column list — receives highlight refs */}
      <div className="flex-1 overflow-y-auto space-y-px pr-1 scrollbar-none">
        {schema.columns.map((col: ColumnSchema) => (
          <div
            key={col.name}
            ref={(el) => { colRefs.current[col.name] = el }}
            className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-500',
              highlightedCol === col.name
                ? 'bg-violet-50 border-violet-300'
                : (col.nullPercent ?? 0) === 100
                ? 'bg-red-50 border-red-200'
                : (col.nullPercent ?? 0) > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-white border-[#ebebea]',
            )}
          >
            {highlightedCol === col.name && (
              <span className="shrink-0 w-0.5 h-3.5 rounded-full bg-violet-500 animate-pulse" />
            )}
            <span className="flex-1 text-[12px] text-slate-700 truncate font-mono">{col.name}</span>
            <DtypeBadge dtype={col.dtype} />
            {col.nullPercent !== undefined
              ? <NullBadge pct={col.nullPercent} />
              : col.nullable && <span className="text-[10px] text-slate-400">null</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mode toggle (tab group) ───────────────────────────────────────────────────

function ModeToggle() {
  const mode    = useAnalystStore((s) => s.mode)
  const setMode = useAnalystStore((s) => s.setMode)
  return (
    <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', border: '0.5px solid #e0e0da', borderRadius: 8, padding: 3 }}>
      {([
        { id: 'student'   as WorkbenchMode, label: 'Student',   icon: GraduationCap },
        { id: 'developer' as WorkbenchMode, label: 'Developer', icon: Code2 },
      ] as const).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          style={{
            height: 26, padding: '0 10px', borderRadius: 6,
            fontSize: 12, fontWeight: mode === id ? 500 : 400,
            cursor: 'pointer', border: 'none',
            background: mode === id ? '#ffffff' : 'transparent',
            color: mode === id ? '#1a1a18' : '#6b7280',
            boxShadow: mode === id ? '0 0.5px 2px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.12s ease',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Icon size={11} /> {label}
        </button>
      ))}
    </div>
  )
}

// ── Academic level toggle (tab group) ─────────────────────────────────────────

function AcademicLevelToggle() {
  const academicLevel    = useAnalystStore((s) => s.academicLevel)
  const { setAcademicLevel } = useAnalyst()
  return (
    <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', border: '0.5px solid #e0e0da', borderRadius: 8, padding: 3 }}>
      {(['undergraduate', 'masters', 'doctoral'] as const).map((level) => (
        <button
          key={level}
          onClick={() => setAcademicLevel(level)}
          style={{
            height: 26, padding: '0 10px', borderRadius: 6,
            fontSize: 12, fontWeight: academicLevel === level ? 500 : 400,
            cursor: 'pointer', border: 'none',
            background: academicLevel === level ? '#ffffff' : 'transparent',
            color: academicLevel === level ? '#1a1a18' : '#6b7280',
            boxShadow: academicLevel === level ? '0 0.5px 2px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.12s ease',
          }}
        >
          {level === 'undergraduate' ? 'UG' : level === 'masters' ? 'Masters' : 'Doctoral'}
        </button>
      ))}
    </div>
  )
}

// ── Live terminal ─────────────────────────────────────────────────────────────

function LiveTerminal({ lines, retryCount }: { lines: string[]; retryCount?: number }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])
  if (!lines.length) return null
  return (
    <div className="mt-2 rounded-xl border border-slate-700/60 bg-[#0d1117] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60">
        <Terminal size={11} className="text-slate-500" />
        <span className="text-[10px] text-slate-500 font-mono">Sandbox Terminal</span>
        {retryCount !== undefined && retryCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
            <RotateCcw size={9} /> Self-healed ×{retryCount}
          </span>
        )}
      </div>
      <div className="p-3 max-h-40 overflow-y-auto scrollbar-none font-mono text-[11px] leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              line.startsWith('[✓]') ? 'text-emerald-400'
              : line.startsWith('⚠') || line.startsWith('[!]') ? 'text-amber-400'
              : line.includes('ERROR') || line.includes('Traceback') ? 'text-red-400'
              : line.startsWith('[*]') ? 'text-violet-300'
              : 'text-slate-400'
            )}
          >
            {line}
          </div>
        ))}
        <div ref={endRef} className="flex items-center gap-1 mt-1">
          <span className="w-1.5 h-3 bg-slate-400 animate-pulse rounded-sm" />
        </div>
      </div>
    </div>
  )
}

// ── Conceptual guide (Student mode) ──────────────────────────────────────────

function ConceptualGuide({ steps }: { steps: string[] }) {
  if (!steps.length) return null
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider flex items-center gap-1.5">
        <BookOpen size={10} /> Step-by-step breakdown
      </p>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-2.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 border border-violet-200 text-[10px] font-bold text-violet-700 flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <p className="text-[13px] text-slate-700 leading-relaxed">{step}</p>
        </div>
      ))}
    </div>
  )
}

// ── Result renderer ───────────────────────────────────────────────────────────

function ResultBlock({
  result,
  sourcePrompt,
  onPin,
}: {
  result: AnalystResult
  sourcePrompt: string
  onPin?: (result: AnalystResult, prompt: string) => void
}) {
  if (result.type === 'chart') {
    return (
      <div className="mt-3 group relative">
        {result.caption && (
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
            <BarChart2 size={11} /> {result.caption}
          </p>
        )}
        <img
          src={`data:image/png;base64,${result.base64Png}`}
          alt={result.caption ?? 'Chart'}
          className="rounded-xl max-w-full max-h-[520px] object-contain"
          style={{ border: '0.5px solid #e0e0da' }}
        />
        {onPin && (
          <button
            onClick={() => onPin(result, sourcePrompt)}
            className="absolute top-2 right-2 text-violet-600 hover:text-violet-700 text-[11px] px-2 py-1 rounded-lg flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
            style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}
          >
            <Pin size={11} /> Pin to Report
          </button>
        )}
      </div>
    )
  }

  if (result.type === 'text') {
    return (
      <div className="mt-3 p-3 rounded-xl text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
        {result.content}
      </div>
    )
  }

  // Table — capped height + horizontal scroll so it never breaks the layout
  const MAX_PREVIEW_ROWS = 100
  const rows = result.rows.slice(0, MAX_PREVIEW_ROWS)
  const trimmed = result.rows.length > MAX_PREVIEW_ROWS

  return (
    <div className="mt-3">
      {result.caption && (
        <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
          <Table2 size={11} /> {result.caption}
        </p>
      )}
      {/* overflow-auto gives independent x+y scroll; max-h prevents page-length tables */}
      <div className="overflow-auto max-h-72 rounded-xl" style={{ border: '0.5px solid #e0e0da' }}>
        <table className="text-xs border-collapse" style={{ minWidth: '100%' }}>
          <thead className="sticky top-0 z-10">
            <tr>
              {result.headers.map((h) => (
                <th
                  key={h}
                  title={h}
                  className="text-left px-3 py-2 text-slate-500 font-semibold whitespace-nowrap"
                  style={{ background: '#f8f9fa', borderBottom: '0.5px solid #e0e0da', maxWidth: 160 }}
                >
                  <span className="block truncate" style={{ maxWidth: 160 }}>
                    {h}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="last:border-0 hover:bg-slate-50" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 text-slate-700 font-mono whitespace-nowrap">
                    {cell ?? <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trimmed && (
        <p className="text-[11px] text-slate-400 mt-1.5 text-right">
          Showing first {MAX_PREVIEW_ROWS} of {result.rows.length} rows
        </p>
      )}
    </div>
  )
}

// ── Outlier simulation panel ──────────────────────────────────────────────────

const NUMERIC_DTYPES_SET = new Set(['int64', 'float64', 'int32', 'float32'])

function OutlierPanel({ messageId }: { messageId: string }) {
  const [open, setOpen]           = useState(false)
  const [xVar, setXVar]           = useState('')
  const [yVar, setYVar]           = useState('')
  const [excluded, setExcluded]   = useState<Set<number>>(new Set())

  const { runOutlierSimulation }  = useAnalyst()
  const datasetId  = useAnalystStore((s) => s.datasetId)
  const schema     = useAnalystStore((s) => s.schema)
  const scan       = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.outlierScan)
  const simResult  = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.outlierSimResult)
  const isRunning  = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.isRunningOutlierScan ?? false)

  const numericCols = schema?.columns
    .filter((c) => NUMERIC_DTYPES_SET.has(c.dtype))
    .map((c) => c.name) ?? []

  const toggleExclude = (idx: number) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })

  const canScan     = !!datasetId && !!xVar && !!yVar && xVar !== yVar
  const isScanPhase = isRunning && excluded.size === 0
  const isSimPhase  = isRunning && excluded.size > 0

  const threshold = scan ? (4 / scan.sampleSize).toFixed(4) : '—'

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors',
          open
            ? 'border-orange-300 text-orange-700 bg-orange-50'
            : 'border-orange-200 text-orange-600 hover:bg-orange-50',
        )}
      >
        <TrendingUp size={11} />
        {scan ? 'Outlier analysis' : 'Check for outliers'}
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="mt-2 p-4 rounded-xl space-y-4" style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}>

          {/* Variable selectors */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'X (Independent)', val: xVar, set: setXVar },
              { label: 'Y (Dependent)',   val: yVar, set: setYVar },
            ] as const).map(({ label, val, set }) => (
              <div key={label} className="space-y-1">
                <label className="text-[10px] text-slate-500">{label}</label>
                <select
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 outline-none"
                  style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}
                >
                  <option value="">Select column…</option>
                  {numericCols.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Scan button */}
          <button
            onClick={() => void runOutlierSimulation(datasetId!, xVar, yVar, messageId)}
            disabled={!canScan || isRunning}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-[13px] font-semibold hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isScanPhase ? (
              <><span className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" /> Scanning…</>
            ) : (
              <><TrendingUp size={12} /> {scan ? 'Re-scan' : 'Scan for outliers'}</>
            )}
          </button>

          {/* Scan error */}
          {scan?.error && (
            <p className="text-[12px] text-red-600 flex items-center gap-1.5">
              <X size={11} /> {scan.error}
            </p>
          )}

          {/* Scan results */}
          {scan && !scan.error && (
            <>
              {/* Baseline chart (initial scan) */}
              {scan.baselineMetrics.chartBase64 && (
                <img
                  src={`data:image/png;base64,${scan.baselineMetrics.chartBase64}`}
                  alt="Regression with outliers flagged"
                  className="w-full rounded-xl"
                  style={{ border: '0.5px solid #e0e0da' }}
                />
              )}

              {scan.outliersDetected ? (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-semibold text-orange-600 flex items-center gap-1.5">
                    <AlertTriangle size={11} />
                    {scan.outliers.length} high-leverage outlier{scan.outliers.length !== 1 ? 's' : ''} detected
                    <span className="text-slate-400 font-normal">(Cook's D &gt; {threshold})</span>
                  </p>

                  {/* Outlier table with checkboxes */}
                  <div className="overflow-auto rounded-xl" style={{ border: '0.5px solid #e0e0da' }}>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left" style={{ background: '#f8f9fa' }}>
                          <th className="px-3 py-2 text-slate-500 font-semibold w-10" style={{ borderBottom: '0.5px solid #e0e0da' }}>Excl.</th>
                          <th className="px-3 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Row</th>
                          <th className="px-3 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>{xVar}</th>
                          <th className="px-3 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Cook's D</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scan.outliers.map((o) => (
                          <tr key={o.rowIndex} className="hover:bg-slate-50" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={excluded.has(o.rowIndex)}
                                onChange={() => toggleExclude(o.rowIndex)}
                                className="accent-orange-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-slate-500 font-mono">{o.rowIndex}</td>
                            <td className="px-3 py-1.5 text-slate-700 font-mono">{o.value.toLocaleString()}</td>
                            <td className="px-3 py-1.5 font-mono text-orange-600 font-semibold">{o.cooksDistance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Simulate button */}
                  <button
                    onClick={() => void runOutlierSimulation(datasetId!, xVar, yVar, messageId, [...excluded])}
                    disabled={excluded.size === 0 || isRunning}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-[13px] font-semibold hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSimPhase ? (
                      <><span className="w-3 h-3 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" /> Re-running model…</>
                    ) : (
                      <>Re-run without {excluded.size > 0 ? `${excluded.size} selected` : 'selected outliers'}</>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-[12px] text-emerald-600 flex items-center gap-1.5">
                  <Check size={11} /> No high-leverage outliers detected (n={scan.sampleSize}).
                </p>
              )}

              {/* Comparison panel after simulation */}
              {simResult && !simResult.error && simResult.cleanedMetrics && (
                <div className="space-y-3 pt-3" style={{ borderTop: '0.5px solid #e0e0da' }}>
                  <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider">
                    Model comparison — {excluded.size} row{excluded.size !== 1 ? 's' : ''} excluded
                  </p>

                  {/* Combined comparison chart */}
                  {simResult.cleanedMetrics.chartBase64 && (
                    <img
                      src={`data:image/png;base64,${simResult.cleanedMetrics.chartBase64}`}
                      alt="Baseline vs cleaned regression"
                      className="w-full rounded-xl"
                      style={{ border: '0.5px solid #e0e0da' }}
                    />
                  )}

                  {/* Before / after metrics table */}
                  <div className="overflow-auto rounded-xl" style={{ border: '0.5px solid #e0e0da' }}>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left" style={{ background: '#f8f9fa' }}>
                          <th className="px-3 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Metric</th>
                          <th className="px-3 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Baseline</th>
                          <th className="px-3 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Cleaned</th>
                          <th className="px-3 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          { label: 'R²',        base: scan.baselineMetrics.r2Score,   clean: simResult.cleanedMetrics.r2Score   },
                          { label: 'Slope',     base: scan.baselineMetrics.slope,     clean: simResult.cleanedMetrics.slope     },
                          { label: 'Intercept', base: scan.baselineMetrics.intercept, clean: simResult.cleanedMetrics.intercept },
                        ]).map(({ label, base, clean }) => {
                          const delta = clean - base
                          return (
                            <tr key={label} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                              <td className="px-3 py-1.5 text-slate-600 font-semibold">{label}</td>
                              <td className="px-3 py-1.5 text-slate-700 font-mono">{base.toFixed(4)}</td>
                              <td className="px-3 py-1.5 text-teal-700 font-mono font-semibold">{clean.toFixed(4)}</td>
                              <td className={cn('px-3 py-1.5 font-mono text-[11px]', delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-500')}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(4)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Write-up panel ────────────────────────────────────────────────────────────

const STYLE_GUIDES: { id: AcademicStyleGuide; label: string; hint: string }[] = [
  { id: 'APA7',    label: 'APA 7',   hint: 'No leading zero · italicised symbols' },
  { id: 'Harvard', label: 'Harvard', hint: 'Parenthetical stats · leading zeros' },
  { id: 'IEEE',    label: 'IEEE',    hint: 'Technical inline · leading zeros' },
]

// ── Citation formatter panel ──────────────────────────────────────────────────

function CitationPanel({
  citations,
  copiedKey,
  onCopy,
}: {
  citations: FormattedCitations
  copiedKey: 'apa7' | 'harvard' | null
  onCopy: (key: 'apa7' | 'harvard', text: string) => void
}) {
  const items = [
    { key: 'apa7'    as const, label: 'APA 7th edition',  accent: 'text-teal-700',   borderCls: 'border-teal-200',   bgCls: 'bg-teal-50'   },
    { key: 'harvard' as const, label: 'Harvard style',    accent: 'text-indigo-700', borderCls: 'border-indigo-200', bgCls: 'bg-indigo-50' },
  ]

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <Quote size={10} />
        Copy statistical results statement
      </p>
      {items.map(({ key, label, accent, borderCls, bgCls }) => (
        <div
          key={key}
          className={cn('relative rounded-xl border p-3 pr-10', borderCls, bgCls)}
        >
          <span className={cn('text-[10px] font-semibold block mb-1', accent)}>{label}</span>
          <p className="text-[12px] text-slate-700 leading-relaxed font-serif italic">
            "{citations[key].replace(/\*/g, '')}"
          </p>
          <button
            onClick={() => onCopy(key, citations[key])}
            title="Copy to clipboard"
            className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {copiedKey === key
              ? <Check size={13} className="text-emerald-600" />
              : <Clipboard size={13} />}
          </button>
        </div>
      ))}
      <p className="text-[10px] text-slate-400">
        Italic markers (*) stripped on copy — ready to paste directly into your results section.
      </p>
    </div>
  )
}

// ── Methodology panel ─────────────────────────────────────────────────────────

function MethodologyPanel({ messageId, jobId }: { messageId: string; jobId: string }) {
  const [open, setOpen]           = useState(false)
  const [style, setStyle]         = useState<AcademicStyleGuide>('APA7')
  const [narrativeCopied, setNarrativeCopied] = useState(false)

  const { getMethodologyAppendix } = useAnalyst()
  const appendix        = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.methodologyAppendix)
  const isGenerating    = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.isGeneratingMethodology ?? false)

  const fetch = () => {
    void getMethodologyAppendix(jobId, messageId, style)
  }

  const copyNarrative = () => {
    if (!appendix?.narrative) return
    void navigator.clipboard.writeText(appendix.narrative)
    setNarrativeCopied(true)
    setTimeout(() => setNarrativeCopied(false), 2000)
  }

  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const blob = await analystApi.downloadMethodologyDocx(jobId, style)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      a.download = `Methodology_Appendix_${dateStr}.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Methodology document downloaded!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to download methodology document.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors',
          open
            ? 'border-violet-300 text-violet-700 bg-violet-50'
            : 'border-violet-200 text-violet-600 hover:bg-violet-50',
        )}
      >
        <ClipboardList size={11} />
        {appendix ? 'View methodology appendix' : 'Export methodology'}
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="mt-2 p-4 rounded-xl space-y-4" style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}>
          {/* Style selector + fetch button */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2">
              {STYLE_GUIDES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setStyle(id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors',
                    style === id
                      ? 'bg-violet-100 border-violet-300 text-violet-700'
                      : 'bg-white border-[#e0e0da] text-slate-500 hover:border-violet-200 hover:text-slate-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={fetch}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-violet-100 border border-violet-200 text-violet-700 font-semibold hover:bg-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <ClipboardList size={11} />
                  {appendix ? 'Regenerate' : 'Generate appendix'}
                </>
              )}
            </button>
          </div>

          {appendix && (
            <>
              {/* No events notice */}
              {!appendix.hasEvents && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
                  <Table size={13} className="text-slate-400 shrink-0" />
                  <p className="text-[12px] text-slate-500">
                    No data transformation events were recorded for this analysis. The dataset was used as-is.
                  </p>
                </div>
              )}

              {/* Narrative */}
              {appendix.narrative && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
                      Methods section prose
                    </p>
                    <button
                      onClick={copyNarrative}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      style={{ border: '0.5px solid #e0e0da' }}
                    >
                      {narrativeCopied ? <Check size={10} className="text-emerald-600" /> : <Clipboard size={10} />}
                      {narrativeCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-3 rounded-xl text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-serif" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
                    {appendix.narrative}
                  </div>
                </div>
              )}

              {/* Audit events table */}
              {appendix.hasEvents && appendix.events.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Table size={10} /> Raw audit log ({appendix.events.length} events)
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #e0e0da' }}>
                    <table className="w-full text-[11px]">
                      <thead style={{ background: '#f8f9fa' }}>
                        <tr>
                          {['Category', 'Action', 'Column(s)', 'Before', 'After', 'Removed', 'Details'].map((h) => (
                            <th key={h} className="text-left px-2.5 py-2 text-slate-500 font-semibold" style={{ borderBottom: '0.5px solid #e0e0da' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {appendix.events.map((ev, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#fafafa', borderBottom: '0.5px solid #f1f5f9' }}>
                            <td className="px-2.5 py-1.5 text-violet-600 font-medium">{ev.category}</td>
                            <td className="px-2.5 py-1.5 text-slate-700">{ev.action}</td>
                            <td className="px-2.5 py-1.5 text-slate-500 font-mono">{ev.column ?? ev.columns ?? '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-500 tabular-nums">{ev.beforeRows ?? '—'}</td>
                            <td className="px-2.5 py-1.5 text-slate-500 tabular-nums">{ev.afterRows ?? '—'}</td>
                            <td className="px-2.5 py-1.5 tabular-nums">
                              {ev.removedCount != null ? (
                                <span className="text-amber-600">
                                  {ev.removedCount}
                                  {ev.percentRemoved != null ? ` (${ev.percentRemoved.toFixed(1)}%)` : ''}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-400 text-[10px]">
                              {[
                                ev.method     && `method: ${ev.method}`,
                                ev.threshold  && `threshold: ${ev.threshold}`,
                                ev.reason     && ev.reason,
                                ev.logBase    && `log base: ${ev.logBase}`,
                              ].filter(Boolean).join(' · ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Download .docx */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}
                >
                  {isDownloading ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                  ) : (
                    <Download size={11} />
                  )}
                  {isDownloading ? 'Downloading…' : 'Download .docx'}
                </button>
                <p className="text-[10px] text-slate-400">
                  Word-compatible · generated {new Date(appendix.generatedAt).toLocaleDateString()}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Write-up panel ────────────────────────────────────────────────────────────

const EMPTY_TELEMETRY: RegressionTelemetry = {
  coefficient: 0, tStatistic: 0, pValue: 0, r2Score: 0,
  fStatistic: 0, degreesOfFreedomModel: 1, degreesOfFreedomResidual: 100,
}

function WriteUpPanel({ messageId }: { messageId: string }) {
  const [open, setOpen]               = useState(false)
  const [style, setStyle]             = useState<AcademicStyleGuide>('APA7')
  const [indepVar, setIndepVar]       = useState('')
  const [depVar, setDepVar]           = useState('')
  const [stats, setStats]             = useState<RegressionTelemetry>(EMPTY_TELEMETRY)
  const [copied, setCopied]               = useState(false)
  const [citationCopied, setCitationCopied] = useState<'apa7' | 'harvard' | null>(null)

  const { generateWriteUp }   = useAnalyst()
  const writeUpDraft          = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.writeUpDraft)
  const writeUpCitations      = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.writeUpCitations)
  const isGenerating          = useAnalystStore((s) => s.messages.find((m) => m.id === messageId)?.isGeneratingWriteUp ?? false)

  const setStat = (key: keyof RegressionTelemetry, val: string) =>
    setStats((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }))

  const submit = () => {
    if (!indepVar.trim() || !depVar.trim()) {
      return
    }
    void generateWriteUp(
      { independentVariable: indepVar.trim(), dependentVariable: depVar.trim(), styleGuide: style, telemetry: stats },
      messageId,
    )
  }

  const copy = () => {
    if (!writeUpDraft) return
    void navigator.clipboard.writeText(writeUpDraft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyCitation = (key: 'apa7' | 'harvard', text: string) => {
    void navigator.clipboard.writeText(text.replace(/\*/g, ''))
    setCitationCopied(key)
    setTimeout(() => setCitationCopied(null), 2000)
  }

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors',
          open
            ? 'border-amber-300 text-amber-700 bg-amber-50'
            : 'border-amber-200 text-amber-600 hover:bg-amber-50',
        )}
      >
        <FileText size={11} />
        {writeUpDraft ? 'View write-up' : 'Generate write-up'}
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="mt-2 p-4 rounded-xl space-y-4" style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}>
          {/* Style selector */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Style guide</p>
            <div className="flex gap-2 flex-wrap">
              {STYLE_GUIDES.map(({ id, label, hint }) => (
                <button
                  key={id}
                  onClick={() => setStyle(id)}
                  title={hint}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors',
                    style === id
                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                      : 'bg-white border-[#e0e0da] text-slate-500 hover:border-amber-200 hover:text-slate-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Variable names */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Independent Variable (X)', value: indepVar, set: setIndepVar },
              { label: 'Dependent Variable (Y)',   value: depVar,   set: setDepVar   },
            ] as const).map(({ label, value, set }) => (
              <div key={label} className="space-y-1">
                <label className="text-[10px] text-slate-500">{label}</label>
                <input
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="e.g. Incident Cases"
                  className="w-full rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 placeholder-slate-300 outline-none"
                  style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}
                />
              </div>
            ))}
          </div>

          {/* Telemetry grid */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Regression statistics</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                { key: 'coefficient',            label: 'β (Coefficient)' },
                { key: 'tStatistic',             label: 't-statistic'     },
                { key: 'pValue',                 label: 'p-value'         },
                { key: 'r2Score',                label: 'R²'              },
                { key: 'fStatistic',             label: 'F-statistic'     },
                { key: 'degreesOfFreedomModel',  label: 'df (Model)'      },
                { key: 'degreesOfFreedomResidual', label: 'df (Residual)' },
              ] as { key: keyof RegressionTelemetry; label: string }[]).map(({ key, label }) => (
                <div key={key} className="space-y-0.5">
                  <label className="text-[10px] text-slate-500">{label}</label>
                  <input
                    type="number"
                    value={stats[key]}
                    onChange={(e) => setStat(key, e.target.value)}
                    className="w-full rounded-lg px-2 py-1 text-[12px] text-slate-700 font-mono outline-none"
                    style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}
                    step="any"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={submit}
            disabled={isGenerating || !indepVar.trim() || !depVar.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[13px] font-semibold hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileText size={12} />
                {writeUpDraft ? 'Regenerate' : 'Generate write-up'}
              </>
            )}
          </button>

          {/* Draft output */}
          {writeUpDraft && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                  Draft — {STYLE_GUIDES.find((g) => g.id === style)?.label}
                </p>
                <button
                  onClick={copy}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  style={{ border: '0.5px solid #e0e0da' }}
                >
                  {copied ? <Check size={10} className="text-emerald-600" /> : null}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="p-3 rounded-xl text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-serif" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
                {writeUpDraft}
              </div>
              <p className="text-[10px] text-slate-400">
                Markdown formatting preserved — paste into your document editor to render italics.
              </p>
            </div>
          )}

          {/* In-text citation panel */}
          {writeUpCitations && <CitationPanel citations={writeUpCitations} copiedKey={citationCopied} onCopy={copyCitation} />}
        </div>
      )}
    </div>
  )
}

// ── Academic synthesis panel ──────────────────────────────────────────────────

function SynthesisPanel({
  literature, synthesis, isGenerating, isFetchingLiterature, onGenerate,
}: {
  literature:           LiteratureCitation[]
  synthesis?:           AcademicSynthesis
  isGenerating:         boolean
  isFetchingLiterature: boolean
  onGenerate:           () => void
}) {
  const [open,   setOpen]   = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!synthesis?.text) return
    void navigator.clipboard.writeText(synthesis.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '0.5px solid #ddd6fe', background: '#ffffff' }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-violet-50 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
          <GraduationCap size={11} className="text-violet-600" />
          Academic synthesis
          {synthesis && <span className="ml-1 text-[9px] font-normal text-emerald-600 normal-case">ready</span>}
        </span>
        {open ? <ChevronUp size={10} className="text-slate-400" /> : <ChevronDown size={10} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5" style={{ borderTop: '0.5px solid #ede9fe' }}>
          {!synthesis && (
            <p className="text-[11px] text-slate-500 leading-relaxed pt-2">
              {literature.length > 0
                ? `Generate a long-form, citation-rich academic analysis using the ${literature.length} paper${literature.length !== 1 ? 's' : ''} loaded as verified Harvard references.`
                : 'Generate a deep biostatistical critique and empirical expansion of these results. Load literature above to include Harvard citations.'
              }
            </p>
          )}

          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors',
              isGenerating
                ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                : synthesis
                  ? 'border-[#e0e0da] text-slate-500 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50'
                  : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
            )}
          >
            {isGenerating ? (
              isFetchingLiterature
                ? <><span className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /> Finding references…</>
                : <><span className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /> Synthesising…</>
            ) : (
              <><FlaskConical size={11} /> {synthesis ? 'Regenerate synthesis' : 'Generate academic synthesis'}</>
            )}
          </button>

          {synthesis && (
            <div className="space-y-2">
              {/* Prose output */}
              <div className="p-3 rounded-xl text-[13px] text-slate-700 leading-[1.8] font-serif max-h-[36rem] overflow-y-auto scrollbar-none" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => <h2 className="text-[15px] font-bold text-violet-700 mt-4 mb-1.5 first:mt-0 font-sans tracking-tight">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[13px] font-semibold text-slate-700 mt-3 mb-1 first:mt-0 font-sans">{children}</h3>,
                    p:  ({ children }) => <p className="mb-3 last:mb-0 leading-[1.85]">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                    em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
                    code: ({ children }) => <code className="bg-slate-100 text-violet-700 px-1 py-0.5 rounded text-[12px] font-mono not-italic">{children}</code>,
                  }}
                >
                  {synthesis.text}
                </ReactMarkdown>
              </div>

              {/* Harvard reference list */}
              {synthesis.harvardReferences.length > 0 && (
                <div className="p-2.5 rounded-lg space-y-1" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Harvard reference list
                  </p>
                  {synthesis.harvardReferences.map((ref, i) => (
                    <p key={i} className="text-[11px] text-slate-600 leading-relaxed">
                      {ref}
                    </p>
                  ))}
                </div>
              )}

              {/* Copy button */}
              <div className="flex justify-end">
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                  style={{ border: '0.5px solid #e0e0da' }}
                >
                  {copied ? <><Check size={10} className="text-emerald-600" /> Copied</> : <><Clipboard size={10} /> Copy text</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Literature panel ──────────────────────────────────────────────────────────

const ALIGNMENT_CONFIG: Record<LiteratureAlignment, {
  label: string
  icon: React.ReactNode
  cardBorderStyle: React.CSSProperties
  badgeCls: string
  analysisBg: string
  analysisText: string
}> = {
  Contradictory: {
    label:           'Contradictory finding',
    icon:            <ShieldAlert size={11} />,
    cardBorderStyle: { border: '0.5px solid #fcd34d' },
    badgeCls:        'bg-amber-100 text-amber-700 border border-amber-200',
    analysisBg:      'bg-amber-50 border border-amber-200',
    analysisText:    'text-amber-800',
  },
  Supporting: {
    label:           'Supporting evidence',
    icon:            <CheckCircle size={11} />,
    cardBorderStyle: { border: '0.5px solid #6ee7b7' },
    badgeCls:        'bg-emerald-100 text-emerald-700 border border-emerald-200',
    analysisBg:      'bg-emerald-50 border border-emerald-200',
    analysisText:    'text-emerald-800',
  },
  Nuanced: {
    label:           'Nuanced / context-dependent',
    icon:            <HelpCircle size={11} />,
    cardBorderStyle: { border: '0.5px solid #e0e0da' },
    badgeCls:        'bg-slate-100 text-slate-600 border border-slate-200',
    analysisBg:      'bg-slate-50 border border-slate-200',
    analysisText:    'text-slate-700',
  },
}

type LiteratureFilter = 'All' | 'Contradictory' | 'Supporting'

function LiteraturePanel({ citations }: { citations: LiteratureCitation[] }) {
  const [filter, setFilter] = useState<LiteratureFilter>('All')

  if (citations.length === 0) {
    return (
      <div className="mt-3 p-3 rounded-xl text-center" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
        <p className="text-[12px] text-slate-500">No related papers found for this analysis.</p>
      </div>
    )
  }

  const contradictoryCount = citations.filter((p) => p.alignment === 'Contradictory').length
  const supportingCount    = citations.filter((p) => p.alignment === 'Supporting').length

  const filtered = filter === 'All'
    ? citations
    : citations.filter((p) => p.alignment === filter)

  return (
    <div className="mt-3 space-y-3">
      {/* Header + filter tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
          <Library size={10} /> Empirical literature verification
        </p>
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: '#f1f5f9', border: '0.5px solid #e0e0da' }}>
          {([
            { id: 'All'           as const, label: 'All',           count: citations.length },
            { id: 'Contradictory' as const, label: 'Contradictory', count: contradictoryCount },
            { id: 'Supporting'    as const, label: 'Supporting',    count: supportingCount   },
          ]).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                'flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold transition-colors',
                filter === id
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <SlidersHorizontal size={9} className={filter === id ? '' : 'opacity-0 w-0'} />
              {label}
              {count > 0 && (
                <span className={cn(
                  'rounded-full px-1 text-[9px] font-bold',
                  id === 'Contradictory' ? 'bg-amber-100 text-amber-600' :
                  id === 'Supporting'    ? 'bg-emerald-100 text-emerald-600' :
                                          'bg-slate-100 text-slate-500',
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="p-3 rounded-xl text-center" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
          <p className="text-[12px] text-slate-500">No {filter.toLowerCase()} papers in this set.</p>
        </div>
      )}

      {filtered.map((paper) => {
        const alignment = paper.alignment ?? 'Nuanced'
        const cfg = ALIGNMENT_CONFIG[alignment]
        const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : paper.url

        return (
          <div
            key={paper.paperId}
            className="rounded-xl p-3 space-y-2"
            style={{ background: '#ffffff', ...cfg.cardBorderStyle }}
          >
            {/* Source + alignment badges */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {paper.sourceEngine && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded-md" style={{ background: '#f1f5f9', border: '0.5px solid #e0e0da' }}>
                  {paper.sourceEngine}
                </span>
              )}
              <span className={cn(
                'flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ml-auto',
                cfg.badgeCls,
              )}>
                {cfg.icon}
                {cfg.label}
              </span>
            </div>

            {/* Title + meta */}
            <div className="space-y-0.5">
              {paper.url ? (
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-semibold text-slate-800 hover:text-violet-600 leading-snug flex items-start gap-1 group"
                >
                  <span className="flex-1">{paper.title}</span>
                  <ExternalLink size={10} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-violet-500" />
                </a>
              ) : (
                <p className="text-[13px] font-semibold text-slate-800 leading-snug">{paper.title}</p>
              )}
              <p className="text-[11px] text-slate-500">
                {paper.authors.slice(0, 3).join(', ')}
                {paper.authors.length > 3 ? ' et al.' : ''}
                {paper.year ? ` · ${paper.year}` : ''}
                {paper.citationCount != null ? ` · ${paper.citationCount.toLocaleString()} citations` : ''}
              </p>
            </div>

            {/* Divergence / alignment narrative */}
            {paper.alignmentNarrative && (
              <div className={cn('rounded-lg border p-2.5 space-y-1.5', cfg.analysisBg)}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Divergence analysis
                </p>
                <p className={cn('text-[11px] italic leading-relaxed', cfg.analysisText)}>
                  "{paper.alignmentNarrative}"
                </p>
                {paper.criticalAnalysisPrompt && (
                  <div className="pt-1.5 mt-1.5 space-y-0.5" style={{ borderTop: '0.5px solid #e0e0da' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Critical synthesis helper
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {paper.criticalAnalysisPrompt}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* DOI link */}
            {doiUrl && (
              <a
                href={doiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-end gap-1 text-[10px] text-teal-600 hover:text-teal-700 font-medium transition-colors"
              >
                View Source Publication <ArrowUpRight size={11} />
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onPin,
}: {
  msg: import('../../types/analyst').AnalystMessage
  onPin?: (result: AnalystResult, prompt: string) => void
}) {
  const mode            = useAnalystStore((s) => s.mode)
  const { findLiterature, generateSynthesis } = useAnalyst()
  const isUser          = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-slate-800 text-[14px] leading-relaxed bg-purple-tint" style={{ border: '0.5px solid var(--color-purple)' }}>
          {msg.content}
        </div>
        <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#f1f5f9', border: '0.5px solid #e0e0da' }}>
          <User size={13} className="text-slate-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#f5f3ff', border: '0.5px solid #ddd6fe' }}>
        <Sparkles size={13} className="text-violet-600" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Pending / Running states */}
        {(msg.status === 'pending' || msg.status === 'running') && (
          <>
            <div className="flex items-center gap-2 text-slate-400 text-sm py-1">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              {msg.status === 'running' ? 'Executing in sandbox…' : 'Preparing…'}
            </div>
            {msg.status === 'running' && msg.logStream && msg.logStream.length > 0 && (
              <LiveTerminal lines={msg.logStream} retryCount={msg.retryCount} />
            )}
          </>
        )}

        {/* Error state */}
        {msg.status === 'error' && (
          <AnalystErrorCard
            message={msg.error ?? 'Analysis failed. Please try again.'}
            kind={msg.errorKind}
          />
        )}

        {/* Complete state */}
        {msg.status === 'complete' && (
          <>
            {/* Interpretation text */}
            {msg.content && (
              <div className="analyst-prose text-[14px] text-slate-700 leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-[18px] font-bold text-slate-800 mt-4 mb-2 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[15px] font-semibold text-slate-700 mt-4 mb-1.5 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[14px] font-semibold text-violet-700 mt-3 mb-1">{children}</h3>,
                    p:  ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                    em:     ({ children }) => <em className="italic text-slate-600">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-slate-600">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-slate-600">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    code: ({ children }) => <code className="bg-slate-100 text-violet-700 px-1 py-0.5 rounded text-[13px] font-mono">{children}</code>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-400 pl-3 my-2 text-slate-500 italic">{children}</blockquote>,
                    hr: () => <hr className="border-slate-200 my-4" />,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Student mode: conceptual step-by-step guide */}
            {mode === 'student' && msg.conceptualGuide && msg.conceptualGuide.length > 0 && (
              <ConceptualGuide steps={msg.conceptualGuide} />
            )}

            {/* Developer mode: show terminal output if present */}
            {mode === 'developer' && msg.logStream && msg.logStream.length > 0 && (
              <LiveTerminal lines={msg.logStream} retryCount={msg.retryCount} />
            )}

            {/* Results (charts / tables) */}
            {msg.results?.map((r, i) => (
              <ResultBlock key={i} result={r} sourcePrompt={msg.content} onPin={onPin} />
            ))}

            {/* Action buttons row */}
            {msg.jobId && (
              <div className="mt-4 space-y-3">
                {/* Literature cross-check */}
                <div>
                  {!msg.literature && (
                    <button
                      onClick={() => void findLiterature(msg.jobId!, msg.id)}
                      disabled={msg.isFindingLiterature}
                      className={cn(
                        'flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors',
                        msg.isFindingLiterature
                          ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
                      )}
                    >
                      {msg.isFindingLiterature ? (
                        <>
                          <span className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                          Searching literature…
                        </>
                      ) : (
                        <>
                          <Library size={11} />
                          Find related literature
                        </>
                      )}
                    </button>
                  )}
                  {msg.literature && (
                    <LiteraturePanel citations={msg.literature} />
                  )}
                </div>

                {/* Academic synthesis — always available once job is complete */}
                <SynthesisPanel
                  literature={msg.literature ?? []}
                  synthesis={msg.academicSynthesis}
                  isGenerating={msg.isGeneratingSynthesis ?? false}
                  isFetchingLiterature={msg.isFindingLiterature ?? false}
                  onGenerate={() => void generateSynthesis(msg.jobId!, msg.id, msg.literature ?? [], msg.results)}
                />

                {/* Outlier simulation */}
                <OutlierPanel messageId={msg.id} />

                {/* Write-up generator */}
                <WriteUpPanel messageId={msg.id} />

                {/* Methodology appendix */}
                <MethodologyPanel messageId={msg.id} jobId={msg.jobId} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Python code panel (Developer mode) ───────────────────────────────────────

function CodePanel({ code }: { code: string }) {
  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] border border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60 shrink-0">
        <Code2 size={13} className="text-violet-400" />
        <span className="text-xs font-semibold text-slate-300">Generated Python</span>
        <span className="ml-auto text-[10px] text-slate-600">Read-only · via E2B Sandbox</span>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={
          <pre className="p-4 text-[12px] text-slate-300 font-mono leading-relaxed overflow-auto h-full whitespace-pre-wrap">
            {code}
          </pre>
        }>
          <MonacoEditor
            height="100%"
            defaultLanguage="python"
            value={code}
            theme="vs-dark"
            options={{
              readOnly: true,
              fontSize: 12,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'none',
              folding: true,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
            }}
          />
        </Suspense>
      </div>
    </div>
  )
}

// ── Conversation panel (thread + suggestions + input) ─────────────────────────

function ConversationPanel({
  onPin,
}: {
  onPin: (result: AnalystResult, prompt: string) => void
}) {
  const { query, exportSessionDocx } = useAnalyst()
  const isQuerying  = useAnalystStore((s) => s.isQuerying)
  const isExporting = useAnalystStore((s) => s.isExporting)
  const messages    = useAnalystStore((s) => s.messages)
  const schema      = useAnalystStore((s) => s.schema)
  const sessionId   = useAnalystStore((s) => s.sessionId)
  const datasets           = useAnalystStore((s) => s.datasets)
  const selectedDatasetIds = useAnalystStore((s) => s.selectedDatasetIds)
  const selectedDatasetNames = selectedDatasetIds
    .map((id) => datasets.find((d) => d.datasetId === id)?.fileName)
    .filter((name): name is string => !!name)

  const user = useAuthStore((s) => s.user)
  const queryCost = CREDIT_COSTS.dataAnalystQuery
  const hasEnoughCredits = user
    ? user.plan === 'Unlimited' || user.creditsLimit - user.creditsUsed >= queryCost
    : true

  const [text, setText]   = useState('')
  const textareaRef        = useRef<HTMLTextAreaElement>(null)
  const threadRef          = useRef<HTMLDivElement>(null)

  const suggestions = useSuggestedQuestions(schema)

  const lastUserPrompt = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages])

  const submit = useCallback(() => {
    if (!text.trim() || isQuerying) return
    if (!hasEnoughCredits) {
      void import('../../store/uiStore').then(({ useUiStore }) => {
        useUiStore.getState().openCreditLimitModal({
          used: user?.creditsUsed ?? 0,
          limit: user?.creditsLimit ?? 0,
          resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        })
      })
      return
    }
    void query(text)
    setText('')
  }, [text, isQuerying, hasEnoughCredits, user, query])

  const fillSuggestion = useCallback((suggestion: string) => {
    setText(suggestion)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col min-h-0 rounded-2xl p-5" style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}>

      {/* Thread */}
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-5 pr-1 scrollbar-none"
        style={{ minHeight: 0 }}
      >
        {!hasMessages ? (
          /* Empty state: full suggestion grid */
          <div className="flex-1 flex flex-col items-center justify-center gap-5 py-8">
            <div className="text-center">
              <FileSpreadsheet size={36} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-medium">Dataset loaded. What would you like to know?</p>
              <p className="text-slate-400 text-sm mt-1">Click a question to edit it, then press Enter to run</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => fillSuggestion(s)}
                  disabled={isQuerying}
                  className="px-3 py-1.5 rounded-xl text-sm transition-colors disabled:opacity-40"
                  style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da', color: '#4b5563' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e0e0da'; (e.currentTarget as HTMLButtonElement).style.color = '#4b5563'; (e.currentTarget as HTMLButtonElement).style.background = '#f8f9fa' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onPin={(result) => onPin(result, lastUserPrompt)}
            />
          ))
        )}
      </div>

      {/* Compact suggestion pills — visible after first message */}
      {hasMessages && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3 pb-2 mt-3" style={{ borderTop: '0.5px solid #ebebea' }}>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider self-center pr-1 shrink-0">
            Suggest:
          </span>
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={() => fillSuggestion(s)}
              disabled={isQuerying}
              title={s}
              className="px-2.5 py-1 rounded-lg text-[11px] transition-colors disabled:opacity-40 truncate max-w-[220px]"
              style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da', color: '#6b7280' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e0e0da'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="pt-4" style={{ borderTop: '0.5px solid #ebebea' }}>
        {selectedDatasetIds.length > 1 && (
          <p className="flex items-center gap-1.5 text-[11px] text-violet-700 font-medium mb-2">
            <FileSpreadsheet size={11} />
            Joint analysis: {selectedDatasetNames.join(' + ')}
          </p>
        )}
        <div className="flex gap-3 items-end rounded-2xl px-4 py-3 transition-colors" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder="Ask anything about your data… e.g. 'Plot a correlation matrix of all numeric columns'"
            rows={2}
            disabled={isQuerying}
            className="flex-1 bg-transparent text-slate-700 placeholder-slate-400 text-sm resize-none outline-none leading-relaxed disabled:opacity-50"
          />
          {sessionId && (
            <button
              onClick={() => void exportSessionDocx()}
              disabled={isQuerying || isExporting}
              title="Export full session as .docx"
              className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-xl border disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
              style={{ background: '#ffffff', borderColor: '#e0e0da', color: '#6b7280' }}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Exporting…
                </>
              ) : (
                <>
                  <Download size={12} />
                  Export
                </>
              )}
            </button>
          )}
          <button
            onClick={submit}
            disabled={!text.trim() || isQuerying}
            title={hasEnoughCredits ? `Uses ${queryCost} credits` : 'Not enough credits — click to see plans'}
            className={cn(
              'shrink-0 w-8 h-8 rounded-xl hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors',
              hasEnoughCredits ? 'bg-violet-600' : 'bg-amber-500 hover:bg-amber-400',
            )}
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line · {queryCost} credits per question
          {!hasEnoughCredits && <span className="text-amber-600 font-medium"> · Not enough credits</span>}
        </p>
      </div>
    </div>
  )
}

// ── Objectives wizard ─────────────────────────────────────────────────────────

const OBJECTIVE_CARDS: {
  id: AnalyticalMethod
  label: string
  sub: string
  icon: React.ElementType
  accent: string
  selectedCls: string
}[] = [
  { id: 'descriptive',       label: 'Descriptive summary',  sub: 'Frequencies, means, distributions',   icon: PieChart,      accent: 'text-sky-600',     selectedCls: 'border-sky-400 bg-sky-50'     },
  { id: 'regression',        label: 'Predictive modeling',  sub: 'Regression, machine learning',        icon: TrendingUp,    accent: 'text-violet-600',  selectedCls: 'border-violet-400 bg-violet-50' },
  { id: 'hypothesis_testing',label: 'Hypothesis testing',   sub: 'ANOVA, T-test, Chi-Square',           icon: FlaskConical,  accent: 'text-emerald-600', selectedCls: 'border-emerald-400 bg-emerald-50' },
  { id: 'custom',            label: 'Custom intent',        sub: 'Describe your own research goal',     icon: Lightbulb,     accent: 'text-amber-600',   selectedCls: 'border-amber-400 bg-amber-50'  },
]

function ObjectivesWizard() {
  const wizardStep            = useAnalystStore((s) => s.wizardStep)
  const blueprint             = useAnalystStore((s) => s.blueprint)
  const isGeneratingBlueprint = useAnalystStore((s) => s.isGeneratingBlueprint)
  const isCleaning            = useAnalystStore((s) => s.isCleaning)
  const schema                = useAnalystStore((s) => s.schema)
  const setWizardStep         = useAnalystStore((s) => s.setWizardStep)

  const { generateBlueprint, applyBlueprint, skipWizard } = useAnalyst()

  const [selectedObjective,   setSelectedObjective]   = useState<AnalyticalMethod | null>(null)
  const [customIntent,        setCustomIntent]         = useState('')
  const [targetVariable,      setTargetVariable]       = useState('')
  const [predictorVariables,  setPredictorVariables]   = useState<string[]>([])
  const [groupingVariable,    setGroupingVariable]     = useState('')

  const columns   = schema?.columns.map((c) => c.name) ?? []
  const needsVars = selectedObjective === 'regression' || selectedObjective === 'hypothesis_testing'
  const totalSteps = needsVars ? 3 : 2
  const stepNum   = wizardStep === 'objectives' ? 1 : wizardStep === 'variables' ? 2 : totalSteps

  const togglePredictor = (col: string) =>
    setPredictorVariables((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    )

  const handleContinue = () => {
    if (!selectedObjective) return
    if (needsVars) {
      setWizardStep('variables')
    } else {
      void generateBlueprint({
        analyticalMethod: selectedObjective,
        customIntent: customIntent.trim() || undefined,
      })
    }
  }

  const handleGenerateBlueprint = () => {
    if (!selectedObjective) return
    void generateBlueprint({
      analyticalMethod:  selectedObjective,
      customIntent:      customIntent.trim() || undefined,
      targetVariable:    targetVariable || undefined,
      predictorVariables:predictorVariables.length > 0 ? predictorVariables : undefined,
      groupingVariable:  groupingVariable || undefined,
    })
  }

  const handleBack = () => {
    if (wizardStep === 'blueprint') {
      setWizardStep(needsVars ? 'variables' : 'objectives')
    } else {
      setWizardStep('objectives')
    }
  }

  if (!wizardStep) return null

  return (
    <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 shrink-0" style={{ borderBottom: '0.5px solid #e0e0da', background: '#ffffff' }}>
        <div>
          <p className="text-sm font-semibold text-slate-800">Prepare your dataset</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Step {stepNum} of {totalSteps}</p>
        </div>
        <button
          onClick={skipWizard}
          className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 transition-colors shrink-0"
        >
          Skip — start directly <ChevronRight size={11} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 shrink-0" style={{ background: '#f1f5f9' }}>
        <div
          className="h-full bg-violet-500 transition-all duration-500"
          style={{ width: `${(stepNum / totalSteps) * 100}%` }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-none min-h-0" style={{ background: 'var(--surface-page)' }}>

        {/* ── Step 1: select objective ────────────────────────── */}
        {wizardStep === 'objectives' && (
          <div className="space-y-5">
            <div>
              <p className="text-base font-semibold text-slate-800">What is your research objective?</p>
              <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                Telling us your goal lets the AI protect important variables and apply only the transformations your method actually needs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OBJECTIVE_CARDS.map(({ id, label, sub, icon: Icon, accent }) => {
                const isSel = selectedObjective === id
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedObjective(id)}
                    className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: '#ffffff',
                      border: isSel ? '1.5px solid #7c3aed' : '0.5px solid #e0e0da',
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed' }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.borderColor = '#e0e0da' }}
                  >
                    <span className={cn('shrink-0 mt-0.5', accent)}>
                      <Icon size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
                    </div>
                    {isSel && <Check size={13} className="text-violet-600 shrink-0 mt-0.5" />}
                  </button>
                )
              })}
            </div>

            {selectedObjective === 'custom' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Describe your research goal
                </label>
                <textarea
                  value={customIntent}
                  onChange={(e) => setCustomIntent(e.target.value)}
                  placeholder="e.g. I want to explore how income inequality affects health outcomes across districts…"
                  rows={3}
                  className="w-full rounded-xl px-3.5 py-2.5 text-[13px] text-slate-700 placeholder-slate-400 outline-none resize-none"
                  style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: variable mapping ────────────────────────── */}
        {wizardStep === 'variables' && (
          <div className="space-y-5">
            <div>
              <p className="text-base font-semibold text-slate-800">Map your research variables</p>
              <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                {selectedObjective === 'regression'
                  ? 'Tell the AI which column is your outcome and which are predictors so it can protect them during cleaning.'
                  : 'Specify the grouping column and the measured outcome so they are never imputed or dropped.'}
              </p>
            </div>

            {selectedObjective === 'regression' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-[9px] flex items-center justify-center font-bold">Y</span>
                    Dependent variable (outcome)
                  </label>
                  <select
                    value={targetVariable}
                    onChange={(e) => setTargetVariable(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none"
                    style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}
                  >
                    <option value="">Select the outcome column…</option>
                    {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 text-[9px] flex items-center justify-center font-bold">X</span>
                    Independent variables
                    <span className="text-slate-400 font-normal normal-case tracking-normal">— select one or more</span>
                  </label>
                  <div className="rounded-xl max-h-52 overflow-y-auto divide-y divide-[#ebebea] scrollbar-none" style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}>
                    {columns.map((col) => (
                      <label key={col} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={predictorVariables.includes(col)}
                          onChange={() => togglePredictor(col)}
                          className="accent-violet-600 w-3.5 h-3.5 shrink-0 cursor-pointer"
                        />
                        <span className="text-[12px] text-slate-700 font-mono truncate">{col}</span>
                      </label>
                    ))}
                  </div>
                  {predictorVariables.length > 0 && (
                    <p className="text-[11px] text-violet-600">
                      {predictorVariables.length} predictor{predictorVariables.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">Grouping variable</label>
                  <select
                    value={groupingVariable}
                    onChange={(e) => setGroupingVariable(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none"
                    style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}
                  >
                    <option value="">Select the grouping column…</option>
                    {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">Outcome variable</label>
                  <select
                    value={targetVariable}
                    onChange={(e) => setTargetVariable(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none"
                    style={{ background: '#ffffff', border: '0.5px solid #e0e0da' }}
                  >
                    <option value="">Select the outcome column…</option>
                    {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: blueprint preview ───────────────────────── */}
        {wizardStep === 'blueprint' && (
          <div className="space-y-5">
            {isGeneratingBlueprint ? (
              <div className="flex flex-col items-center justify-center gap-4 py-14">
                <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800">Building your blueprint…</p>
                  <p className="text-[12px] text-slate-500 mt-1">Analysing dataset structure and objective</p>
                </div>
              </div>
            ) : blueprint ? (
              <>
                <div>
                  <p className="text-base font-semibold text-slate-800">Your preparation blueprint</p>
                  <p className="text-[13px] text-slate-600 mt-2 leading-relaxed">{blueprint.explanation}</p>
                </div>

                {blueprint.steps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Planned transformations ({blueprint.steps.length})
                    </p>
                    {blueprint.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl border" style={{ background: '#ffffff', borderColor: '#e0e0da' }}>
                        <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 border border-violet-200 text-[9px] font-bold text-violet-700 flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 leading-snug">{step.action}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{step.rationale}</p>
                          {step.impact && (
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{step.impact}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {blueprint.protectedColumns.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={10} className="text-emerald-600" />
                      Protected — will not be modified
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {blueprint.protectedColumns.map((col) => (
                        <span key={col} className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: '0.5px solid #e0e0da', background: '#ffffff' }}>
        <div>
          {wizardStep !== 'objectives' && !isGeneratingBlueprint && (
            <button
              onClick={handleBack}
              disabled={isCleaning}
              className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={13} /> Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {wizardStep === 'objectives' && (
            <button
              onClick={handleContinue}
              disabled={!selectedObjective || (selectedObjective === 'custom' && !customIntent.trim())}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
              style={{ background: !selectedObjective || (selectedObjective === 'custom' && !customIntent.trim()) ? '#c4b5fd' : '#7c3aed' }}
            >
              Continue <ChevronRight size={13} />
            </button>
          )}

          {wizardStep === 'variables' && (
            <button
              onClick={handleGenerateBlueprint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[13px] font-semibold transition-colors"
              style={{ background: '#7c3aed' }}
            >
              <Wand2 size={13} /> Generate blueprint
            </button>
          )}

          {wizardStep === 'blueprint' && !isGeneratingBlueprint && blueprint && (
            <button
              onClick={() => void applyBlueprint(blueprint as PreparationBlueprint, selectedObjective ?? 'descriptive')}
              disabled={isCleaning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#059669' }}
            >
              {isCleaning ? (
                <><span className="w-3 h-3 rounded-full border-2 border-white/60 border-t-transparent animate-spin" /> Applying…</>
              ) : (
                <><Check size={13} /> Apply &amp; start analysis</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Example queries shown below the upload zone ───────────────────────────────

const EXAMPLE_QUERIES = [
  'Plot a correlation matrix of all numeric columns',
  'Run a linear regression on column X',
  'Show summary statistics',
  'Find missing values and outliers',
  'Compare group means with ANOVA',
]

// ── Upload zone (white card, dashed border, light-theme) ──────────────────────

function UploadZone() {
  const { upload }   = useAnalyst()
  const isUploading  = useAnalystStore((s) => s.isUploading)
  const inputRef     = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  // Self-declared, not inferred. Left unchecked, nothing is sent (stays "not declared" — see
  // AnalystDataset.IsSyntheticData) rather than defaulting every upload to an affirmative "real,"
  // which would silently overstate what's actually known about the data's provenance.
  const [isSynthetic, setIsSynthetic] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) void upload(files, isSynthetic || undefined)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-5 rounded-2xl cursor-pointer transition-all duration-200 py-14 px-8 text-center select-none bg-white',
          dragging
            ? 'border-[1.5px] border-dashed border-violet-500 bg-violet-50/40'
            : 'border-[1.5px] border-dashed border-[#d1d5db] hover:border-violet-400 hover:bg-violet-50/20',
          isUploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.dta,.rds,.rdata,.omv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {isUploading ? (
          <>
            <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Parsing & profiling dataset…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
              <UploadCloud size={26} className="text-violet-500" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-800 mb-1">Drop your dataset(s) here</p>
              <p className="text-sm text-slate-500">CSV, Excel, Stata (.dta), R (.rds), Jamovi (.omv) · max 50 MB each · multiple files supported</p>
            </div>
          </>
        )}
      </div>
      <label
        className="flex items-center gap-2 justify-center text-xs text-slate-500 cursor-pointer select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSynthetic}
          onChange={(e) => setIsSynthetic(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />
        This is synthetic or practice data, not real collected data
      </label>
    </div>
  )
}

// ── Dataset sidebar (left panel) ──────────────────────────────────────────────

function DatasetSidebar() {
  const { upload }          = useAnalyst()
  const datasets            = useAnalystStore((s) => s.datasets)
  const selectedDatasetIds  = useAnalystStore((s) => s.selectedDatasetIds)
  const datasetId           = useAnalystStore((s) => s.datasetId)
  const schema              = useAnalystStore((s) => s.schema)
  const isUploading         = useAnalystStore((s) => s.isUploading)
  const reset               = useAnalystStore((s) => s.reset)
  const toggleDatasetSelected = useAnalystStore((s) => s.toggleDatasetSelected)
  const setPrimaryDataset     = useAnalystStore((s) => s.setPrimaryDataset)
  const inputRef            = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) void upload(files)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#ffffff' }}>
      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '0.5px solid #e0e0da' }}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-violet-600" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Datasets</span>
        </div>
        <button
          onClick={() => !isUploading && inputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
        >
          {isUploading
            ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
            : <><Plus size={12} /> Upload Dataset</>}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.dta,.rds,.rdata,.omv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {datasets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <FileSpreadsheet size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 leading-relaxed">
                No dataset loaded.<br />Upload a file to begin.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Dataset list — checkbox selects a dataset into the next query (multiple =
                joint analysis); clicking the row body makes that dataset "primary" so the
                schema/health/wizard panel below reflects it. */}
            <div className="mx-3 mt-3 mb-1 space-y-1 shrink-0 max-h-48 overflow-y-auto scrollbar-none">
              {datasets.map((ds) => {
                const isSelected = selectedDatasetIds.includes(ds.datasetId)
                const isPrimary  = ds.datasetId === datasetId
                return (
                  <div
                    key={ds.datasetId}
                    onClick={() => setPrimaryDataset(ds.datasetId)}
                    title={isPrimary ? undefined : 'Click to view this dataset\'s schema & tools'}
                    className={cn(
                      'flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors',
                      isPrimary ? '' : 'hover:bg-slate-50',
                    )}
                    style={isPrimary ? { background: '#ede9fe', borderLeft: '2px solid #7c3aed' } : { borderLeft: '2px solid transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleDatasetSelected(ds.datasetId)}
                      className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
                    />
                    <FileSpreadsheet size={14} className={cn('shrink-0 mt-0.5', isPrimary ? 'text-violet-600' : 'text-slate-400')} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold truncate', isPrimary ? 'text-violet-900' : 'text-slate-700')}>{ds.fileName}</p>
                      <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: isPrimary ? '#5b21b6' : '#94a3b8' }}>
                        {ds.rowCount.toLocaleString()} rows · {ds.columnCount} cols
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedDatasetIds.length > 1 && (
              <div className="mx-3 mb-1 px-2.5 py-1.5 rounded-lg text-[10px] text-violet-700 shrink-0" style={{ background: '#f5f3ff' }}>
                Joint analysis: {selectedDatasetIds.length} datasets selected
              </div>
            )}

            <div className="mx-3 mb-2 shrink-0">
              <button
                onClick={reset}
                title="Clear all datasets"
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RefreshCcw size={10} /> Clear all
              </button>
            </div>

            {/* Schema detail for the primary dataset — schema panel already shows
                filename/reset; hide its header since the list above covers it. */}
            {schema && (
              <div className="flex-1 overflow-hidden flex flex-col px-3 pb-3">
                <SchemaPanel onReset={reset} showHeader={false} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalystPage() {
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()
  const schema      = useAnalystStore((s) => s.schema)
  const messages    = useAnalystStore((s) => s.messages)
  const mode        = useAnalystStore((s) => s.mode)
  const wizardStep  = useAnalystStore((s) => s.wizardStep)
  const sessionId   = useAnalystStore((s) => s.sessionId)
  const stepCount   = useAnalystStore((s) => s.stepCount)
  const { pinChart } = useWorkbench()
  const { clearSession } = useAnalyst()
  const [researchProjects, setResearchProjects] = useState<Array<{ id: string; title: string }>>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [linkedProjectId, setLinkedProjectId] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [linkingProject, setLinkingProject] = useState(false)

  useEffect(() => {
    const requestedSessionId = searchParams.get('sessionId')
    const requestedProjectId = searchParams.get('projectId')
    const requestedDatasetId = searchParams.get('datasetId')
    if (!requestedSessionId || !requestedProjectId || !requestedDatasetId || sessionId === requestedSessionId) return

    Promise.all([
      analystApi.getSession(requestedSessionId),
      researchApi.getProjectDatasets(requestedProjectId),
    ]).then(([session, datasets]) => {
      const dataset = datasets.find(item => item.datasetId === requestedDatasetId)
      if (!dataset) throw new Error('The linked dataset is no longer available.')

      const resumedSchema = {
        datasetId: dataset.datasetId,
        fileName: dataset.fileName,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        columns: [],
        fileSizeBytes: dataset.fileSizeBytes,
        uploadedAt: dataset.uploadedAt,
      }

      useAnalystStore.setState({
        datasetId: dataset.datasetId,
        schema: resumedSchema,
        // Session resume only surfaces the primary dataset — a resumed multi-dataset
        // session still queries correctly (the backend re-derives the full combination),
        // but the sidebar here only shows the primary until full resume UI is built.
        datasets: [resumedSchema],
        selectedDatasetIds: [dataset.datasetId],
        sessionId: session.sessionId,
        stepCount: session.stepCount,
        academicLevel: session.academicLevel === 0 ? 'undergraduate' : session.academicLevel === 2 ? 'doctoral' : 'masters',
        wizardStep: null,
        isCleaned: true,
        messages: session.steps.flatMap(step => [
          {
            id: `session-${session.sessionId}-${step.stepNumber}-question`,
            role: 'user' as const,
            content: step.query,
            status: 'complete' as const,
            createdAt: step.timestamp,
          },
          {
            id: `session-${session.sessionId}-${step.stepNumber}-answer`,
            role: 'assistant' as const,
            content: step.interpretedResult,
            results: step.results,
            status: 'complete' as const,
            createdAt: step.timestamp,
          },
        ]),
      })
    }).catch(error => {
      toast.error((error as { message?: string })?.message ?? 'Could not restore the completed analysis.')
    })
  }, [searchParams, sessionId])

  useEffect(() => {
    if (!sessionId || stepCount < 1) return
    setLoadingProjects(true)
    researchApi.list()
      .then(projects => setResearchProjects(projects.map(project => ({
        id: project.id,
        title: project.title || 'Untitled research project',
      }))))
      .catch(() => toast.error('Could not load your research projects.'))
      .finally(() => setLoadingProjects(false))
  }, [sessionId, stepCount])

  useEffect(() => {
    setLinkedProjectId('')
    setSelectedProjectId('')
  }, [sessionId])

  const linkAnalysisToProject = async () => {
    if (!sessionId || !selectedProjectId) return
    setLinkingProject(true)
    try {
      await researchApi.linkSession(selectedProjectId, sessionId)
      setLinkedProjectId(selectedProjectId)
      toast.success('Completed analysis linked to the research project.')
    } catch (error) {
      toast.error((error as { message?: string })?.message ?? 'Could not link this analysis session.')
    } finally {
      setLinkingProject(false)
    }
  }

  const latestPythonCode = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.pythonCode)
    ?.pythonCode ?? ''

  const lastUserPrompt = [...messages]
    .reverse()
    .find((m) => m.role === 'user')
    ?.content ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar (standard module pattern) ── */}
      <div style={{
        height: 44,
        background: '#ffffff',
        borderBottom: '0.5px solid #e0e0da',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>Data Analyst</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Upload a dataset and analyse it with natural language</span>
        <div style={{ flex: 1 }} />
        {schema && (
          <div className="flex items-center gap-2">
            <AcademicLevelToggle />
            <ModeToggle />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel: dataset sidebar ── */}
        <div style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '0.5px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <DatasetSidebar />
        </div>

        {/* ── Main content ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-page)',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          <AnimatePresence mode="wait">
            {!schema ? (
              /* Upload empty state */
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex-1 flex flex-col items-center justify-center p-10"
              >
                <div className="w-full max-w-md">
                  <UploadZone />

                  {/* Suggestion chips */}
                  <div className="mt-5 text-center">
                    <p className="text-xs text-slate-500 mb-3">Try asking after upload:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {EXAMPLE_QUERIES.map((q) => (
                        <span
                          key={q}
                          className="px-3 py-1.5 rounded-full text-xs border border-violet-200 bg-white text-violet-700 cursor-default"
                        >
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Dataset loaded */
              <motion.div
                key="canvas"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                {/* Session continuity banner */}
                {sessionId && (
                  <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-violet-700 shrink-0" style={{ background: '#f5f3ff', border: '0.5px solid #ddd6fe' }}>
                    <GraduationCap size={12} className="shrink-0 text-violet-600" />
                    <span className="flex-1">
                      Session active — <span className="font-semibold text-violet-800">{stepCount}</span> {stepCount === 1 ? 'analysis' : 'analyses'} in context
                    </span>
                    {stepCount > 0 && !linkedProjectId && <>
                      <select
                        aria-label="Research project"
                        value={selectedProjectId}
                        disabled={loadingProjects || linkingProject}
                        onChange={event => setSelectedProjectId(event.target.value)}
                        className="max-w-64 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] text-slate-700 disabled:opacity-50"
                      >
                        <option value="">{loadingProjects ? 'Loading projects…' : 'Select research project…'}</option>
                        {researchProjects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                      </select>
                      <button
                        disabled={!selectedProjectId || linkingProject}
                        onClick={() => void linkAnalysisToProject()}
                        className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        {linkingProject ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Link analysis
                      </button>
                    </>}
                    {linkedProjectId && <button
                      onClick={() => navigate(`/app/research-agent/${linkedProjectId}/dashboard`)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
                    >
                      <Check size={10} /> Linked · Open project
                    </button>}
                    <button
                      onClick={clearSession}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-violet-600 hover:text-violet-800 hover:bg-violet-100 transition-colors"
                      style={{ border: '0.5px solid #ddd6fe' }}
                    >
                      <RefreshCcw size={9} /> New session
                    </button>
                  </div>
                )}

                {/* Wizard or conversation + optional Monaco panel */}
                <div
                  className={cn(
                    'flex-1 min-h-0 grid gap-4 p-4',
                    mode === 'developer'
                      ? 'grid-cols-1 lg:grid-cols-[1fr_380px]'
                      : 'grid-cols-1',
                  )}
                >
                  {wizardStep !== null ? (
                    <ObjectivesWizard />
                  ) : (
                    <ConversationPanel
                      onPin={(result) =>
                        pinChart(result as import('../../types/analyst').ChartResult, lastUserPrompt)
                      }
                    />
                  )}

                  {/* Developer-only Monaco panel */}
                  <AnimatePresence>
                    {mode === 'developer' && (
                      <motion.div
                        key="monaco"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.22 }}
                        className="min-h-0"
                      >
                        {latestPythonCode ? (
                          <CodePanel code={latestPythonCode} />
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center rounded-2xl p-6 text-center gap-3" style={{ background: '#f8f9fa', border: '0.5px solid #e0e0da' }}>
                            <Code2 size={32} className="text-slate-300" />
                            <p className="text-slate-600 text-sm font-medium">No code yet</p>
                            <p className="text-slate-400 text-xs max-w-xs">
                              Run an analysis and the generated Python script will appear here.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}
