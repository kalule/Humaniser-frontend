import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bookmark, Check, FileText, Loader2, RotateCcw, Search, Telescope } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import type { DeepResearchReport, FollowUpQuote, DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchReportView } from './DeepResearchReportView'
import { CaveatLine } from './CaveatLine'
import { CitationMarker, ClampedTitle, CountsLine, ProgressSteps, ReportUnavailable } from './deepResearchParts'
import { QuestionsSection } from './QuestionsSection'
import { AcademicReportCard } from './AcademicReportCard'
import { ResultsPanel, type PanelView } from './ResultsPanel'
import { CHIP_TONES } from './resultsBlocks'
import { strengthLabel } from '../../lib/deepResearch'
import {
  buildCitationIndex, currentSection, dedupeByDoi, findGroup, hasEvidence, idsOf, mergeSourceRows, needsFollowUp, outlineItems,
  groupLimitations, prefillFrom, previewQuote, questionAnchor, questionTag, savableSources, sessionStatusChip, stepState, stepTitle, stripSeparators,
  verdictLabel, verdictOf, type Prefill, type SourceFilterId, type SourceGroup,
} from '../../lib/deepResearchView'

export { SourceDetail, SourceRow } from './resultsBlocks'

// ── the results view ────────────────────────────────────────────────────────────────────────

export interface DeepResearchResultsProps {
  session: DeepResearchSession
  rows: EvidenceSource[]
  busyId: string | null
  addedIds: Set<string>
  onDecide: (sourceId: string, decision: 'accept' | 'reject' | 'clear') => Promise<void>
  onAdd: (sourceId: string) => Promise<void>
  /** Saves several sources to the references in one go, with one message. Falls back to `onAdd` one at a time. */
  onAddMany?: (sourceIds: string[]) => Promise<void>
  onUse: (source: SourceGroup) => void
  onExport: () => void
  exporting: boolean
  onFollowUp: (prefill: Prefill) => void
  onNew: () => void
  /** The cited report. Null while it loads or if it could not be loaded; the panel's evidence views work without it. */
  report?: DeepResearchReport | null
  reportFailed?: boolean
  onExportReport?: () => void
  exportingReport?: boolean
  /** Why the report failed, in words, when it did. */
  reportErrorHint?: string
  onRetryReport?: () => void
  retryingReport?: boolean
  /** Builds the report in the browser from the session's findings and sources. */
  onGenerateReport?: () => void
  generatingReport?: boolean
  /** What continuing (or, for an off-topic run, retrying) this session would do and cost, as the server priced it. */
  followUpQuote?: FollowUpQuote | null
  onContinue?: () => void
  continuing?: boolean
  /** Retries an off-topic run at no cost. */
  onRetry?: () => void
  retrying?: boolean
  /** Which panel view, and which Sources filter, to start on. */
  initialPanelView?: PanelView
  initialSourceFilter?: SourceFilterId
}

const chipBase = 'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-purple-accent focus-visible:ring-offset-1 disabled:opacity-60'
const chipPrimary = `${chipBase} border-purple-accent bg-purple-accent text-white hover:bg-purple-deep shadow shadow-purple-400/20`
const chipSecondary = `${chipBase} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`
const secondary = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl border border-slate-300 bg-white text-slate-800 text-[13px] font-medium hover:bg-slate-50 disabled:opacity-60'

const STRENGTH_TONE: Record<string, string> = {
  Strong: CHIP_TONES.success, Moderate: CHIP_TONES.success, Conflicting: CHIP_TONES.warning, Weak: CHIP_TONES.warning, Insufficient: CHIP_TONES.neutral,
}

export function DeepResearchResults({
  session, rows, busyId, addedIds, onDecide, onAdd, onAddMany, onUse, onExport, exporting, onFollowUp, onNew, report = null, reportFailed = false,
  onExportReport, exportingReport = false, reportErrorHint, onRetryReport, retryingReport = false, onGenerateReport, generatingReport = false,
  followUpQuote = null, onContinue, continuing = false, onRetry, retrying = false, initialPanelView = 'sources', initialSourceFilter,
}: DeepResearchResultsProps) {
  const result = session.result
  const questions = useMemo(() => result?.questions ?? [], [result])
  // One entry per paper: the same DOI found twice is one source here.
  const groups = useMemo(() => dedupeByDoi(mergeSourceRows(rows)), [rows])
  const needsReview = session.status === 'NeedsReview'
  const failed = session.status === 'Failed'
  // Every verdict below is the server's; nothing here re-derives one.
  const unanswered = questions.filter(q => verdictOf(q) !== 'Answered').length
  const withoutEvidence = useMemo(() => new Set(questions.filter(q => !hasEvidence(q)).map(q => q.id)), [questions])
  const canContinue = !needsReview && needsFollowUp(session.status) && !!followUpQuote?.canContinue && !!onContinue
  const canRetry = needsReview && !!followUpQuote?.canRetryFree && !!onRetry
  const chip = sessionStatusChip(session.status)

  // One list of what is cited and under which numbers: the report's references (numbered in reading order), then any
  // source only a key finding names.
  const citation = useMemo(() => buildCitationIndex(groups, report, result?.keyFindings), [groups, report, result])
  const numbers = citation.numbers
  const citedIds = citation.cited

  // ── the panel ──
  const [view, setView] = useState<PanelView>(initialPanelView)
  const [filterChoice, setFilter] = useState<SourceFilterId | null>(null)
  const filter: SourceFilterId = filterChoice ?? initialSourceFilter ?? (needsReview ? 'offTopic' : citation.ids.length > 0 ? 'cited' : 'all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedId, setSelectedRaw] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const panelRef = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const selected = findGroup(groups, selectedId) ?? null

  // Remember what opened the panel so closing it puts keyboard focus back there; move focus into the panel when it opens.
  const select = (id: string | null) => {
    if (id) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setSheetOpen(true)
    }
    setSelectedRaw(id)
  }
  const back = () => { setSelectedRaw(null); requestAnimationFrame(() => trigger.current?.focus()) }
  const closePanel = () => { setSelectedRaw(null); setSheetOpen(false); requestAnimationFrame(() => trigger.current?.focus()) }
  useEffect(() => {
    if (!selectedId && !sheetOpen) return
    if (selectedId) panelRef.current?.focus({ preventScroll: true })
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { if (selectedId) back(); else closePanel() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedId, sheetOpen])

  // A report citation or a row opens that source's verification card in the panel.
  const openSource = (id: string) => select(findGroup(groups, id)?.id ?? id)
  const quoteFor = (id: string) => previewQuote(findGroup(groups, id))

  // ── the outline: which section the reader is in ──
  const outline = useMemo(() => (report ? outlineItems(report) : []), [report])
  const [currentId, setCurrentId] = useState<string | null>(null)
  useEffect(() => {
    if (outline.length === 0) { setCurrentId(null); return }
    let frame = 0
    const measure = () => {
      frame = 0
      const tops = outline.flatMap(o => { const el = document.getElementById(o.id); return el ? [{ id: o.id, top: el.getBoundingClientRect().top }] : [] })
      setCurrentId(currentSection(tops, 140))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', onScroll, true)      // capture: the page scrolls inside the app shell, not the window
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [outline])
  const jumpTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
    setCurrentId(id)
  }
  // A step goes to its question (opening its card) and moves focus there.
  const jumpToQuestion = (index: number) => { const q = questions[index]; if (q) requestAnimationFrame(() => jumpTo(questionAnchor(q.id))) }

  // ── decisions on the selected source: every record of the same paper moves together ──
  const exclude = async (g: SourceGroup) => {
    await Promise.all(idsOf(g).map(id => onDecide(id, 'reject')))
    setAnnounce(`Excluded: ${g.title}`)
    toast((t) => (
      <span className="flex items-center gap-3 text-[13px]">
        Excluded from this evidence.
        <button className="font-semibold text-purple-deep hover:underline" onClick={() => { toast.dismiss(t.id); void Promise.all(idsOf(g).map(id => onDecide(id, 'clear'))).then(() => setAnnounce(`Restored: ${g.title}`)) }}>Undo</button>
      </span>
    ), { duration: 8000 })
  }
  const restore = async (g: SourceGroup) => { await Promise.all(idsOf(g).map(id => onDecide(id, 'accept'))); setAnnounce(`Using again: ${g.title}`) }
  const add = async (g: SourceGroup) => { await onAdd(g.id); setAnnounce(`Added to references: ${g.title}`) }

  // ── actions ──
  const savable = needsReview ? [] : savableSources(groups, addedIds)
  const [saving, setSaving] = useState(false)
  const saveSources = async () => {
    if (savable.length === 0 || saving) return
    setSaving(true)
    try {
      if (onAddMany) await onAddMany(savable.map(g => g.id))
      else for (const g of savable) await onAdd(g.id)
      setAnnounce(`Saved ${savable.length} source${savable.length === 1 ? '' : 's'} to your references`)
    } finally { setSaving(false) }
  }
  const ask = (q: string) => onFollowUp({ ...prefillFrom(session), question: q, unanswered: [] })

  // Gaps already shown in the "not researched" block are not repeated.
  const gaps = (report?.gaps ?? []).filter(g => !withoutEvidence.has(g.questionId))
  const findGapsTarget = withoutEvidence.size > 0 ? 'not-researched-heading' : gaps.length > 0 ? 'report-gaps-list' : null
  const answer = needsReview ? null : report?.bottomLine[0] ?? null
  const strength = report?.evidenceStrength ?? result?.evidenceStrength ?? 'Insufficient'
  const steps = questions.map(q => ({ title: stepTitle(q), state: stepState(q), verdict: verdictLabel(q) }))

  const retryButton = (cls: string, primary = false) => (
    <button type="button" className={cls} data-primary={primary ? 'true' : undefined} onClick={onRetry} disabled={!canRetry || retrying}
      title={canRetry ? 'Runs the same question again with a fresh search. Nothing is charged.' : followUpQuote?.reason ?? 'This run has already been retried.'}>
      {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} aria-hidden="true" />} Retry search · free
    </button>
  )
  const continueButton = (cls: string, primary = false) => (
    <button type="button" className={cls} data-primary={primary ? 'true' : undefined} onClick={onContinue} disabled={!canContinue || continuing}
      title={canContinue ? undefined : (followUpQuote?.reason ?? 'The server could not price a follow-up right now. Try again in a moment, or start new research from this.')}>
      {continuing ? <Loader2 size={14} className="animate-spin" /> : <Telescope size={14} aria-hidden="true" />}
      Research remaining {canContinue ? followUpQuote!.unansweredQuestions : unanswered} question{(canContinue ? followUpQuote!.unansweredQuestions : unanswered) === 1 ? '' : 's'}
    </button>
  )
  const lead: 'retry' | 'continue' | 'export' = needsReview ? 'retry' : canContinue ? 'continue' : 'export'

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>

      <div className="min-w-0 space-y-5">
        {/* 1. Header: the question, why the run ended, what it cost */}
        <header>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-600">Your question</p>
            <div className="flex flex-wrap items-center gap-2">
              {session.creditsUsed != null && (
                <span className="text-[12px] text-slate-600">{session.creditsUsed === 0 ? 'No credits used' : `${session.creditsUsed} credit${session.creditsUsed === 1 ? '' : 's'} used`}</span>
              )}
              <span data-testid="status-badge" className={cn('rounded-full border px-2.5 py-0.5 text-[12px] font-medium', CHIP_TONES[chip.tone])}>
                {session.statusReason ?? chip.label}
              </span>
            </div>
          </div>
          <ClampedTitle text={session.researchQuestion} />
        </header>

        {/* 2. Verdict: the answer in one sentence, its strength, and the caveats that go with it */}
        {needsReview ? (
          <section role="alert" aria-labelledby="verdict-heading" className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h3 id="verdict-heading" className="flex items-center gap-2 text-[18px] font-semibold text-red-950">
              <AlertTriangle size={18} aria-hidden="true" /> Results look off-topic
            </h3>
            <p className="mt-1 text-[14px] text-red-950">
              {session.completionNote ?? 'Most searches returned papers about a different subject, so no answer is given.'}
            </p>
            {questions.some(q => q.offTopicQuery) && (
              <ul className="mt-2 space-y-0.5 text-[12px] text-red-900">
                {questions.filter(q => q.offTopicQuery).map(q => (
                  <li key={q.id} className="break-words"><span className="font-semibold">{stepTitle(q)}:</span> searched <code className="font-mono">{q.offTopicQuery}</code></li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {retryButton(chipSecondary)}
              <span className="text-[12px] text-red-900">{canRetry ? 'Free: the search failed on our side, so nothing is charged.' : followUpQuote?.canRetryFree === false ? 'This run has already been retried.' : ''}</span>
            </div>
          </section>
        ) : (
          <section aria-labelledby="verdict-heading" className="rounded-2xl border border-purple-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="verdict-heading" className="text-[18px] font-semibold text-slate-900">{result?.verdictLabel ?? 'Not enough evidence'}</h3>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[12px] font-medium', STRENGTH_TONE[strength] ?? STRENGTH_TONE.Insufficient)}>
                Evidence strength: {strengthLabel(strength)}
              </span>
            </div>
            <p id="report-bottom" tabIndex={-1} className="mt-2 max-w-[68ch] scroll-mt-20 text-[16px] leading-[1.75] text-slate-800 outline-none">
              {answer ? <>
                {answer.text}{' '}
                {answer.sourceIds.map(id => { const g = findGroup(groups, id); const n = numbers.get(g?.id ?? id); return n ? <CitationMarker key={id} n={n} title={g?.title ?? ''} quote={quoteFor(id)} selected={selected?.id === g?.id} onOpen={() => openSource(id)} /> : null })}
              </> : (report?.bottomLineNote ?? (failed ? 'The research hit a problem before it could answer.' : 'No verified source supports a direct answer yet.'))}
            </p>
            {result && result.limitations.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[12px] font-semibold text-slate-700">Keep in mind</p>
                <div className="mt-1 space-y-1">{groupLimitations(result.limitations).map((l, i) => <CaveatLine key={i} text={l} />)}</div>
              </div>
            )}
          </section>
        )}
        {needsReview && result && result.limitations.length > 0 && (
          <div className="space-y-1">{groupLimitations(result.limitations).map((l, i) => <CaveatLine key={i} text={l} />)}</div>
        )}

        {/* The cited findings, then contradicting and no-effect evidence (never mixed) */}
        {report && !needsReview ? (
          <>
            {report.builtLocally && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                Built here from this session&rsquo;s findings, because the server&rsquo;s report was not available. It follows the same rule: every sentence cites a verified source.
              </p>
            )}
            <DeepResearchReportView part="findings" report={report} onOpenSource={openSource} selectedId={selected?.id ?? null} quoteFor={quoteFor}
              onExport={() => onExportReport?.()} exporting={exportingReport} onAsk={ask} />
          </>
        ) : !report && onExportReport && !reportFailed && !needsReview ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-500" aria-label="Loading the report" /></div>
        ) : !report && !needsReview ? (
          <>
            {reportFailed && (
              <ReportUnavailable hint={reportErrorHint} retrying={retryingReport} generating={generatingReport}
                canGenerate={rows.length > 0 && !!onGenerateReport} onRetry={() => onRetryReport?.()} onGenerate={() => onGenerateReport?.()} />
            )}
            {result && result.keyFindings.length > 0 && (
              <section aria-labelledby="fallback-findings">
                <h3 id="fallback-findings" className="mb-2 text-left text-[15px] font-semibold text-slate-900">Key findings</h3>
                <ul className="space-y-3">
                  {result.keyFindings.map((f, i) => {
                    const tag = questionTag(f.evidenceQuestionId, questions)
                    const cites = [...f.supportingSourceIds, ...f.contradictingSourceIds].map(id => findGroup(groups, id)).filter((g): g is SourceGroup => !!g)
                    const unique = cites.filter((g, k) => cites.findIndex(x => x.id === g.id) === k)
                    return (
                      <li key={i} className="rounded-xl border border-slate-200 bg-white p-3.5">
                        {tag && <span title={tag.hint} className="mb-1.5 inline-block rounded bg-purple-tint px-1.5 py-px text-[12px] font-semibold text-purple-deep">{tag.label}</span>}
                        <p className="text-[14px] leading-relaxed text-slate-800">
                          {stripSeparators(f.statement)}{' '}
                          {unique.map(g => <CitationMarker key={g.id} n={numbers.get(g.id) ?? 0} title={g.title} quote={previewQuote(g)} selected={selected?.id === g.id} onOpen={() => select(g.id)} />)}
                        </p>
                        <p className="mt-1 text-[12px] text-slate-600">{strengthLabel(f.strength)}</p>
                        <div className="mt-1 space-y-1">{f.caveats.map((c, j) => <CaveatLine key={j} text={c} />)}</div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        ) : null}

        {/* 3. Progress: one labelled step per question, from the server's verdicts */}
        <section aria-label="Questions">
          <ProgressSteps steps={steps} onSelect={jumpToQuestion} />
          {result?.counts && <div className="mt-2"><CountsLine counts={result.counts} /></div>}
        </section>

        {/* 4. Evidence by question */}
        {result && (
          <QuestionsSection questions={questions} groups={groups} numbers={numbers} selectedId={selected?.id ?? null} onSelect={select}
            emptyAction={needsReview ? retryButton(chipSecondary) : canContinue ? continueButton(chipSecondary) : undefined} />
        )}

        {/* 5. Gaps: only those not already in the "not researched" block */}
        {gaps.length > 0 && (
          <section aria-labelledby="report-gaps-list" className="rounded-2xl border border-dashed border-purple-200 bg-purple-tint/40 p-5">
            <h3 id="report-gaps-list" tabIndex={-1} className="scroll-mt-20 font-serif text-[18px] font-semibold text-slate-900 outline-none">Gaps</h3>
            <p className="mb-2 mt-0.5 text-[13px] text-slate-700">What the evidence did not fully answer. Nothing here is a finding.</p>
            <ul className="space-y-2">
              {gaps.map((g, i) => (
                <li key={i} className="text-[13px] text-slate-800"><span className="font-medium">{g.question}</span><span className="block text-slate-700">{g.reason}</span></li>
              ))}
            </ul>
          </section>
        )}
        {result && !needsReview && result.gapCandidates.some(g => g.status === 'GapCandidate') && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <h3 className="mb-1 text-[13px] font-semibold text-amber-900">Possible gaps</h3>
            <p className="mb-1.5 text-[12px] text-amber-900">These are leads based on what this search found — not proof that nothing has been published.</p>
            <ul className="space-y-1 text-[13px] text-amber-900">
              {result.gapCandidates.flatMap((g, i) => g.reasons.map((r, j) => <li key={`${i}-${j}`}>{r}</li>))}
            </ul>
          </section>
        )}

        {/* 6. Sticky action bar */}
        <div role="group" aria-label="Next steps" data-testid="action-bar"
          className="sticky bottom-0 z-20 -mx-2 space-y-1.5 rounded-t-xl border-t border-slate-200 bg-white/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex flex-wrap items-center gap-2">
            {needsReview
              ? retryButton(chipPrimary, true)
              : (canContinue || unanswered > 0) && continueButton(lead === 'continue' ? chipPrimary : chipSecondary, lead === 'continue')}
            <button type="button" className={chipSecondary} onClick={() => findGapsTarget && jumpTo(findGapsTarget)} disabled={!findGapsTarget}
              title={findGapsTarget ? 'Jump to what the evidence did not answer' : 'No gaps were found'}>
              <Search size={14} aria-hidden="true" /> Find gaps{unanswered > 0 ? ` (${unanswered})` : ''}
            </button>
            {onExportReport && !needsReview && (
              <button type="button" className={lead === 'export' ? chipPrimary : chipSecondary} data-primary={lead === 'export' ? 'true' : undefined} onClick={onExportReport} disabled={exportingReport}>
                {exportingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} aria-hidden="true" />} Export report
              </button>
            )}
            {!needsReview && (
              <button type="button" className={chipSecondary} onClick={() => void saveSources()} disabled={savable.length === 0 || saving}
                title={savable.length === 0 ? 'Every accepted, verified source is already in your references' : 'Add the accepted, verified sources to your references'}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : savable.length === 0 ? <Check size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
                {savable.length === 0 ? 'Sources saved' : `Save sources (${savable.length})`}
              </button>
            )}
          </div>
          {canContinue && (
            <p className="text-[12px] text-slate-700" data-testid="follow-up-price">
              Uses {followUpQuote!.followUpCredits} credits; unused credits are returned. Keeps your {followUpQuote!.answeredQuestions} answered question{followUpQuote!.answeredQuestions === 1 ? '' : 's'} and researches only the rest.
            </p>
          )}
          {needsReview && canRetry && <p className="text-[12px] text-slate-700" data-testid="retry-price">Uses no credits: the search failed on our side.</p>}
        </div>

        {/* The long-form report, written on request from the verified sources */}
        {rows.length > 0 && <AcademicReportCard sessionId={session.id} canWrite />}

        {/* References for the numbered markers above, then the follow-up */}
        {report && !needsReview && <DeepResearchReportView part="references" report={report} onOpenSource={openSource} selectedId={selected?.id ?? null}
          onExport={() => onExportReport?.()} exporting={exportingReport} onAsk={ask} />}

        {/* 7. Follow-up */}
        {report && <DeepResearchReportView part="followup" report={report} onOpenSource={openSource} selectedId={selected?.id ?? null}
          onExport={() => onExportReport?.()} exporting={exportingReport} onAsk={ask} />}
        <div className="flex flex-wrap items-center gap-2">
          {needsFollowUp(session.status) && <button type="button" className={secondary} onClick={() => onFollowUp(prefillFrom(session))}>Start new research from this</button>}
          <button type="button" className={secondary} onClick={onExport} disabled={exporting}
            title="A JSON file with your questions, accepted and contradicting sources, gaps, search coverage and what was used.">
            {exporting && <Loader2 size={14} className="animate-spin" />} Download evidence package
          </button>
          <button type="button" className={secondary} onClick={() => onFollowUp({ ...prefillFrom(session), unanswered: [] })}>Edit question</button>
          <button type="button" className={secondary} onClick={onNew}>New research</button>
        </div>
      </div>

      {/* ── right: the sources rail (a bottom sheet on narrow screens) ── */}
      {sheetOpen && <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={closePanel} aria-hidden="true" />}
      {!sheetOpen && (
        <button type="button" onClick={() => setSheetOpen(true)}
          className="fixed bottom-20 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent focus-visible:ring-offset-2 lg:hidden">
          Sources ({result?.counts?.found ?? groups.length})
        </button>
      )}
      <ResultsPanel
        panelRef={panelRef} sessionId={session.id} view={view} onView={v => { setSelectedRaw(null); setView(v) }}
        filter={filter} onFilter={setFilter} groups={groups} citedIds={citedIds} numbers={numbers}
        questions={questions} counts={result?.counts}
        outline={outline} currentSectionId={currentId} onJump={jumpTo}
        selected={selected} selectedId={selected?.id ?? null} onSelect={select} onBack={back}
        busyId={busyId} added={selected ? idsOf(selected).some(id => addedIds.has(id)) : false}
        onAdd={() => selected && void add(selected)} onUse={() => selected && onUse(selected)}
        onExclude={() => selected && void exclude(selected)} onRestore={() => selected && void restore(selected)}
        open={sheetOpen} onClose={closePanel}
      />
    </div>
  )
}
