import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Check, ExternalLink, Loader2, Minus, Undo2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { deepResearchApi, type DeepResearchReport, type FollowUpQuote, type DeepResearchSession, type EvidenceQuestion, type EvidenceSource, type VerifiedEvidencePackage } from '../../api/deepResearch'
import { DeepResearchReportView } from './DeepResearchReportView'
import { CaveatLine } from './CaveatLine'
import { ClampedTitle, DisagreesBadge, QuestionProgress, SourcesSummary, StrengthMeter } from './deepResearchParts'
import { dedupeQuotes } from '../../lib/deepResearchReport'
import { authorLine, strengthLabel } from '../../lib/deepResearch'
import {
  answeredFromRatings, bySourceYearDesc, completionSummary, countSources, coverageChip, evidenceAgainst, joinMeta, mergeSourceRows, needsFollowUp,
  prefillFrom, previewQuote, questionAnchor, questionRows, questionTag, rateQuestion, regionLabel, relationshipTag, segmentsFromRatings, shortQuestion, sourceStrength, statusBanner, stripSeparators,
  verificationChecks, type Chip, type Prefill, type QuestionRow, type SourceGroup,
} from '../../lib/deepResearchView'

// ── small building blocks ───────────────────────────────────────────────────────────────────

const CHIP_TONES: Record<Chip['tone'] | 'success', string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-300',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

/** A chip whose explanation opens on hover AND keyboard focus, and is read out as its description. */
function HintChip({ label, hint, tone = 'neutral' }: { label: string; hint: string; tone?: Chip['tone'] | 'success' }) {
  const [open, setOpen] = useState(false)
  const id = useMemo(() => `hint-${Math.random().toString(36).slice(2, 9)}`, [])
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cn('inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] font-medium max-w-[16rem] truncate outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40', CHIP_TONES[tone])}
      >
        {label}
      </span>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-md bg-slate-800 px-2.5 py-1.5 text-[12px] font-normal text-white shadow-lg whitespace-normal">
          {hint}
        </span>
      )}
    </span>
  )
}

const CHECK_ICON = {
  ok: <Check size={14} className="text-emerald-600" aria-hidden="true" />,
  warn: <AlertTriangle size={14} className="text-amber-600" aria-hidden="true" />,
  fail: <X size={14} className="text-red-600" aria-hidden="true" />,
  none: <Minus size={14} className="text-slate-500" aria-hidden="true" />,
} as const
const CHECK_WORD = { ok: 'Passed', warn: 'Could not check', fail: 'Failed', none: 'Not available' } as const

const prettyType = (t: string) => t.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()

type Tab = 'report' | 'questions' | 'against' | 'left' | 'log'

// ── the source list rows ────────────────────────────────────────────────────────────────────

export function SourceRow({ source, questionId, selected, onSelect }: { source: SourceGroup; questionId?: string; selected: boolean; onSelect: () => void }) {
  const link = source.links.find(l => (questionId ? l.questionId === questionId : true) && l.decision === 'Accepted')
  const disagrees = link?.polarity === 'Contradicts' || link?.polarity === 'Null'
  return (
    <li data-source-id={source.id}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn('w-full text-left rounded-xl border p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
          selected ? 'border-purple-accent bg-purple-tint' : 'border-slate-200 bg-white hover:border-slate-300')}
      >
        <span className="block text-[13px] font-semibold leading-snug text-slate-900">{source.title}</span>
        <span className="block text-[12px] text-slate-600 mt-0.5">{source.year ?? 'n.d.'}{source.journal ? ` · ${source.journal}` : ''}</span>
        {/* One indicator here. The DOI check, what was read and the quote are in the panel once the source is opened. */}
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <StrengthMeter strength={sourceStrength(source, questionId)} />
          {disagrees && <DisagreesBadge kind={link?.polarity === 'Null' ? 'Null' : 'Contradicts'} />}
        </span>
      </button>
    </li>
  )
}

// ── the selected-source panel ───────────────────────────────────────────────────────────────

interface DetailProps {
  source: SourceGroup
  questions: EvidenceQuestion[]
  busy: boolean
  added: boolean
  onAdd: () => void
  onUse: () => void
  onExclude: () => void
  onRestore: () => void
}

export function SourceDetail({ source, questions, busy, added, onAdd, onUse, onExclude, onRestore }: DetailProps) {
  const used = source.bucket === 'used'
  const links = source.links.filter(l => used ? l.decision === 'Accepted' : true)
  const passages = dedupeQuotes(links.map(l => l.quote))
  const checks = verificationChecks(source.verification, passages.length > 0, source.coverage)
  const read = coverageChip(source.coverage, source.studyDesign)
  const region = regionLabel(source.geography)

  const copyDoi = async () => {
    try { await navigator.clipboard.writeText(source.doi ?? ''); toast.success('DOI copied') }
    catch { toast.error('Could not copy the DOI') }
  }

  return (
    <div className="space-y-5">
      {/* Stays in view while the panel scrolls, so it is always clear which source the checks belong to. */}
      <div className="sticky -top-5 z-10 -mx-5 -mt-2 border-b border-slate-100 bg-white px-5 pb-3 pt-2">
        <h3 className="font-serif text-[19px] leading-snug font-semibold text-slate-900">{source.title}</h3>
        <p className="text-[12px] text-slate-600 mt-1.5">{authorLine(source)}</p>
        <p className="text-[12px] text-slate-600">{source.year ?? 'n.d.'}{source.journal ? ` · ${source.journal}` : ''}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <HintChip label={read.label} hint={read.hint} tone={read.tone} />
          {region && <HintChip label={region} hint="Where the study was carried out, as far as the source says." />}
          {source.decidedBy === 'You' && <HintChip label="Your decision" hint="You chose to use or leave out this source. Your decision always stands." tone="success" />}
        </div>
      </div>

      {!used && (
        <p className="rounded-xl bg-slate-50 p-3 text-[12px] text-slate-600">
          {source.bucket === 'unassessed' ? 'Not reviewed before the research stopped.' : `Left out${source.exclusionReason ? `: ${source.exclusionReason}` : '.'}`}
        </p>
      )}

      {used && (
        <div>
          <p className="text-[12px] font-semibold text-slate-800 mb-1.5">Why it is here</p>
          <ul className="space-y-1">
            {links.map((l, i) => {
              const rel = relationshipTag(l, questions)
              return (
                <li key={i} className="text-[12px] text-slate-600" title={rel.hint || undefined}>
                  {joinMeta(rel.label, l.strength ? strengthLabel(l.strength) : '')}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div>
        <p className="text-[12px] font-semibold text-slate-800 mb-1">Verification</p>
        <ul>
          {checks.map((c, i) => (
            <li key={i} className="flex gap-2.5 border-t border-slate-100 py-2 first:border-t-0">
              <span className="mt-0.5 shrink-0">{CHECK_ICON[c.state]}<span className="sr-only">{CHECK_WORD[c.state]}: </span></span>
              <div>
                <p className="text-[12px] font-medium text-slate-800">{c.label}</p>
                <p className="text-[12px] text-slate-600">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {passages.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-slate-800 mb-1.5">Supporting quote{passages.length > 1 ? 's' : ''}</p>
          {passages.map((p, i) => (
            <blockquote key={i} className="rounded-xl bg-purple-tint p-3.5 font-serif text-[14px] leading-relaxed text-slate-800 mb-2">“{p}”</blockquote>
          ))}
        </div>
      )}

      {used && links.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-slate-800 mb-1.5">Used for</p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(links.map(l => l.questionId))].map(id => {
              const n = questions.findIndex(q => q.id === id) + 1
              const q = questions.find(x => x.id === id)
              return <span key={id} title={q?.question} className="px-2.5 py-0.5 rounded-full bg-purple-tint text-purple-deep text-[12px] font-medium">Question {n || '?'}</span>
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {used && source.verification === 'Verified' && (added ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><Check size={14} aria-hidden="true" /> Added to references</span>
            {passages.length > 0 && (
              <button type="button" onClick={onUse} className="min-h-10 rounded-xl border border-purple-200 text-[13px] font-medium text-slate-800 hover:bg-purple-tint">Use as evidence in my proposal</button>
            )}
          </>
        ) : (
          <button type="button" disabled={busy} onClick={onAdd}
            className="min-h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-accent text-white text-[13px] font-semibold hover:bg-purple-deep disabled:opacity-60">
            {busy && <Loader2 size={13} className="animate-spin" />} Add to references
          </button>
        ))}
        {used && source.verification !== 'Verified' && (
          <p className="text-[12px] text-slate-600">This source's record could not be matched, so it can be read here but not added to your references.</p>
        )}
        {!used && (
          <button type="button" disabled={busy} onClick={onRestore} className="inline-flex items-center justify-center gap-1.5 min-h-10 rounded-xl border border-purple-accent text-purple-deep bg-purple-tint text-[13px] font-semibold disabled:opacity-60">
            <Undo2 size={13} /> Use this source
          </button>
        )}
        {used && (
          <button type="button" disabled={busy} onClick={onExclude} className="min-h-10 text-[13px] font-medium text-orange-800 hover:underline disabled:opacity-60" title="Removes it from this research's evidence and counts. You can undo it.">
            This is not relevant
          </button>
        )}
        {source.doi && (
          <div className="flex items-center gap-3">
            <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-slate-600 hover:text-purple-deep hover:underline">
              DOI {source.doi} <ExternalLink size={11} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </a>
            <button type="button" onClick={() => void copyDoi()} className="text-[12px] text-slate-600 hover:text-purple-deep hover:underline">Copy DOI</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── the search log ──────────────────────────────────────────────────────────────────────────

type LogState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; pkg: VerifiedEvidencePackage }

function SearchLog({ sessionId, questions }: { sessionId: string; questions: EvidenceQuestion[] }) {
  const [state, setState] = useState<LogState>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    deepResearchApi.evidencePackage(sessionId)
      .then(pkg => { if (alive) setState({ status: 'ok', pkg }) })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [sessionId])

  if (state.status === 'loading') return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-500" /></div>
  if (state.status === 'error') return <p className="text-[13px] text-slate-600">The search log could not be loaded. Try again in a moment.</p>

  const { searchCoverage: searches, usage } = state.pkg
  if (searches.length === 0) return <p className="text-[13px] text-slate-600">No searches were recorded.</p>
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[12px] text-slate-600 mb-2">
        {usage.searches} search{usage.searches === 1 ? '' : 'es'} · {usage.llmCalls} AI call{usage.llmCalls === 1 ? '' : 's'} · {Math.round(usage.elapsedSeconds)} seconds
      </p>
      <ul>
        {searches.map((s, i) => {
          const q = questions.find(x => x.id === s.questionId)
          return (
            <li key={i} className="border-t border-slate-100 py-3 first:border-t-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-purple-deep">
                {s.contradictionSearch ? 'Search for disagreement' : 'Search'}{q ? ` · ${shortQuestion(q.question, 60)}` : ''}
              </p>
              <p className="mt-1 font-mono text-[12px] text-slate-700 break-words">{s.query}</p>
              <p className="mt-1 text-[12px] text-slate-600">
                {s.newCandidates} new source{s.newCandidates === 1 ? '' : 's'}, {s.duplicates} already seen ·{' '}
                {s.providers.map(p => `${p.provider}: ${p.outcome === 'Results' ? `${p.results} results` : p.outcome}`).join(', ')}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── the results view ────────────────────────────────────────────────────────────────────────

export interface DeepResearchResultsProps {
  session: DeepResearchSession
  rows: EvidenceSource[]
  busyId: string | null
  addedIds: Set<string>
  onDecide: (sourceId: string, decision: 'accept' | 'reject' | 'clear') => Promise<void>
  onAdd: (sourceId: string) => Promise<void>
  onUse: (source: SourceGroup) => void
  onExport: () => void
  exporting: boolean
  onFollowUp: (prefill: Prefill) => void
  onNew: () => void
  /** The cited report. Null while it loads or if it could not be loaded; the evidence tabs work without it. */
  report?: DeepResearchReport | null
  reportFailed?: boolean
  onExportReport?: () => void
  exportingReport?: boolean
  /** What continuing this session would cost against starting again. Present only when the server says it can be continued. */
  followUpQuote?: FollowUpQuote | null
  onContinue?: () => void
  continuing?: boolean
}

export function DeepResearchResults({ session, rows, busyId, addedIds, onDecide, onAdd, onUse, onExport, exporting, onFollowUp, onNew, report = null, reportFailed = false, onExportReport, exportingReport = false, followUpQuote = null, onContinue, continuing = false }: DeepResearchResultsProps) {
  const result = session.result
  const questions = result?.questions ?? []
  const groups = useMemo(() => mergeSourceRows(rows), [rows])
  const counts = useMemo(() => countSources(groups), [groups])
  const qRows = useMemo(() => questionRows(questions, groups), [questions, groups])
  const against = useMemo(() => evidenceAgainst(groups), [groups])
  const leftOut = useMemo(() => groups.filter(g => g.bucket !== 'used').sort(bySourceYearDesc), [groups])
  // "Answered" is decided by how well each question is supported, so the count, the bar and the labels always agree.
  const ratings = useMemo(() => qRows.map(rateQuestion), [qRows])
  const segments = segmentsFromRatings(ratings, questions)
  const answered = answeredFromRatings(ratings)
  const banner = statusBanner(session, answered, questions.length)
  const summary = completionSummary(session, answered, questions.length)
  const statusChip = summary.chip
  const followUp = needsFollowUp(session.status)
  const canContinue = followUp && !!followUpQuote?.canContinue && !!onContinue
  const failed = session.status === 'Failed'

  // The report is the first thing a student sees once it has loaded; until then (or without one) the evidence tabs lead.
  // Report first and selected by default whenever the report is available; the evidence tabs lead only when it is not.
  const reportEnabled = !!onExportReport && !reportFailed
  const [chosenTab, setTab] = useState<Tab | null>(null)
  const tab: Tab = chosenTab ?? (reportEnabled ? 'report' : 'questions')
  const [selectedId, setSelectedRaw] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  // Remember what opened the panel so closing it puts keyboard focus back there; move focus into the panel when it opens.
  const setSelectedId = (id: string | null) => {
    if (id) trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedRaw(id)
  }
  const closePanel = () => { setSelectedRaw(null); requestAnimationFrame(() => trigger.current?.focus()) }
  useEffect(() => {
    if (!selectedId) return
    panelRef.current?.focus({ preventScroll: true })
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') closePanel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedId])
  const [announce, setAnnounce] = useState('')
  const selected = groups.find(g => g.id === selectedId) ?? null

  const exclude = async (g: SourceGroup) => {
    await onDecide(g.id, 'reject')
    setAnnounce(`Excluded: ${g.title}`)
    toast((t) => (
      <span className="flex items-center gap-3 text-[13px]">
        Excluded from this evidence.
        <button className="font-semibold text-purple-deep hover:underline" onClick={() => { toast.dismiss(t.id); void onDecide(g.id, 'clear').then(() => setAnnounce(`Restored: ${g.title}`)) }}>Undo</button>
      </span>
    ), { duration: 8000 })
  }
  const restore = async (g: SourceGroup) => { await onDecide(g.id, 'accept'); setAnnounce(`Using again: ${g.title}`) }
  const add = async (g: SourceGroup) => { await onAdd(g.id); setAnnounce(`Added to references: ${g.title}`) }

  // Open a source from a key finding: show it in the panel and bring its row into view in the page's own scroll area.
  // `scrollIntoView` also scrolls every ancestor, including the app shell, which left a blank band under it.
  const goToSource = (id: string) => {
    setTab('questions')
    setSelectedId(id)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-source-id="${id}"]`)
      const area = el?.closest('main') ?? document.scrollingElement
      if (el && area instanceof HTMLElement) {
        const offset = el.getBoundingClientRect().top - area.getBoundingClientRect().top
        area.scrollTo({ top: area.scrollTop + offset - area.clientHeight / 3, behavior: 'smooth' })
      }
    })
  }

  // A report citation opens the panel; on a narrow screen the panel is a bottom sheet, so nothing needs scrolling.
  const openFromReport = (id: string) => setSelectedId(id)
  const quoteFor = (id: string) => previewQuote(groups.find(g => g.id === id))

  // A progress segment jumps to its question, shows it, and moves focus there.
  const jumpToQuestion = (index: number) => {
    const q = questions[index]
    if (!q) return
    setTab('questions')
    requestAnimationFrame(() => {
      const el = document.getElementById(questionAnchor(q.id))
      if (!el) return
      el.focus({ preventScroll: true })
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  // Tabs: arrows, Home and End move between them (one tab stop, as the pattern asks).
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1
    const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1
    if (next < 0) return
    e.preventDefault()
    setTab(tabs[next].id)
    requestAnimationFrame(() => document.getElementById(`tab-${tabs[next].id}`)?.focus())
  }

  const primaryCls = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold shadow shadow-purple-400/20 disabled:opacity-60'
  const secondary = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl border border-slate-300 bg-white text-slate-800 text-[13px] font-medium hover:bg-slate-50 disabled:opacity-60'
  // Exactly one filled button: researching what is left when that is possible, else the Word export, else what the page always had.
  const lead: 'continue' | 'export' | 'startNew' | 'download' = canContinue ? 'continue' : onExportReport ? 'export' : followUp ? 'startNew' : 'download'
  const cls = (k: typeof lead) => (lead === k ? primaryCls : secondary)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'report', label: 'Report' },
    { id: 'questions', label: `Questions (${questions.length})` },
    { id: 'against', label: `Evidence against (${against.length})` },
    ...(leftOut.length > 0 ? [{ id: 'left' as Tab, label: `Left out (${leftOut.length})` }] : []),
    { id: 'log', label: 'Search log' },
  ]

  const researched = qRows.filter(r => r.state !== 'not-searched')
  const planned = qRows.filter(r => r.state === 'not-searched')
  const numberOf = (r: QuestionRow) => questions.findIndex(q => q.id === r.question.id) + 1

  return (
    <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>

      <div className="min-w-0 space-y-5">
        {/* 1. The question, then one status line */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <p className="text-[12px] uppercase tracking-wider font-semibold text-slate-600">Your question</p>
            <span className={cn('px-2.5 py-0.5 rounded-full border text-[12px] font-medium', CHIP_TONES[statusChip.tone])}>{statusChip.label}</span>
          </div>
          <ClampedTitle text={session.researchQuestion} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Status">
          <h3 className="text-[18px] font-semibold text-slate-900">{summary.headline}</h3>
          {(summary.note ?? (questions.length === 0 ? banner.title : null)) && (
            <p role={banner.role} className={cn('text-[13px] mt-1', failed ? 'text-red-700' : 'text-slate-700')}>
              {summary.note ?? banner.title}
            </p>
          )}
          <QuestionProgress segments={segments} answered={answered} onSelect={jumpToQuestion} />
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {canContinue && (
              <button type="button" className={cls('continue')} onClick={onContinue} disabled={continuing}>
                {continuing && <Loader2 size={14} className="animate-spin" />} Research the remaining {followUpQuote!.unansweredQuestions} question{followUpQuote!.unansweredQuestions === 1 ? '' : 's'} · {followUpQuote!.followUpCredits} credits
              </button>
            )}
            {onExportReport && (
              <button type="button" className={cls('export')} onClick={onExportReport} disabled={exportingReport}>
                {exportingReport && <Loader2 size={14} className="animate-spin" />} Export report (Word)
              </button>
            )}
            {followUp && (
              <button type="button" className={cls('startNew')} onClick={() => onFollowUp(prefillFrom(session))}>Start new research from this</button>
            )}
            <button type="button" className={cls('download')} onClick={onExport} disabled={exporting}
              title="A JSON file with your questions, accepted and contradicting sources, gaps, search coverage and what was used.">
              {exporting && <Loader2 size={14} className="animate-spin" />} Download evidence package
            </button>
            <button type="button" className={secondary} onClick={() => onFollowUp({ ...prefillFrom(session), unanswered: [] })}>Edit question</button>
            <button type="button" className={secondary} onClick={onNew}>{followUp ? 'Blank new research' : 'New research'}</button>
          </div>
          {canContinue && (
            <p className="text-[13px] text-slate-700 mt-2" data-testid="follow-up-price">
              Keeps your {followUpQuote!.answeredQuestions} answered question{followUpQuote!.answeredQuestions === 1 ? '' : 's'} and their sources, and researches only the rest.
              It holds <strong>{followUpQuote!.followUpCredits} credits</strong> instead of the {followUpQuote!.freshCredits} a fresh run holds; unused credits are returned.
            </p>
          )}
          {followUp && <p className="text-[12px] text-slate-600 mt-2">Starting from this opens the form with your question filled in, so you can edit it first. It runs as a new session.</p>}
        </section>

        {/* 2. Bottom line and key findings, with citations; before the tabs, on every tab */}
        {report && (
          <DeepResearchReportView part="answer" report={report} onOpenSource={openFromReport} selectedId={selectedId} quoteFor={quoteFor}
            onExport={() => onExportReport?.()} exporting={exportingReport} onAsk={q => onFollowUp({ ...prefillFrom(session), question: q, unanswered: [] })} />
        )}

        {result && (
          <>
            {/* The report says all of this with citations; this block is only the fallback while there is no report. */}
            {!report && result.keyFindings.length > 0 && (
              <section>
                <h3 className="text-left text-[15px] font-semibold text-slate-900 mb-2">Key findings{followUp ? ' so far' : ''}</h3>
                <ul className="space-y-3">
                  {result.keyFindings.map((f, i) => {
                    const tag = questionTag(f.evidenceQuestionId, questions)
                    const based = f.supportingSourceIds.map(id => groups.find(x => x.id === id)).filter((g): g is SourceGroup => !!g)
                    return (
                      <li key={i} className="rounded-xl border border-slate-200 bg-white p-3.5">
                        {tag && <span title={tag.hint} className="mb-1.5 inline-block rounded bg-purple-tint px-1.5 py-px text-[12px] font-semibold text-purple-deep">{tag.label}</span>}
                        <p className="text-[13px] text-slate-800">{stripSeparators(f.statement)}</p>
                        <p className="text-[12px] text-slate-600 mt-1">{joinMeta(strengthLabel(f.strength), f.scope)}</p>
                        <div className="mt-1 space-y-1">{f.caveats.map((c, j) => <CaveatLine key={j} text={c} />)}</div>
                        {based.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[12px] font-medium text-slate-600">Based on</p>
                            <ul className="mt-0.5 space-y-0.5">
                              {based.map(g => (
                                <li key={g.id}><button type="button" className="text-left text-[13px] text-purple-deep hover:underline" onClick={() => goToSource(g.id)}>{g.title}</button></li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* 3. One line about the sources, opening into the funnel */}
            <SourcesSummary counts={counts} against={against.length} overall={strengthLabel(result.evidenceStrength)} />
          </>
        )}

        {/* Tabs */}
        <div>
          {/* Sticks just under the page header while the tab content scrolls. */}
          <div role="tablist" aria-label="Research results" className="sticky top-0 z-30 flex flex-wrap gap-1 border-b border-slate-200 bg-white">
            {tabs.map((t, ti) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={e => onTabKey(e, ti)}
                className={cn('min-h-10 px-4 -mb-px border-b-[3px] text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded-t',
                  tab === t.id ? 'border-purple-accent text-purple-deep' : 'border-transparent text-slate-700 hover:text-slate-900')}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4 space-y-4">
            {tab === 'report' && (report
              ? <DeepResearchReportView part="rest" report={report} onOpenSource={openFromReport} selectedId={selectedId} quoteFor={quoteFor}
                  onExport={() => onExportReport?.()} exporting={exportingReport} onAsk={q => onFollowUp({ ...prefillFrom(session), question: q, unanswered: [] })} />
              : reportFailed
                ? <p className="text-[13px] text-slate-600">The report could not be loaded. The evidence tabs still show everything that was found.</p>
                : <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-500" /></div>)}

            {tab === 'questions' && (
              <>
                {researched.map(r => {
                  const rating = rateQuestion(r)
                  return (
                    <section key={r.question.id} id={questionAnchor(r.question.id)} tabIndex={-1} aria-label={`Question ${numberOf(r)}`} className="scroll-mt-14 rounded-2xl border border-slate-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[12px] font-semibold tracking-wide text-purple-deep">QUESTION {numberOf(r)} · {prettyType(r.question.type)}</p>
                        <span className="shrink-0"><HintChip label={rating.label} hint={rating.reason} tone={rating.tone} /></span>
                      </div>
                      <h4 className="text-[15px] font-semibold text-slate-900 mt-1">{r.question.question}</h4>
                      <p className="text-[12px] text-slate-600 mt-0.5 tabular-nums">{r.used.length} source{r.used.length === 1 ? '' : 's'} accepted{rating.cap ? ` · ${rating.cap}` : ''}</p>
                      {r.question.reasons.length > 0 && r.state !== 'supported' && (
                        <ul className="text-[12px] text-slate-600 mt-2 list-disc pl-4">{r.question.reasons.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ul>
                      )}
                      {r.used.length === 0
                        ? <p className="text-[12px] text-slate-600 mt-3">No source has been accepted for this question.</p>
                        : (
                          <ul className="mt-3 space-y-2">
                            {r.used.map(g => (
                              <SourceRow key={g.id} source={g} questionId={r.question.id} selected={selectedId === g.id} onSelect={() => setSelectedId(g.id)} />
                            ))}
                          </ul>
                        )}
                    </section>
                  )
                })}
                {planned.length > 0 && (
                  <section className="rounded-2xl border border-dashed border-purple-200 bg-purple-tint/50 p-4">
                    <h4 className="text-[14px] font-semibold text-slate-900 mb-1">{planned.length} question{planned.length === 1 ? '' : 's'} still to research</h4>
                    <ul>
                      {planned.map(r => (
                        <li key={r.question.id} id={questionAnchor(r.question.id)} tabIndex={-1} className="scroll-mt-14 flex items-baseline justify-between gap-3 border-t border-purple-100 py-2 outline-none first:border-t-0">
                          <span className="text-[13px] text-slate-800">
                            <span className="font-semibold">Question {numberOf(r)}</span>{' '}
                            <span className="ml-1 px-2 py-0.5 rounded-full border border-purple-200 bg-white text-[12px] text-purple-deep">{r.question.type}</span>
                            <span className="block text-[12px] text-slate-600 mt-0.5">{r.question.question}</span>
                          </span>
                          <span className="text-[12px] text-slate-600 shrink-0">Planned, not yet researched</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {researched.length === 0 && planned.length === 0 && <p className="text-[13px] text-slate-600">No questions were planned for this session.</p>}
              </>
            )}

            {tab === 'against' && (against.length === 0
              ? <p className="text-[13px] text-slate-600">No accepted source disagreed with your question or found no effect.</p>
              : (
                <ul className="space-y-2">
                  {against.map(g => <SourceRow key={g.id} source={g} selected={selectedId === g.id} onSelect={() => setSelectedId(g.id)} />)}
                </ul>
              ))}

            {tab === 'left' && (
              <ul className="space-y-2">
                {leftOut.map(g => (
                  <li key={g.id}>
                    <button type="button" aria-pressed={selectedId === g.id} onClick={() => setSelectedId(g.id)}
                      className={cn('w-full text-left rounded-xl border p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                        selectedId === g.id ? 'border-purple-accent bg-purple-tint' : 'border-slate-200 bg-slate-50 hover:border-slate-300')}>
                      <span className="block text-[13px] font-medium text-slate-600">{g.title}</span>
                      <span className="block text-[12px] text-slate-600 mt-0.5">{g.year ?? 'n.d.'}{g.journal ? ` · ${g.journal}` : ''}</span>
                      <span className="block text-[12px] text-slate-600 mt-1">
                        {g.bucket === 'unassessed' ? 'Not reviewed before the research stopped.' : `Left out${g.exclusionReason ? `: ${g.exclusionReason}` : '.'}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'log' && <SearchLog sessionId={session.id} questions={questions} />}
          </div>
        </div>

        {result && result.gapCandidates.some(g => g.status === 'GapCandidate') && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <h3 className="text-[13px] font-semibold text-amber-800 mb-1">Possible gaps</h3>
            <p className="text-[12px] text-amber-700 mb-1.5">These are leads based on what this search found — not proof that nothing has been published.</p>
            <ul className="space-y-1 text-[12px] text-amber-900">
              {result.gapCandidates.flatMap((g, i) => g.reasons.map((r, j) => <li key={`${i}-${j}`}>{r}</li>))}
            </ul>
          </section>
        )}

        {result && result.limitations.length > 0 && (
          <section>
            <h3 className="text-[13px] font-semibold text-slate-800 mb-1">Things to keep in mind</h3>
            <ul className="list-disc pl-4 space-y-1 text-[12px] text-slate-600">
              {result.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </section>
        )}
      </div>

      {/* The selected source. A bottom sheet on narrow screens (and only while a source is open); a side panel from lg up. */}
      {selected && <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={closePanel} aria-hidden="true" />}
      <aside id="selected-source-panel" ref={panelRef} tabIndex={-1} aria-label="Selected source"
        className={cn('rounded-2xl border border-slate-200 bg-white p-5 outline-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto',
          selected ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[78vh] max-lg:overflow-y-auto max-lg:rounded-b-none max-lg:shadow-2xl' : 'max-lg:hidden')}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12px] uppercase tracking-wider font-semibold text-slate-600">Selected source</p>
          {selected && (
            <button type="button" onClick={closePanel} aria-label="Close the selected source" title="Close (Esc)"
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 lg:hidden">
              <X size={14} aria-hidden="true" /> Close
            </button>
          )}
        </div>
        {selected ? (
          <SourceDetail
            source={selected}
            questions={questions}
            busy={busyId === selected.id}
            added={addedIds.has(selected.id)}
            onAdd={() => void add(selected)}
            onUse={() => onUse(selected)}
            onExclude={() => void exclude(selected)}
            onRestore={() => void restore(selected)}
          />
        ) : (
          <p className="text-[13px] text-slate-700">Select a source to see its verification checks and the passage that supports it, where one was found.</p>
        )}
      </aside>
    </div>
  )
}
