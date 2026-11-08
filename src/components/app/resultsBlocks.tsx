import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Loader2, Minus, Undo2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { deepResearchApi, type EvidenceQuestion, type VerifiedEvidencePackage } from '../../api/deepResearch'
import { StanceMarker } from './deepResearchParts'
import { dedupeQuotes } from '../../lib/deepResearchReport'
import { authorLine, strengthLabel } from '../../lib/deepResearch'
import {
  coverageChip, joinMeta, regionLabel, relationshipTag, shortQuestion, sourceFacts, verificationChecks, type Chip, type SourceGroup,
} from '../../lib/deepResearchView'

// ── small building blocks ───────────────────────────────────────────────────────────────────

export const CHIP_TONES: Record<Chip['tone'] | 'success', string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-300',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

/** A chip whose explanation opens on hover AND keyboard focus, and is read out as its description. */
export function HintChip({ label, hint, tone = 'neutral' }: { label: string; hint: string; tone?: Chip['tone'] | 'success' }) {
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

export const prettyType = (t: string) => t.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()

// ── the source list rows ────────────────────────────────────────────────────────────────────

export function SourceRow({ source, questionId, selected, onSelect, cite, note }: {
  source: SourceGroup; questionId?: string; selected: boolean; onSelect: () => void
  /** The number of its citation in the report, when it is cited. */
  cite?: number
  /** A line under the facts, such as why a source was left out. */
  note?: string
}) {
  const f = sourceFacts(source, questionId)
  const regionMark = f.region.match === 'match' ? '✓ ' : f.region.match === 'near' ? '≈ ' : f.region.match === 'far' ? '↗ ' : ''
  return (
    <li data-source-id={source.id}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn('w-full text-left rounded-xl border p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
          selected ? 'border-purple-accent bg-purple-tint' : 'border-slate-200 bg-white hover:border-slate-300')}
      >
        <span className="block text-[13px] font-semibold leading-snug text-slate-900">{cite ? <span className="mr-1.5 rounded bg-purple-tint px-1 text-[12px] font-semibold tabular-nums text-purple-deep" title="Its number in the report">[{cite}]</span> : null}{source.title}</span>
        <span className="block text-[12px] text-slate-600 mt-0.5">{source.year ?? 'n.d.'}{source.journal ? ` · ${source.journal}` : ''}</span>
        {/* What the source is, not a score: whether it supports or disagrees, what kind of study, how big, and where. */}
        <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-slate-700">
          <StanceMarker stance={f.stance} />
          <span>{f.design ?? 'Design not seen'}</span>
          {f.sample !== null && <span className="tabular-nums">n = {f.sample.toLocaleString('en-US')}</span>}
          <span>{regionMark}{f.region.label}</span>
        </span>
        {note && <span className="mt-1 block text-[12px] text-slate-600">{note}</span>}
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

export function SearchLog({ sessionId, questions }: { sessionId: string; questions: EvidenceQuestion[] }) {
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

