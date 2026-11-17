import { useMemo, useState } from 'react'
import { FileText, Loader2, Send } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { DeepResearchReport, DeepResearchReportClaim } from '../../api/deepResearch'
import { MIN_QUESTION_CHARS, strengthLabel } from '../../lib/deepResearch'
import { citationNumbers, citedOnly, claimMarkers } from '../../lib/deepResearchReport'
import { CaveatLine } from './CaveatLine'
import { CitationMarker, DisagreesBadge } from './deepResearchParts'

const STRENGTH_TONE: Record<string, string> = {
  Strong: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Moderate: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Conflicting: 'bg-amber-50 text-amber-800 border-amber-200',
  Weak: 'bg-amber-50 text-amber-800 border-amber-200',
  Insufficient: 'bg-slate-100 text-slate-700 border-slate-200',
}

interface Props {
  report: DeepResearchReport
  /** Opens the existing source panel (verification checks and supporting quote) for this source. */
  onOpenSource: (sourceId: string) => void
  selectedId: string | null
  onExport: () => void
  exporting: boolean
  /** A follow-up runs as a new session with this question filled in. */
  onAsk: (question: string) => void
  /** The supporting quote on file for a source, shown when a marker is hovered or focused. */
  quoteFor?: (sourceId: string) => string | null
  /**
   * `answer` is the bottom line and the findings (shown above the tabs); `rest` is conflicts, gaps, references and the
   * follow-up box. `document` is the answer, conflicts and gaps (the centre column); `followup` is only the question box.
   * `all` is the whole report in one piece. Each sentence appears in exactly one place.
   */
  part?: 'all' | 'answer' | 'document' | 'followup' | 'rest' | 'findings' | 'references'
}

/**
 * The readable answer. Every sentence ends in citation markers that open the source's verification panel; a sentence
 * with no resolvable source is not rendered at all (the server already drops them, this is the second lock).
 */
export function DeepResearchReportView({ report, onOpenSource, selectedId, onExport, exporting, onAsk, quoteFor, part = 'all' }: Props) {
  const numbers = useMemo(() => citationNumbers(report), [report])
  const titleOf = useMemo(() => new Map(report.references.map(r => [r.sourceId, r.title])), [report])
  const [followUp, setFollowUp] = useState('')

  // A plain function, not a component: a component defined here would remount on every selection and drop keyboard focus.
  const markers = (claim: DeepResearchReportClaim) => (
    <>
      {claimMarkers(claim, numbers).map(m => (
        <CitationMarker key={m.id} n={m.n} title={titleOf.get(m.id) ?? ''} quote={quoteFor?.(m.id) ?? null} selected={selectedId === m.id} onOpen={() => onOpenSource(m.id)} />
      ))}
    </>
  )
  const renderClaim = (claim: DeepResearchReportClaim, key: number, badge?: 'Contradicts' | 'Null') => (
    <div key={key} className="space-y-1">
      <p className="max-w-[68ch] text-[16px] leading-[1.75] text-slate-800">
        {badge && <><DisagreesBadge kind={badge} /> </>}
        {claim.text} {markers(claim)}
      </p>
      {/* A caveat is a sentence too, so it carries its claim's markers. */}
      {(claim.caveats ?? []).map((c, i) => <CaveatLine key={i} text={c}>{markers(claim)}</CaveatLine>)}
    </div>
  )

  const bottom = citedOnly(report.bottomLine, numbers)
  const conflicts = citedOnly(report.conflicts, numbers)
  const noEffect = citedOnly(report.noEffect ?? [], numbers)
  const askOk = followUp.trim().length >= MIN_QUESTION_CHARS
  const showBottom = part === 'all' || part === 'answer' || part === 'document'
  const showFindings = showBottom || part === 'findings'
  const showConflicts = part === 'all' || part === 'rest' || part === 'document' || part === 'findings'
  const showGaps = part === 'all' || part === 'rest' || part === 'document'
  const showRefs = part === 'all' || part === 'rest' || part === 'references'
  // Suggestions come only from what this run left unanswered, never from invented topics.
  const suggestions = report.gaps.slice(0, 3).map(g => g.question).filter(q => q.trim().length >= MIN_QUESTION_CHARS)
  const showFollowUp = part === 'all' || part === 'rest' || part === 'followup'

  return (
    <div className="space-y-6">
      {showBottom && (
      <section aria-labelledby="report-bottom" className="rounded-2xl border border-purple-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 id="report-bottom" tabIndex={-1} className="scroll-mt-20 text-[12px] uppercase tracking-wider font-semibold text-slate-600 outline-none">Bottom line</h3>
          <span className={cn('px-2.5 py-0.5 rounded-full border text-[12px] font-medium', STRENGTH_TONE[report.evidenceStrength] ?? STRENGTH_TONE.Insufficient)}>
            Evidence strength: {strengthLabel(report.evidenceStrength)}
          </span>
        </div>
        {bottom.length > 0
          ? <div className="space-y-2">{bottom.map((c, i) => renderClaim(c, i))}</div>
          : <p className="text-[14px] text-slate-700">{report.bottomLineNote ?? 'No verified source supports a direct answer yet.'}</p>}
        {part === 'all' && <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onExport} disabled={exporting}
            className="inline-flex items-center gap-2 px-4 min-h-10 rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] font-medium hover:bg-slate-50 disabled:opacity-60">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} aria-hidden="true" />} Export report to Word
          </button>
        </div>}
      </section>
      )}

      {showFindings && report.sections.some(s => citedOnly(s.claims, numbers).length > 0) && (
        <section aria-labelledby="report-findings" className="space-y-5">
          <h3 id="report-findings" tabIndex={-1} className="scroll-mt-20 text-[12px] uppercase tracking-wider font-semibold text-slate-600 outline-none">Key findings</h3>
          {report.sections.map(s => {
            const claims = citedOnly(s.claims, numbers)
            if (claims.length === 0) return null
            return (
              <section key={s.questionId} aria-label={s.heading}>
                <h4 id={`report-section-${s.questionId}`} tabIndex={-1} className="scroll-mt-20 font-serif text-[17px] font-semibold text-slate-900 outline-none">{s.heading}</h4>
                <div className="mt-2 space-y-2">{claims.map((c, i) => renderClaim(c, i))}</div>
              </section>
            )
          })}
        </section>
      )}

      {showConflicts && conflicts.length > 0 && (
        <section aria-labelledby="report-conflicts" className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5">
          <h3 id="report-conflicts" tabIndex={-1} className="scroll-mt-20 outline-none font-serif text-[18px] font-semibold text-slate-900">Contradicting evidence</h3>
          <p className="text-[13px] text-slate-700 mt-0.5 mb-2">Relevant sources whose findings go against the question.</p>
          <div className="space-y-2">{conflicts.map((c, i) => renderClaim(c, i, 'Contradicts'))}</div>
        </section>
      )}

      {showConflicts && noEffect.length > 0 && (
        <section aria-labelledby="report-noeffect" className="rounded-2xl border border-sky-200 bg-sky-50/40 p-5">
          <h3 id="report-noeffect" tabIndex={-1} className="scroll-mt-20 outline-none font-serif text-[18px] font-semibold text-slate-900">No effect found</h3>
          <p className="text-[13px] text-slate-700 mt-0.5 mb-2">Relevant sources that studied this and found no effect. A finding in its own right, not a contradiction.</p>
          <div className="space-y-2">{noEffect.map((c, i) => renderClaim(c, i, 'Null'))}</div>
        </section>
      )}

      {showGaps && report.gaps.length > 0 && (
        <section aria-labelledby="report-gaps" className="rounded-2xl border border-dashed border-purple-200 bg-purple-tint/40 p-5">
          <h3 id="report-gaps" tabIndex={-1} className="scroll-mt-20 outline-none font-serif text-[18px] font-semibold text-slate-900">Gaps</h3>
          <p className="text-[13px] text-slate-700 mt-0.5 mb-2">What the evidence did not answer. Nothing here is a finding.</p>
          <ul className="space-y-2">
            {report.gaps.map((g, i) => (
              <li key={i} className="text-[13px] text-slate-800">
                <span className="font-medium">{g.question}</span>
                <span className="block text-[13px] text-slate-700">{g.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showRefs && report.references.length > 0 && (
        <section aria-labelledby="report-refs">
          <h3 id="report-refs" className="font-serif text-[18px] font-semibold text-slate-900 mb-2">References</h3>
          <ol className="space-y-1.5">
            {report.references.map(r => (
              <li key={r.sourceId} className="flex gap-2 text-[13px] text-slate-700">
                <span className="shrink-0 tabular-nums text-slate-600">[{r.number}]</span>
                <span>
                  {r.authors.length === 0 ? 'Unknown authors' : r.authors.length <= 3 ? r.authors.join(', ') : `${r.authors.slice(0, 3).join(', ')} et al.`} ({r.year ?? 'n.d.'}).{' '}
                  <button type="button" onClick={() => onOpenSource(r.sourceId)} className="text-left text-purple-deep hover:underline outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded">{r.title}</button>.
                  {r.journal ? ` ${r.journal}.` : ''}
                  {r.doi && <> <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" className="text-slate-600 hover:underline">doi.org/{r.doi}<span className="sr-only"> (opens in a new tab)</span></a></>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {showFollowUp && <section aria-labelledby="report-followup" className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 id="report-followup" className="text-[14px] font-semibold text-slate-900">Ask a follow-up</h3>
        <p className="text-[13px] text-slate-700 mt-0.5">It runs as a new research session, with your question filled in so you can edit it first.</p>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">
            {suggestions.map(q => (
              <button key={q} type="button" onClick={() => setFollowUp(q)} title={q}
                className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700 hover:border-purple-accent hover:text-purple-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
                {q}
              </button>
            ))}
          </div>
        )}
        <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); if (askOk) onAsk(followUp.trim()) }}>
          <label htmlFor="report-followup-input" className="sr-only">Follow-up question</label>
          <input id="report-followup-input" value={followUp} onChange={e => setFollowUp(e.target.value)} maxLength={1500}
            placeholder="e.g. Does this hold for first-year students?"
            className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-800 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30" />
          <button type="submit" disabled={!askOk}
            className={cn('inline-flex items-center gap-1.5 px-4 min-h-10 rounded-xl text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/50',
              askOk ? 'bg-purple-accent text-white hover:bg-purple-deep' : 'bg-slate-200 text-slate-600 cursor-not-allowed')}>
            <Send size={13} aria-hidden="true" /> Ask
          </button>
        </form>
      </section>}
    </div>
  )
}
