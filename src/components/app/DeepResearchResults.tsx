import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Loader2, Minus, Undo2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { deepResearchApi, type DeepResearchSession, type EvidenceQuestion, type EvidenceSource, type VerifiedEvidencePackage } from '../../api/deepResearch'
import { authorLine, strengthLabel } from '../../lib/deepResearch'
import {
  answeredCount, bySourceYearDesc, citationCheckChip, countSources, coverageChip, evidenceAgainst, mergeSourceRows, needsFollowUp,
  prefillFrom, questionRows, questionSegments, regionLabel, relationshipLabel, sessionStatusChip, shortQuestion, statusBanner,
  verificationChecks, type Chip, type Prefill, type QuestionRow, type SourceGroup,
} from '../../lib/deepResearchView'

// ── small building blocks ───────────────────────────────────────────────────────────────────

const CHIP_TONES: Record<Chip['tone'] | 'success', string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
        className={cn('inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium max-w-[16rem] truncate outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40', CHIP_TONES[tone])}
      >
        {label}
      </span>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] font-normal text-white shadow-lg whitespace-normal">
          {hint}
        </span>
      )}
    </span>
  )
}

const SEGMENT_STYLES = { done: 'bg-purple-accent', partial: 'bg-purple-300', pending: 'bg-slate-200' } as const
const SEGMENT_WORDS = { done: 'answered', partial: 'started, not enough evidence yet', pending: 'not reached' } as const

const CHECK_ICON = {
  ok: <Check size={14} className="text-emerald-600" aria-hidden="true" />,
  warn: <AlertTriangle size={14} className="text-amber-600" aria-hidden="true" />,
  fail: <X size={14} className="text-red-600" aria-hidden="true" />,
  none: <Minus size={14} className="text-slate-400" aria-hidden="true" />,
} as const
const CHECK_WORD = { ok: 'Passed', warn: 'Could not check', fail: 'Failed', none: 'Not available' } as const

const prettyType = (t: string) => t.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()

type Tab = 'questions' | 'against' | 'left' | 'log'

// ── the source list rows ────────────────────────────────────────────────────────────────────

function SourceRow({ source, questionId, selected, onSelect }: { source: SourceGroup; questionId?: string; selected: boolean; onSelect: () => void }) {
  const check = citationCheckChip(source.verification)
  const read = coverageChip(source.coverage, source.studyDesign)
  const link = source.links.find(l => (questionId ? l.questionId === questionId : true) && l.decision === 'Accepted')
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
        <span className="block text-[12px] text-slate-500 mt-0.5">{source.year ?? 'n.d.'}{source.journal ? ` · ${source.journal}` : ''}</span>
        <span className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-medium', CHIP_TONES[check.tone])}>{check.label}</span>
          <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-medium', CHIP_TONES[read.tone])}>{read.label}</span>
          {link?.strength && <span className="text-[11px] text-slate-500">{strengthLabel(link.strength)}</span>}
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

function SourceDetail({ source, questions, busy, added, onAdd, onUse, onExclude, onRestore }: DetailProps) {
  const used = source.bucket === 'used'
  const links = source.links.filter(l => used ? l.decision === 'Accepted' : true)
  const passages = [...new Set(links.map(l => l.quote).filter((q): q is string => !!q))]
  const checks = verificationChecks(source.verification, passages.length > 0, source.coverage)
  const read = coverageChip(source.coverage, source.studyDesign)
  const region = regionLabel(source.geography)

  const copyDoi = async () => {
    try { await navigator.clipboard.writeText(source.doi ?? ''); toast.success('DOI copied') }
    catch { toast.error('Could not copy the DOI') }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-serif text-[19px] leading-snug font-semibold text-slate-900">{source.title}</h3>
        <p className="text-[12px] text-slate-500 mt-1.5">{authorLine(source)}</p>
        <p className="text-[12px] text-slate-500">{source.year ?? 'n.d.'}{source.journal ? ` · ${source.journal}` : ''}</p>
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
              const rel = relationshipLabel(l, questions)
              return (
                <li key={i} className="text-[12px] text-slate-600">
                  {rel.label}{l.strength ? ` · ${strengthLabel(l.strength)}` : ''}
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
                <p className="text-[11px] text-slate-500">{c.detail}</p>
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
              return <span key={id} title={q?.question} className="px-2.5 py-0.5 rounded-full bg-purple-tint text-purple-deep text-[11px] font-medium">Question {n || '?'}</span>
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
          <p className="text-[11px] text-slate-500">This source's record could not be matched, so it can be read here but not added to your references.</p>
        )}
        {!used && (
          <button type="button" disabled={busy} onClick={onRestore} className="inline-flex items-center justify-center gap-1.5 min-h-10 rounded-xl border border-purple-accent text-purple-accent bg-purple-tint text-[13px] font-semibold disabled:opacity-60">
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
            <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-purple-accent hover:underline">
              DOI {source.doi} <ExternalLink size={11} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </a>
            <button type="button" onClick={() => void copyDoi()} className="text-[12px] text-slate-500 hover:text-purple-accent hover:underline">Copy DOI</button>
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

  if (state.status === 'loading') return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
  if (state.status === 'error') return <p className="text-[13px] text-slate-600">The search log could not be loaded. Try again in a moment.</p>

  const { searchCoverage: searches, usage } = state.pkg
  if (searches.length === 0) return <p className="text-[13px] text-slate-600">No searches were recorded.</p>
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[12px] text-slate-500 mb-2">
        {usage.searches} search{usage.searches === 1 ? '' : 'es'} · {usage.llmCalls} AI call{usage.llmCalls === 1 ? '' : 's'} · {Math.round(usage.elapsedSeconds)} seconds
      </p>
      <ul>
        {searches.map((s, i) => {
          const q = questions.find(x => x.id === s.questionId)
          return (
            <li key={i} className="border-t border-slate-100 py-3 first:border-t-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-accent">
                {s.contradictionSearch ? 'Search for disagreement' : 'Search'}{q ? ` · ${shortQuestion(q.question, 60)}` : ''}
              </p>
              <p className="mt-1 font-mono text-[12px] text-slate-700 break-words">{s.query}</p>
              <p className="mt-1 text-[12px] text-slate-500">
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
}

export function DeepResearchResults({ session, rows, busyId, addedIds, onDecide, onAdd, onUse, onExport, exporting, onFollowUp, onNew }: DeepResearchResultsProps) {
  const result = session.result
  const questions = result?.questions ?? []
  const groups = useMemo(() => mergeSourceRows(rows), [rows])
  const counts = useMemo(() => countSources(groups), [groups])
  const qRows = useMemo(() => questionRows(questions, groups), [questions, groups])
  const against = useMemo(() => evidenceAgainst(groups), [groups])
  const leftOut = useMemo(() => groups.filter(g => g.bucket !== 'used').sort(bySourceYearDesc), [groups])
  const segments = questionSegments(questions)
  const answered = answeredCount(questions)
  const banner = statusBanner(session, answered, questions.length)
  const statusChip = sessionStatusChip(session.status)
  const followUp = needsFollowUp(session.status)
  const failed = session.status === 'Failed'

  const [tab, setTab] = useState<Tab>('questions')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const selected = groups.find(g => g.id === selectedId) ?? null

  const exclude = async (g: SourceGroup) => {
    await onDecide(g.id, 'reject')
    setAnnounce(`Excluded: ${g.title}`)
    toast((t) => (
      <span className="flex items-center gap-3 text-[13px]">
        Excluded from this evidence.
        <button className="font-semibold text-purple-accent hover:underline" onClick={() => { toast.dismiss(t.id); void onDecide(g.id, 'clear').then(() => setAnnounce(`Restored: ${g.title}`)) }}>Undo</button>
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

  const primary = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold shadow shadow-purple-400/20 disabled:opacity-60'
  const secondary = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] font-medium hover:bg-slate-50 disabled:opacity-60'
  const ghost = 'inline-flex items-center gap-1.5 px-2 min-h-10 rounded-lg text-purple-accent text-[13px] font-medium hover:underline'

  const tabs: { id: Tab; label: string }[] = [
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

      <div className="min-w-0 space-y-6">
        {/* The question, as typed */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Your question</p>
            <span className={cn('px-2.5 py-0.5 rounded-full border text-[11px] font-medium', CHIP_TONES[statusChip.tone])}>{statusChip.label}</span>
          </div>
          <h2 className="font-serif text-[28px] leading-tight font-semibold text-slate-900">{session.researchQuestion}</h2>
        </div>

        {/* Progress and what to do next */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-[20px] font-semibold text-slate-900">
            {questions.length > 0 ? `${answered} of ${questions.length} questions answered` : banner.title}
          </h3>
          <p role={banner.role} className={cn('text-[13px] mt-1', failed ? 'text-red-700' : 'text-slate-600')}>
            {session.completionNote ?? banner.title}
          </p>
          {questions.length > 0 && (
            <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${questions.length}, minmax(0, 1fr))` }} role="img"
              aria-label={`${answered} of ${questions.length} questions answered. ${segments.map((s, i) => `Question ${i + 1}: ${SEGMENT_WORDS[s]}`).join('; ')}.`}>
              {segments.map((s, i) => <div key={i} className={cn('h-2 rounded', SEGMENT_STYLES[s])} />)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {followUp
              ? <button type="button" className={primary} onClick={() => onFollowUp(prefillFrom(session))}>Start new research from this</button>
              : <button type="button" className={primary} onClick={onExport} disabled={exporting}>{exporting && <Loader2 size={14} className="animate-spin" />} Download evidence package</button>}
            {followUp && (
              <button type="button" className={secondary} onClick={onExport} disabled={exporting}
                title="A JSON file with your questions, accepted and contradicting sources, gaps, search coverage and what was used.">
                {exporting && <Loader2 size={14} className="animate-spin" />} Download evidence package
              </button>
            )}
            <button type="button" className={ghost} onClick={() => onFollowUp({ ...prefillFrom(session), unanswered: [] })}>Edit question</button>
            <button type="button" className={ghost} onClick={onNew}>{followUp ? 'Blank new research' : 'New research'}</button>
          </div>
          {followUp && <p className="text-[11px] text-slate-500 mt-2">Starting from this opens the form with your question filled in, so you can edit it first. It runs as a new session.</p>}
        </section>

        {result && (
          <>
            {/* Where the sources went, from the same de-duplicated list as the lists below */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Where the sources went">
              <h3 className="text-[15px] font-semibold text-slate-900 mb-3">Where the {counts.found} sources went</h3>
              <ul className="space-y-2.5">
                {[
                  { label: 'Found', n: counts.found, bar: 'bg-purple-200' },
                  { label: 'Accepted as evidence', n: counts.used, bar: 'bg-purple-accent' },
                  { label: 'Disagree with you', n: against.length, bar: 'bg-orange-700' },
                ].map(b => (
                  <li key={b.label} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-[12px] text-slate-600">
                    <span>{b.label}</span>
                    <span className="h-2.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                      <span className={cn('block h-full rounded-full', b.bar)} style={{ width: `${counts.found > 0 ? Math.max(b.n > 0 ? 3 : 0, Math.round((b.n / counts.found) * 100)) : 0}%` }} />
                    </span>
                    <span className="text-right font-semibold text-slate-900 tabular-nums">{b.n}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-slate-500 mt-3">
                Overall: {strengthLabel(result.evidenceStrength)}. Open any source to see its checks and the passage that supports it, where one was found.
              </p>
            </section>

            {result.keyFindings.length > 0 && (
              <section>
                <h3 className="text-[15px] font-semibold text-slate-900 mb-2">Key findings{followUp ? ' so far' : ''}</h3>
                <ul className="space-y-3">
                  {result.keyFindings.map((f, i) => (
                    <li key={i} className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <p className="text-[13px] text-slate-800">{f.statement}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{strengthLabel(f.strength)} · {f.scope}</p>
                      {f.caveats.map((c, j) => <p key={j} className="text-[11px] text-amber-700 mt-1">{c}</p>)}
                      {f.supportingSourceIds.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-1.5">
                          Based on:{' '}
                          {f.supportingSourceIds.map((id, k) => {
                            const g = groups.find(x => x.id === id)
                            return g ? (
                              <span key={id}>{k > 0 && '; '}<button type="button" className="text-purple-accent hover:underline" onClick={() => goToSource(id)}>{g.title}</button></span>
                            ) : null
                          })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Tabs */}
        <div>
          <div role="tablist" aria-label="Research results" className="flex flex-wrap gap-1 border-b border-slate-200">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn('min-h-10 px-4 -mb-px border-b-[3px] text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded-t',
                  tab === t.id ? 'border-purple-accent text-purple-deep' : 'border-transparent text-slate-600 hover:text-slate-900')}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4 space-y-4">
            {tab === 'questions' && (
              <>
                {researched.map(r => {
                  const chipTone = r.state === 'supported' ? 'success' : r.state === 'partly' ? 'warning' : 'neutral'
                  return (
                    <section key={r.question.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold tracking-wide text-purple-accent">QUESTION {numberOf(r)} · {prettyType(r.question.type)}</p>
                        <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0', CHIP_TONES[chipTone])}>{r.label}</span>
                      </div>
                      <h4 className="text-[15px] font-semibold text-slate-900 mt-1">{r.question.question}</h4>
                      <p className="text-[12px] text-slate-500 mt-0.5 tabular-nums">{r.used.length} source{r.used.length === 1 ? '' : 's'} accepted</p>
                      {r.question.reasons.length > 0 && r.state !== 'supported' && (
                        <ul className="text-[12px] text-slate-500 mt-2 list-disc pl-4">{r.question.reasons.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ul>
                      )}
                      {r.used.length === 0
                        ? <p className="text-[12px] text-slate-500 mt-3">No source has been accepted for this question.</p>
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
                        <li key={r.question.id} className="flex items-baseline justify-between gap-3 border-t border-purple-100 py-2 first:border-t-0">
                          <span className="text-[13px] text-slate-800">
                            <span className="font-semibold">Question {numberOf(r)}</span>{' '}
                            <span className="ml-1 px-2 py-0.5 rounded-full border border-purple-200 bg-white text-[11px] text-purple-deep">{r.question.type}</span>
                            <span className="block text-[12px] text-slate-500 mt-0.5">{r.question.question}</span>
                          </span>
                          <span className="text-[12px] text-slate-500 shrink-0">Planned, not yet researched</span>
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
                      <span className="block text-[12px] text-slate-500 mt-0.5">{g.year ?? 'n.d.'}{g.journal ? ` · ${g.journal}` : ''}</span>
                      <span className="block text-[12px] text-slate-500 mt-1">
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
            <p className="text-[11px] text-amber-700 mb-1.5">These are leads based on what this search found — not proof that nothing has been published.</p>
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

      {/* The selected source */}
      <aside aria-label="Selected source" className="rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Selected source</p>
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
          <p className="text-[13px] text-slate-600">Select a source to see its verification checks and the passage that supports it, where one was found.</p>
        )}
      </aside>
    </div>
  )
}
