import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadCloud, BarChart2, Table2, User, Sparkles, FileSpreadsheet,
  RefreshCcw, Send, X, Pin, PinOff, BookOpen, Wand2,
  AlertTriangle, ExternalLink, ScrollText, ShieldCheck,
  ChevronDown, ChevronUp, Layers, CheckCircle2, XCircle,
  Code2, Terminal, RotateCcw, GraduationCap, MessageSquare,
  Activity, Info,
} from 'lucide-react'
import { AnalystErrorCard } from '../../components/ui/AnalystErrorCard'
import { cn } from '../../lib/utils'
import { useAnalystStore } from '../../store/analystStore'
import { useWorkbenchStore } from '../../store/workbenchStore'
import { useAnalyst } from '../../hooks/useAnalyst'
import { useWorkbench } from '../../hooks/useWorkbench'
import type { AnalystResult, ColumnSchema, WorkbenchMode } from '../../types/analyst'
import type { ProseMode, FlaggedBlock, CitationAsset, PinnedChart } from '../../types/workbench'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

// ── Dtype badge ───────────────────────────────────────────────────────────────

function DtypeBadge({ dtype }: { dtype: string }) {
  const map: Record<string, string> = {
    int64:      'bg-blue-500/15 text-blue-400',
    float64:    'bg-indigo-500/15 text-indigo-400',
    object:     'bg-slate-500/15 text-slate-400',
    datetime64: 'bg-emerald-500/15 text-emerald-400',
    bool:       'bg-amber-500/15 text-amber-400',
  }
  const base = dtype.startsWith('datetime') ? 'datetime64' : dtype
  return (
    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', map[base] ?? 'bg-slate-700 text-slate-400')}>
      {dtype.startsWith('datetime') ? 'date' : dtype}
    </span>
  )
}

// ── Null health badge ─────────────────────────────────────────────────────────

function NullBadge({ pct }: { pct: number }) {
  if (pct === 0) return null
  if (pct === 100)
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-red-500/15 text-red-400">
        <X size={7} /> 100%
      </span>
    )
  if (pct >= 50)
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">
        <AlertTriangle size={7} /> {Math.round(pct)}%
      </span>
    )
  return <span className="text-[10px] text-slate-600">{Math.round(pct)}%</span>
}

// ── Schema panel ──────────────────────────────────────────────────────────────

function SchemaPanel({ onReset }: { onReset: () => void }) {
  const schema = useAnalystStore((s) => s.schema)
  if (!schema) return null

  const colsWithPct  = schema.columns.filter((c) => c.nullPercent !== undefined)
  const healthScore  = colsWithPct.length > 0
    ? Math.round(100 - colsWithPct.reduce((sum, c) => sum + (c.nullPercent ?? 0), 0) / colsWithPct.length)
    : null
  const criticalCols = schema.columns.filter((c) => (c.nullPercent ?? 0) === 100)
  const warnCols     = schema.columns.filter((c) => { const p = c.nullPercent ?? 0; return p >= 50 && p < 100 })

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{schema.fileName}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {schema.rowCount.toLocaleString()} rows · {schema.columnCount} cols
          </p>
        </div>
        <button
          onClick={onReset}
          title="Load new file"
          className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
        >
          <RefreshCcw size={12} />
        </button>
      </div>

      {/* Data health summary */}
      {healthScore !== null && (
        <div className="mb-2 p-2 rounded-lg space-y-1" style={{ background: '#f8fafc', border: '0.5px solid var(--border-hairline)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Data Health</span>
            <span className={cn(
              'text-xs font-bold',
              healthScore >= 80 ? 'text-emerald-400'
              : healthScore >= 50 ? 'text-amber-400'
              : 'text-red-400'
            )}>{healthScore}%</span>
          </div>
          <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          {criticalCols.length > 0 && (
            <p className="text-[10px] text-red-400 flex items-center gap-1">
              <X size={8} /> {criticalCols.length} column{criticalCols.length > 1 ? 's' : ''} 100% null
            </p>
          )}
          {warnCols.length > 0 && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1">
              <AlertTriangle size={8} /> {warnCols.length} column{warnCols.length > 1 ? 's' : ''} ≥50% null
            </p>
          )}
        </div>
      )}

      <div className="overflow-y-auto space-y-0.5 scrollbar-none max-h-44">
        {schema.columns.map((col: ColumnSchema) => (
          <div
            key={col.name}
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded',
              (col.nullPercent ?? 0) === 100 ? 'bg-red-500/5 border border-red-500/15'
              : (col.nullPercent ?? 0) >= 50  ? 'bg-amber-500/5 border border-amber-500/15'
              : '',
            )}
            style={(col.nullPercent ?? 0) < 50 ? { background: '#f8fafc' } : {}}
          >
            <span className="flex-1 text-[12px] truncate font-mono" style={{ color: 'var(--text-secondary)' }}>{col.name}</span>
            <DtypeBadge dtype={col.dtype} />
            {col.nullPercent !== undefined
              ? <NullBadge pct={col.nullPercent} />
              : col.nullable && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>null</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle() {
  const mode    = useAnalystStore((s) => s.mode)
  const setMode = useAnalystStore((s) => s.setMode)
  return (
    <div className="flex items-center p-0.5 rounded-lg" style={{ background: '#f1f5f9', border: '0.5px solid var(--border-hairline)' }}>
      {([
        { id: 'student'   as WorkbenchMode, label: 'Student',   icon: GraduationCap },
        { id: 'developer' as WorkbenchMode, label: 'Developer', icon: Code2 },
      ] as const).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
          style={mode === id
            ? { background: 'var(--color-purple)', color: '#fff' }
            : { color: 'var(--text-muted)' }}
        >
          <Icon size={10} /> {label}
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
        <Terminal size={10} className="text-slate-500" />
        <span className="text-[10px] text-slate-500 font-mono">Sandbox Terminal</span>
        {retryCount !== undefined && retryCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
            <RotateCcw size={9} /> Self-healed ×{retryCount}
          </span>
        )}
      </div>
      <div className="p-2.5 max-h-36 overflow-y-auto scrollbar-none font-mono text-[11px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={cn(
            line.startsWith('[✓]') ? 'text-emerald-400'
            : line.startsWith('⚠') || line.startsWith('[!]') ? 'text-amber-400'
            : line.includes('ERROR') || line.includes('Traceback') ? 'text-red-400'
            : line.startsWith('[*]') ? 'text-violet-300'
            : 'text-slate-400'
          )}>{line}</div>
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
    <div className="mt-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
        <BookOpen size={9} /> Step-by-step breakdown
      </p>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-2">
          <span className="shrink-0 w-4 h-4 rounded-full bg-violet-500/20 border border-violet-500/30 text-[9px] font-bold text-violet-300 flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <p className="text-[12px] text-slate-300 leading-relaxed">{step}</p>
        </div>
      ))}
    </div>
  )
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone() {
  const { upload }   = useAnalyst()
  const isUploading  = useAnalystStore((s) => s.isUploading)
  const inputRef     = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (files?.[0]) void upload(files[0])
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => !isUploading && inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-5 text-center select-none',
        isUploading && 'pointer-events-none opacity-60',
      )}
      style={{
        borderColor: dragging ? 'var(--color-purple)' : 'var(--border-strong)',
        background: dragging ? 'var(--color-purple-tint)' : '#f8fafc',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {isUploading ? (
        <>
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-xs">Parsing & profiling dataset…</p>
        </>
      ) : (
        <>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--color-purple-tint)',
            border: '0.5px solid #c4b5fd',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UploadCloud size={22} style={{ color: 'var(--color-purple)' }} />
          </div>
          <div>
            <p className="font-medium text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>Drop your dataset here</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>CSV, Excel · max 50 MB</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Result renderer (with pin button) ────────────────────────────────────────

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
          className="rounded-xl border border-slate-700/50 max-w-full"
        />
        {onPin && (
          <button
            onClick={() => onPin(result, sourcePrompt)}
            className="absolute top-2 right-2 bg-slate-900/90 border border-slate-700 text-violet-400 hover:text-violet-300 text-[11px] px-2 py-1 rounded-lg flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
          >
            <Pin size={11} /> Pin
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 overflow-x-auto">
      {result.caption && (
        <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
          <Table2 size={11} /> {result.caption}
        </p>
      )}
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr>
            {result.headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 bg-slate-800 text-slate-400 font-semibold border-b border-slate-700 first:rounded-tl-lg last:rounded-tr-lg whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-slate-300 font-mono whitespace-nowrap">
                  {cell ?? <span className="text-slate-600">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const mode   = useAnalystStore((s) => s.mode)
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex items-start gap-2 justify-end">
        <div className="max-w-[78%] px-3 py-2 rounded-2xl rounded-tr-sm bg-violet-600/20 border border-violet-500/25 text-slate-200 text-[13px] leading-relaxed">
          {msg.content}
        </div>
        <div className="shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
          <User size={11} className="text-slate-300" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <div className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
        <Sparkles size={11} className="text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Pending / Running */}
        {(msg.status === 'pending' || msg.status === 'running') && (
          <>
            <div className="flex items-center gap-1.5 text-slate-500 text-xs py-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
              <span className="ml-1">{msg.status === 'running' ? 'Executing in sandbox…' : 'Preparing…'}</span>
            </div>
            {msg.status === 'running' && msg.logStream && msg.logStream.length > 0 && (
              <LiveTerminal lines={msg.logStream} retryCount={msg.retryCount} />
            )}
          </>
        )}

        {/* Error */}
        {msg.status === 'error' && (
          <AnalystErrorCard
            message={msg.error ?? 'Analysis failed. Please try again.'}
            kind={msg.errorKind}
          />
        )}

        {/* Complete */}
        {msg.status === 'complete' && (
          <>
            {msg.content && (
              <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            )}

            {/* Student mode: step-by-step conceptual guide */}
            {mode === 'student' && msg.conceptualGuide && msg.conceptualGuide.length > 0 && (
              <ConceptualGuide steps={msg.conceptualGuide} />
            )}

            {/* Developer mode: show terminal log */}
            {mode === 'developer' && msg.logStream && msg.logStream.length > 0 && (
              <LiveTerminal lines={msg.logStream} retryCount={msg.retryCount} />
            )}

            {msg.results?.map((r, i) => (
              <ResultBlock key={i} result={r} sourcePrompt={msg.content} onPin={onPin} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Query input ───────────────────────────────────────────────────────────────

function QueryInput() {
  const { query }  = useAnalyst()
  const isQuerying = useAnalystStore((s) => s.isQuerying)
  const [text, setText] = useState('')

  const submit = () => {
    if (!text.trim() || isQuerying) return
    void query(text)
    setText('')
  }

  return (
    <div className="pt-3 shrink-0" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
      <div className="flex gap-2 items-end rounded-xl px-3 py-2" style={{ background: '#f8fafc', border: '0.5px solid var(--border-strong)' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder="Ask anything about your data…"
          rows={2}
          disabled={isQuerying}
          className="flex-1 bg-transparent text-xs resize-none outline-none leading-relaxed disabled:opacity-50"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || isQuerying}
          className="shrink-0 w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center transition-colors"
        >
          <Send size={12} className="text-white" />
        </button>
      </div>
    </div>
  )
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Summarise all columns',
  'Plot a correlation matrix',
  'Run a linear regression',
  'Show columns with missing values',
]

function SuggestedPrompts() {
  const { query }  = useAnalyst()
  const isQuerying = useAnalystStore((s) => s.isQuerying)
  const messages   = useAnalystStore((s) => s.messages)
  if (messages.length > 0) return null

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
      <div className="text-center">
        <FileSpreadsheet size={28} className="mx-auto mb-2" style={{ color: 'var(--text-disabled)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Dataset ready</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Try a prompt to start your analysis</p>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => !isQuerying && void query(s)}
            disabled={isQuerying}
            className="px-2.5 py-1 rounded-lg text-xs transition-colors disabled:opacity-40"
            style={{ background: '#ffffff', border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-rail)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Pinned charts gallery ─────────────────────────────────────────────────────

function PinnedGallery() {
  const pinnedCharts = useWorkbenchStore((s) => s.pinnedCharts)
  const unpinChart   = useWorkbenchStore((s) => s.unpinChart)
  const [open, setOpen] = useState(true)
  if (pinnedCharts.length === 0) return null

  return (
    <div className="border-t border-slate-700/60 shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1 py-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
          <Pin size={11} /> Pinned Assets ({pinnedCharts.length})
        </span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {pinnedCharts.map((c: PinnedChart) => (
                <div key={c.id} className="shrink-0 w-28 relative group rounded-lg overflow-hidden" style={{ border: '0.5px solid var(--border-hairline)', background: '#f8fafc' }}>
                  <img
                    src={`data:image/png;base64,${c.base64Png}`}
                    alt={c.caption ?? 'Chart'}
                    className="w-full h-20 object-cover"
                  />
                  <button
                    onClick={() => unpinChart(c.id)}
                    className="absolute top-1 right-1 bg-slate-900/80 text-slate-400 hover:text-red-400 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <PinOff size={10} />
                  </button>
                  {c.caption && (
                    <p className="text-[10px] text-slate-500 px-1.5 py-1 truncate">{c.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Monaco code panel (Developer mode) ───────────────────────────────────────

function CodePanelView({ code }: { code: string }) {
  return (
    <div className="flex-1 min-h-0 bg-[#1e1e2e] rounded-xl overflow-hidden border border-slate-700/40">
      <Suspense fallback={
        <pre className="p-3 text-[11px] text-slate-300 font-mono leading-relaxed overflow-auto h-full whitespace-pre-wrap">
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
            fontSize: 11,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'none',
            folding: true,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
          }}
        />
      </Suspense>
    </div>
  )
}

// ── Left panel (Analysis chat + optional Code tab) ────────────────────────────

type LeftTab = 'chat' | 'code'

function LeftPanel({
  onPin,
  latestCode,
}: {
  onPin: (result: AnalystResult, prompt: string) => void
  latestCode: string
}) {
  const schema     = useAnalystStore((s) => s.schema)
  const messages   = useAnalystStore((s) => s.messages)
  const mode       = useAnalystStore((s) => s.mode)
  const reset      = useAnalystStore((s) => s.reset)
  const threadRef  = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<LeftTab>('chat')

  // Switch to chat tab when a new assistant message arrives
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && last.status === 'running') setTab('chat')
  }, [messages])

  useEffect(() => {
    if (tab === 'chat' && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, tab])

  const lastUserPrompt = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  return (
    <div
      className="flex flex-col min-h-0 rounded-2xl p-4 gap-3"
      style={{ maxHeight: 'calc(100vh - 7rem)', background: '#ffffff', border: '0.5px solid var(--border-hairline)' }}
    >
      {/* Schema */}
      {schema && (
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Schema</p>
            <ModeToggle />
          </div>
          <SchemaPanel onReset={reset} />
        </div>
      )}

      {schema && <div className="shrink-0" style={{ borderTop: '0.5px solid var(--border-hairline)' }} />}

      {/* Tab bar (Code tab only in Developer mode) */}
      {schema && mode === 'developer' && (
        <div className="flex items-center gap-0.5 shrink-0">
          {([
            { id: 'chat' as LeftTab, label: 'Analysis', icon: MessageSquare },
            { id: 'code' as LeftTab, label: 'Python',   icon: Code2 },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                tab === id
                  ? 'border'
                  : '',
              )}
              style={tab === id ? {
                background: 'var(--color-purple-tint)',
                color: 'var(--color-purple)',
                border: '0.5px solid #c4b5fd',
              } : { color: 'var(--text-muted)' }}
            >
              <Icon size={10} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Chat thread */}
      {(tab === 'chat' || mode !== 'developer') && (
        <>
          <div
            ref={threadRef}
            className="flex-1 overflow-y-auto space-y-4 scrollbar-none"
            style={{ minHeight: 0 }}
          >
            {messages.length === 0
              ? <SuggestedPrompts />
              : messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onPin={(result, _) => onPin(result, lastUserPrompt)}
                  />
                ))
            }
          </div>
          <QueryInput />
        </>
      )}

      {/* Code panel (Developer mode, Code tab) */}
      {tab === 'code' && mode === 'developer' && (
        latestCode ? (
          <>
            <div className="flex items-center gap-2 shrink-0">
              <Code2 size={11} className="text-violet-400" />
              <span className="text-[11px] text-slate-400 font-mono">Latest generated script · E2B Sandbox</span>
            </div>
            <CodePanelView code={latestCode} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl p-6 text-center gap-2" style={{ border: '1.5px dashed var(--border-strong)' }}>
            <Code2 size={28} style={{ color: 'var(--text-disabled)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>No code yet</p>
            <p className="text-[11px] max-w-xs" style={{ color: 'var(--text-muted)' }}>
              Run an analysis query and the generated Python script will appear here.
            </p>
          </div>
        )
      )}

      <PinnedGallery />
    </div>
  )
}

// ── Abstract panel ────────────────────────────────────────────────────────────

function AbstractPanel() {
  const abstractText          = useWorkbenchStore((s) => s.abstractText)
  const isGeneratingAbstract  = useWorkbenchStore((s) => s.isGeneratingAbstract)
  const setManuscriptText     = useWorkbenchStore((s) => s.setManuscriptText)
  const manuscriptText        = useWorkbenchStore((s) => s.manuscriptText)
  const { generateAbstract }  = useWorkbench()
  const schema                = useAnalystStore((s) => s.schema)
  const hasAnalysis           = useAnalystStore((s) => s.messages.some((m) => m.status === 'complete'))

  const insertIntoManuscript = () => {
    if (!abstractText) return
    setManuscriptText(manuscriptText ? `${manuscriptText}\n\n${abstractText}` : abstractText)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Academic Abstract Generator</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Converts your analysis conversation and dataset statistics into a structured,
            publication-ready abstract (Background · Methodology · Results · Conclusion).
          </p>
        </div>
        <button
          onClick={() => void generateAbstract()}
          disabled={isGeneratingAbstract || !schema || !hasAnalysis}
          className="shrink-0 flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <Sparkles size={13} />
          {isGeneratingAbstract ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {!abstractText ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl text-center p-8 gap-2" style={{ border: '1.5px dashed var(--border-strong)' }}>
          <BookOpen size={32} style={{ color: 'var(--text-disabled)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No abstract yet</p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
            {!schema
              ? 'Upload a dataset first.'
              : !hasAnalysis
              ? 'Ask at least one question in the chat panel to your left, then come back to generate your abstract.'
              : 'Click Generate above to compile your analysis into a structured academic abstract.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          <div className="flex-1 overflow-y-auto rounded-xl p-4 scrollbar-none" style={{ background: '#f8fafc', border: '0.5px solid var(--border-hairline)' }}>
            <pre className="text-[13px] leading-relaxed font-serif whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
              {abstractText}
            </pre>
          </div>
          <button
            onClick={insertIntoManuscript}
            className="flex items-center gap-1.5 self-end text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-500/60 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ScrollText size={12} /> Insert into Editor
          </button>
        </div>
      )}
    </div>
  )
}

// ── Prose toolbar ─────────────────────────────────────────────────────────────

interface ProseToolbarProps {
  selection: { start: number; end: number; text: string } | null
  isOptimizing: boolean
  onApply: (mode: ProseMode) => void
  onDismiss: () => void
}

function ProseToolbar({ selection, isOptimizing, onApply, onDismiss }: ProseToolbarProps) {
  if (!selection) return null

  return (
    <AnimatePresence>
      <motion.div
        key="toolbar"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 shadow-xl"
      >
        <Wand2 size={12} className="text-slate-500 mr-1 shrink-0" />
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider pr-2 border-r border-slate-700">
          Rewrite:
        </span>
        {(
          [
            { mode: 'academic'  as ProseMode, label: 'Academic',  color: 'text-indigo-300 hover:bg-indigo-500/10' },
            { mode: 'humanised' as ProseMode, label: 'Humanise',  color: 'text-emerald-300 hover:bg-emerald-500/10' },
            { mode: 'concise'   as ProseMode, label: 'Concise',   color: 'text-amber-300 hover:bg-amber-500/10' },
          ]
        ).map(({ mode, label, color }) => (
          <button
            key={mode}
            onClick={() => onApply(mode)}
            disabled={isOptimizing}
            className={cn('text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-40', color)}
          >
            {label}
          </button>
        ))}
        <button onClick={onDismiss} className="ml-1 text-slate-600 hover:text-slate-400 p-0.5">
          <X size={11} />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Manuscript panel ──────────────────────────────────────────────────────────

function ManuscriptPanel() {
  const manuscriptText    = useWorkbenchStore((s) => s.manuscriptText)
  const isOptimizingProse = useWorkbenchStore((s) => s.isOptimizingProse)
  const setManuscriptText = useWorkbenchStore((s) => s.setManuscriptText)
  const { optimizeProse } = useWorkbench()

  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const detectSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const selected = el.value.substring(el.selectionStart, el.selectionEnd)
    if (selected.trim().length > 5) {
      setSelection({ start: el.selectionStart, end: el.selectionEnd, text: selected })
    } else {
      setSelection(null)
    }
  }, [])

  const applyProse = useCallback(async (mode: ProseMode) => {
    if (!selection) return
    const optimized = await optimizeProse(selection.text, mode)
    if (!optimized) return
    const updated = manuscriptText.substring(0, selection.start) + optimized + manuscriptText.substring(selection.end)
    setManuscriptText(updated)
    setSelection(null)
  }, [selection, optimizeProse, manuscriptText, setManuscriptText])

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3 p-5">
      <div className="flex items-center gap-3 shrink-0">
        <p className="text-sm font-semibold text-white flex-1">Manuscript Editor</p>
        <ProseToolbar
          selection={selection}
          isOptimizing={isOptimizingProse}
          onApply={(mode) => void applyProse(mode)}
          onDismiss={() => setSelection(null)}
        />
        {isOptimizingProse && !selection && (
          <span className="text-xs text-violet-400 animate-pulse">Rewriting…</span>
        )}
      </div>

      {!selection && !isOptimizingProse && (
        <p className="text-[11px] text-slate-600 shrink-0">
          Select text in the editor to activate the Academic · Humanise · Concise rewriter.
        </p>
      )}

      <textarea
        ref={textareaRef}
        value={manuscriptText}
        onChange={(e) => setManuscriptText(e.target.value)}
        onMouseUp={detectSelection}
        onKeyUp={detectSelection}
        placeholder="Your manuscript will appear here. Generate an abstract from the Abstract tab or type directly…"
        disabled={isOptimizingProse}
        className="flex-1 w-full resize-none rounded-xl p-4 font-serif text-[13px] leading-relaxed outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-60 scrollbar-none"
        style={{ background: '#f8fafc', border: '0.5px solid var(--border-hairline)', color: 'var(--text-primary)' }}
        style={{ minHeight: 0 }}
      />

      <div className="flex justify-end shrink-0">
        <span className="text-[11px] text-slate-600">
          {manuscriptText.trim() ? manuscriptText.trim().split(/\s+/).length : 0} words
        </span>
      </div>
    </div>
  )
}

// ── Compliance panel ──────────────────────────────────────────────────────────

function CompliancePanel() {
  const manuscriptText  = useWorkbenchStore((s) => s.manuscriptText)
  const aiScore         = useWorkbenchStore((s) => s.aiScore)
  const flaggedBlocks   = useWorkbenchStore((s) => s.flaggedBlocks)
  const citations       = useWorkbenchStore((s) => s.citations)
  const isScanning      = useWorkbenchStore((s) => s.isScanning)
  const { runComplianceCheck } = useWorkbench()

  const scoreColor =
    aiScore === null ? 'text-slate-500'
    : aiScore > 60 ? 'text-red-400'
    : aiScore > 30 ? 'text-amber-400'
    : 'text-emerald-400'

  const scoreRingColor =
    aiScore === null ? 'stroke-slate-700'
    : aiScore > 60 ? 'stroke-red-500'
    : aiScore > 30 ? 'stroke-amber-500'
    : 'stroke-emerald-500'

  const circumference = 2 * Math.PI * 22
  const dashOffset = aiScore !== null ? circumference * (1 - aiScore / 100) : circumference

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 p-5 overflow-y-auto scrollbar-none">
      <div className="flex items-start gap-3 shrink-0">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Submission Audit</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Scans your manuscript for AI-pattern risk and surfaces verified literature to anchor your claims.
          </p>
        </div>
        <button
          onClick={() => void runComplianceCheck(manuscriptText)}
          disabled={isScanning || !manuscriptText.trim()}
          className="shrink-0 flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <ShieldCheck size={13} />
          {isScanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {aiScore !== null && (
        <div className="shrink-0 flex items-center gap-4 bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <svg width="60" height="60" className="-rotate-90">
            <circle cx="30" cy="30" r="22" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle
              cx="30" cy="30" r="22" fill="none"
              className={scoreRingColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div>
            <p className={cn('text-2xl font-bold', scoreColor)}>{aiScore}%</p>
            <p className="text-xs text-slate-500 mt-0.5">AI Pattern Risk</p>
            <p className="text-[11px] text-slate-600 mt-1">
              {aiScore > 60 ? 'High — use Humanise to smooth flagged sections.'
               : aiScore > 30 ? 'Moderate — review flagged blocks below.'
               : 'Low risk — manuscript reads authentically.'}
            </p>
          </div>
        </div>
      )}

      {flaggedBlocks.length > 0 && (
        <div className="shrink-0 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-400" /> Flagged Sections ({flaggedBlocks.length})
          </p>
          {flaggedBlocks.map((block: FlaggedBlock, i) => {
            const isHigh = block.weight >= 0.7
            const severityLabel = isHigh ? 'HIGH' : 'MEDIUM'
            return (
              <div
                key={i}
                className={cn(
                  'rounded-xl border p-3 text-xs space-y-1',
                  isHigh ? 'border-red-500/25 bg-red-500/5' : 'border-amber-500/25 bg-amber-500/5',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', isHigh ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
                    {severityLabel}
                  </span>
                  {isHigh
                    ? <XCircle size={12} className="text-red-400 shrink-0" />
                    : <AlertTriangle size={12} className="text-amber-400 shrink-0" />}
                </div>
                <blockquote className="text-slate-400 italic border-l-2 border-slate-700 pl-2 line-clamp-2">
                  "{block.matchedText}"
                </blockquote>
                <p className="text-slate-500">{block.patternName}</p>
              </div>
            )
          })}
        </div>
      )}

      {citations.length > 0 && (
        <div className="shrink-0 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={12} className="text-violet-400" /> Suggested Citations ({citations.length})
          </p>
          {citations.map((c: CitationAsset, i) => (
            <div key={i} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 text-xs space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-slate-200 font-medium leading-tight line-clamp-2">{c.title}</p>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-violet-400 hover:text-violet-300 transition-colors">
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <span>{c.paperId}</span>
                {c.citationCount !== null && <span>· {c.citationCount.toLocaleString()} citations</span>}
              </div>
              {c.abstract && (
                <p className="text-slate-600 italic leading-relaxed line-clamp-2">{c.abstract}</p>
              )}
              <button
                onClick={() => {
                  const tag = ` (${c.paperId})`
                  useWorkbenchStore.getState().setManuscriptText(
                    useWorkbenchStore.getState().manuscriptText + tag,
                  )
                }}
                className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                <CheckCircle2 size={11} /> Insert citation
              </button>
            </div>
          ))}
        </div>
      )}

      {aiScore === null && !isScanning && (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl text-center p-8 gap-2" style={{ border: '1.5px dashed var(--border-strong)' }}>
          <ShieldCheck size={32} style={{ color: 'var(--text-disabled)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No scan results yet</p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
            {manuscriptText.trim()
              ? 'Click Scan above to check your manuscript for AI patterns.'
              : 'Go to Abstract → Generate → Insert into Editor, then return here to scan.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Data Health panel ─────────────────────────────────────────────────────────

const NUMERIC_DTYPES = new Set(['int64', 'float64', 'int32', 'float32'])

function PassBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
      <CheckCircle2 size={9} /> PASS
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
      <XCircle size={9} /> FAIL
    </span>
  )
}

const TOOLTIPS: Record<string, string> = {
  multicollinearity: 'VIF > 5 indicates two predictors share variance, making coefficients unreliable. Remove one collinear variable or use ridge regression.',
  homoscedasticity:  'Breusch-Pagan p < 0.05 means residual variance is not constant. Consider log-transforming the outcome or using robust standard errors.',
  normality:         'Shapiro-Wilk p < 0.05 means residuals are not normally distributed. For large samples (n > 100) regression is generally robust to this violation.',
}

function TooltipIcon({ tip }: { tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-600 hover:text-slate-400 transition-colors"
      >
        <Info size={11} />
      </button>
      {show && (
        <div className="absolute z-50 left-4 top-0 w-56 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-[11px] text-slate-300 leading-relaxed shadow-2xl">
          {tip}
        </div>
      )}
    </div>
  )
}

function AssumptionCard({
  label,
  tipKey,
  passed,
  children,
}: {
  label: string
  tipKey: string
  passed?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3 flex flex-col gap-2',
      passed === true  ? 'border-emerald-500/25 bg-emerald-500/5'
      : passed === false ? 'border-red-500/25 bg-red-500/5'
      : 'border-slate-700/60 bg-slate-800/40',
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-300">{label}</span>
        <div className="flex items-center gap-1.5">
          {passed !== undefined && <PassBadge passed={passed} />}
          <TooltipIcon tip={TOOLTIPS[tipKey] ?? ''} />
        </div>
      </div>
      {children}
    </div>
  )
}

function DataHealthPanel() {
  const schema                 = useAnalystStore((s) => s.schema)
  const report                 = useWorkbenchStore((s) => s.assumptionReport)
  const isChecking             = useWorkbenchStore((s) => s.isCheckingAssumptions)
  const { checkAssumptions }   = useWorkbench()

  const numericCols = schema?.columns.filter((c) => NUMERIC_DTYPES.has(c.dtype)) ?? []

  const [indepVars, setIndepVars] = useState<string[]>([])
  const [depVar, setDepVar]       = useState<string>('')

  // Reset selections when schema changes
  useEffect(() => { setIndepVars([]); setDepVar('') }, [schema?.datasetId])

  const toggleIndep = (col: string) =>
    setIndepVars((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    )

  const canRun = indepVars.length > 0 && depVar && !indepVars.includes(depVar) && !isChecking

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 p-5 overflow-y-auto scrollbar-none">

      {/* Header */}
      <div className="shrink-0">
        <p className="text-sm font-semibold text-white">Regression Assumption Checker</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          Pre-flight diagnostics — VIF, Breusch-Pagan, Shapiro-Wilk — run in the E2B sandbox
          using sklearn + scipy. No LLM token cost.
        </p>
      </div>

      {/* Column picker */}
      {numericCols.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl text-center p-8 gap-2" style={{ border: '1.5px dashed var(--border-strong)' }}>
          <Activity size={32} style={{ color: 'var(--text-disabled)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No numeric columns found</p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
            Upload a dataset containing at least two numeric columns to run assumption checks.
          </p>
        </div>
      ) : (
        <>
          <div className="shrink-0 grid grid-cols-2 gap-3">
            {/* Independent variables */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Independent (X)
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-none rounded-lg p-2" style={{ border: '0.5px solid var(--border-hairline)', background: '#f8fafc' }}>
                {numericCols.map((col) => {
                  const isDisabled = col.name === depVar
                  const isChecked  = indepVars.includes(col.name)
                  return (
                    <label
                      key={col.name}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer select-none',
                        isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800/60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => !isDisabled && toggleIndep(col.name)}
                        className="accent-violet-500 w-3 h-3 rounded"
                      />
                      <span className="text-[12px] font-mono text-slate-300 truncate">{col.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Dependent variable */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Dependent (Y)
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-none rounded-lg p-2" style={{ border: '0.5px solid var(--border-hairline)', background: '#f8fafc' }}>
                {numericCols.map((col) => {
                  const isDisabled = indepVars.includes(col.name)
                  return (
                    <label
                      key={col.name}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer select-none',
                        isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800/60',
                      )}
                    >
                      <input
                        type="radio"
                        name="dep-var"
                        value={col.name}
                        checked={depVar === col.name}
                        disabled={isDisabled}
                        onChange={() => !isDisabled && setDepVar(col.name)}
                        className="accent-violet-500 w-3 h-3"
                      />
                      <span className="text-[12px] font-mono text-slate-300 truncate">{col.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex justify-end">
            <button
              onClick={() => void checkAssumptions(indepVars, depVar)}
              disabled={!canRun}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
            >
              {isChecking ? (
                <>
                  <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Activity size={13} /> Run Check
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {report && !isChecking && (
            <div className="shrink-0 space-y-3">
              {/* Sample info */}
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>
                  {report.variables.dependent} ~ {report.variables.independent.join(' + ')}
                </span>
                {report.sampleSize > 0 && (
                  <span className="font-mono">{report.sampleSize.toLocaleString()} rows</span>
                )}
              </div>

              {/* Error state */}
              {report.error && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-400">
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    <AlertTriangle size={12} /> Analysis Error
                  </div>
                  <p className="text-red-400/80 font-mono break-all">{report.error}</p>
                </div>
              )}

              {/* Multicollinearity */}
              {report.multicollinearity && (
                <AssumptionCard
                  label="Multicollinearity"
                  tipKey="multicollinearity"
                  passed={report.multicollinearity.passed}
                >
                  <div className="space-y-1">
                    {report.multicollinearity.vifItems.map((item) => (
                      <div key={item.variable} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-400 truncate max-w-[60%]">
                          {item.variable}
                        </span>
                        <span className={cn(
                          'font-mono font-semibold',
                          item.flagged ? 'text-red-400' : 'text-emerald-400',
                        )}>
                          VIF {item.vif.toFixed(2)}
                          {item.flagged
                            ? <XCircle size={9} className="inline ml-1" />
                            : <CheckCircle2 size={9} className="inline ml-1" />}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-600">
                    Max VIF {report.multicollinearity.maxVif.toFixed(2)} · threshold {report.multicollinearity.threshold}
                  </p>
                </AssumptionCard>
              )}

              {/* Homoscedasticity */}
              {report.homoscedasticity && (
                <AssumptionCard
                  label="Homoscedasticity"
                  tipKey="homoscedasticity"
                  passed={report.homoscedasticity.passed}
                >
                  <div className="text-[11px] space-y-0.5">
                    <p className="text-slate-500">{report.homoscedasticity.testName} test</p>
                    <p className="font-mono text-slate-300">
                      LM = {report.homoscedasticity.statistic.toFixed(4)}
                    </p>
                    <p className={cn('font-mono font-semibold', report.homoscedasticity.passed ? 'text-emerald-400' : 'text-red-400')}>
                      p = {report.homoscedasticity.pValue.toFixed(4)}
                      {report.homoscedasticity.passed
                        ? ' ≥ 0.05 ✓'
                        : ' < 0.05 — heteroscedastic'}
                    </p>
                  </div>
                </AssumptionCard>
              )}

              {/* Normality */}
              {report.normality && (
                <AssumptionCard
                  label="Normality of Residuals"
                  tipKey="normality"
                  passed={report.normality.passed}
                >
                  <div className="text-[11px] space-y-0.5">
                    <p className="text-slate-500">{report.normality.testName} test</p>
                    <p className="font-mono text-slate-300">
                      W = {report.normality.statistic.toFixed(4)}
                    </p>
                    <p className={cn('font-mono font-semibold', report.normality.passed ? 'text-emerald-400' : 'text-red-400')}>
                      p = {report.normality.pValue.toFixed(4)}
                      {report.normality.passed
                        ? ' ≥ 0.05 ✓'
                        : ' < 0.05 — non-normal'}
                    </p>
                    {report.normality.note && (
                      <p className="text-slate-600 italic">{report.normality.note}</p>
                    )}
                  </div>
                </AssumptionCard>
              )}

              {/* Summary */}
              {!report.error && report.multicollinearity && (
                (() => {
                  const violations = [
                    !report.multicollinearity.passed && 'multicollinearity',
                    !report.homoscedasticity?.passed  && 'homoscedasticity',
                    !report.normality?.passed         && 'normality',
                  ].filter(Boolean) as string[]
                  return violations.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                      <CheckCircle2 size={13} />
                      All assumptions satisfied — safe to proceed with regression.
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>
                        {violations.length} violation{violations.length > 1 ? 's' : ''}: {violations.join(', ')}.
                        Review the cards above for remediation guidance.
                      </span>
                    </div>
                  )
                })()
              )}
            </div>
          )}

          {/* Empty state */}
          {!report && !isChecking && (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl text-center p-8 gap-2" style={{ border: '1.5px dashed var(--border-strong)' }}>
              <Activity size={32} style={{ color: 'var(--text-disabled)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No results yet</p>
              <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                Select your independent and dependent variables above then click Run Check.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Document canvas (right panel) ─────────────────────────────────────────────

type CanvasTab = 'abstract' | 'editor' | 'compliance' | 'health'

const CANVAS_TABS: { id: CanvasTab; label: string; icon: React.ElementType }[] = [
  { id: 'abstract',   label: 'Abstract',  icon: BookOpen },
  { id: 'editor',     label: 'Editor',    icon: ScrollText },
  { id: 'compliance', label: 'Audit',     icon: ShieldCheck },
  { id: 'health',     label: 'Health',    icon: Activity },
]

function DocumentCanvas() {
  const [tab, setTab] = useState<CanvasTab>('abstract')

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '0.5px solid var(--border-hairline)' }}>
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 shrink-0" style={{ borderBottom: '0.5px solid var(--border-hairline)', background: '#ffffff' }}>
        {CANVAS_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px"
            style={tab === id
              ? { color: 'var(--color-purple)', borderColor: 'var(--color-purple)' }
              : { color: 'var(--text-muted)', borderColor: 'transparent' }}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="flex-1 min-h-0 flex flex-col"
        >
          {tab === 'abstract'   && <AbstractPanel />}
          {tab === 'editor'     && <ManuscriptPanel />}
          {tab === 'compliance' && <CompliancePanel />}
          {tab === 'health'     && <DataHealthPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkbenchPage() {
  const schema    = useAnalystStore((s) => s.schema)
  const messages  = useAnalystStore((s) => s.messages)
  const { pinChart } = useWorkbench()

  const latestPythonCode = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.pythonCode)
    ?.pythonCode ?? ''

  const lastUserPrompt = [...messages]
    .reverse()
    .find((m) => m.role === 'user')
    ?.content ?? ''

  return (
    <div className="min-h-0 px-4 py-6 w-full h-full flex flex-col gap-4" style={{ background: 'var(--surface-page)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'var(--color-purple-tint)',
          border: '0.5px solid #c4b5fd',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Layers size={16} style={{ color: 'var(--color-purple)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>Data Workbench</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Analyse data · Pin charts · Draft academic manuscripts</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!schema ? (
          /* No dataset — upload + feature overview */
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 grid lg:grid-cols-2 gap-5"
          >
            <div className="flex flex-col gap-3 rounded-2xl p-5 justify-center" style={{ background: '#ffffff', border: '0.5px solid var(--border-hairline)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Step 1 · Upload Dataset</p>
              <UploadZone />
            </div>
            <div className="hidden lg:flex flex-col justify-center gap-5 rounded-2xl p-6" style={{ background: '#ffffff', border: '0.5px solid var(--border-hairline)' }}>
              {[
                { icon: BarChart2,   color: 'var(--color-purple)', title: 'NL-Powered Analysis',   desc: 'Ask questions in plain English — charts and tables generated automatically via E2B sandbox.' },
                { icon: Code2,       color: '#0284c7',              title: 'Socratic Code Toggle',   desc: 'Student mode shows step-by-step guidance. Developer mode exposes the live Python script in Monaco.' },
                { icon: Activity,    color: 'var(--color-green)',   title: 'Assumption Checker',     desc: 'Pre-flight regression diagnostics: VIF, Breusch-Pagan, Shapiro-Wilk — computed in the sandbox, no token cost.' },
                { icon: Pin,         color: '#6366f1',              title: 'Chart Asset Library',    desc: 'Hover any chart and pin it. Assets persist across sessions for your report canvas.' },
                { icon: ShieldCheck, color: 'var(--color-amber)',   title: 'Submission Audit',       desc: 'Scan for AI patterns and surface verified literature to support your findings.' },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5"><Icon size={16} style={{ color }} /></div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Dataset loaded — split canvas */
          <motion.div
            key="canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4"
          >
            <LeftPanel
              onPin={(result, _) =>
                pinChart(result as import('../../types/analyst').ChartResult, lastUserPrompt)
              }
              latestCode={latestPythonCode}
            />

            <div className="flex flex-col min-h-0" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
              <DocumentCanvas />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
