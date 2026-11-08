import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Check, FileText, Loader2, Search, Telescope } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import type { DeepResearchReport, FollowUpQuote, DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchReportView } from './DeepResearchReportView'
import { CaveatLine } from './CaveatLine'
import { CitationMarker, ClampedTitle, QuestionProgress, ReportUnavailable, SourcesSummary } from './deepResearchParts'
import { QuestionsSection } from './QuestionsSection'
import { ResultsPanel, type PanelView } from './ResultsPanel'
import { CHIP_TONES } from './resultsBlocks'
import { strengthLabel } from '../../lib/deepResearch'
import {
  buildCitationIndex, completionSummary, countSources, currentSection, dedupeByDoi, evidenceAgainst, findGroup, idsOf,
  mergeSourceRows, needsFollowUp, outlineItems, prefillFrom, previewQuote, qualityRollup, questionAnchor, questionRows, questionTag, rateQuestion, savableSources,
  rollupText, segmentsFromRatings, statusBanner, stripSeparators, type Prefill, type SourceFilterId, type SourceGroup,
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
  /** What continuing this session would cost against starting again. Present only when the server says it can be continued. */
  followUpQuote?: FollowUpQuote | null
  onContinue?: () => void
  continuing?: boolean
  /** Which panel view, and which Sources filter, to start on. */
  initialPanelView?: PanelView
  initialSourceFilter?: SourceFilterId
}

const chipBase = 'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-purple-accent focus-visible:ring-offset-1 disabled:opacity-60'
const chipPrimary = `${chipBase} border-purple-accent bg-purple-accent text-white hover:bg-purple-deep shadow shadow-purple-400/20`
const chipSecondary = `${chipBase} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`

export function DeepResearchResults({
  session, rows, busyId, addedIds, onDecide, onAdd, onAddMany, onUse, onExport, exporting, onFollowUp, onNew, report = null, reportFailed = false,
  onExportReport, exportingReport = false, reportErrorHint, onRetryReport, retryingReport = false, onGenerateReport, generatingReport = false,
  followUpQuote = null, onContinue, continuing = false, initialPanelView = 'sources', initialSourceFilter,
}: DeepResearchResultsProps) {
  const result = session.result
  const questions = result?.questions ?? []
  // One entry per paper: the same DOI found twice is one source here.
  const groups = useMemo(() => dedupeByDoi(mergeSourceRows(rows)), [rows])
  const counts = useMemo(() => countSources(groups), [groups])
  const qRows = useMemo(() => questionRows(questions, groups), [questions, groups])
  const against = useMemo(() => evidenceAgainst(groups), [groups])
  // "Answered" is decided by how well each question is supported, so the count, the bar and the labels always agree.
  const ratings = useMemo(() => qRows.map(rateQuestion), [qRows])
  const segments = segmentsFromRatings(ratings)
  const rollup = qualityRollup(ratings)
  const unanswered = rollup.total - rollup.strong
  const banner = statusBanner(session, rollup.strong, questions.length)
  const summary = completionSummary(session, rollup)
  const followUp = needsFollowUp(session.status)
  const canContinue = followUp && !!followUpQuote?.canContinue && !!onContinue
  const failed = session.status === 'Failed'

  // One list of what is cited and under which numbers: the report's references, then any source only a key finding names.
  const citation = useMemo(() => buildCitationIndex(groups, report, result?.keyFindings), [groups, report, result])
  const numbers = citation.numbers
  const citedIds = citation.cited

  // ── the panel ──
  const [view, setView] = useState<PanelView>(initialPanelView)
  const [filterChoice, setFilter] = useState<SourceFilterId | null>(null)
  const filter: SourceFilterId = filterChoice ?? initialSourceFilter ?? (citation.ids.length > 0 ? 'cited' : 'all')
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
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
    setCurrentId(id)
  }

  // A progress segment goes to that question, in the main column, and moves focus there.
  const jumpToQuestion = (index: number) => {
    const q = questions[index]
    if (!q) return
    requestAnimationFrame(() => {
      const el = document.getElementById(questionAnchor(q.id))
      el?.focus({ preventScroll: true })
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

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

  // ── next steps under the report ──
  const savable = savableSources(groups, addedIds)
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
  // Exactly one filled button: researching what is left when that is possible, else the Word export, else what the page always had.
  const lead: 'continue' | 'export' | 'startNew' | 'download' = canContinue ? 'continue' : onExportReport ? 'export' : followUp ? 'startNew' : 'download'
  const secondary = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl border border-slate-300 bg-white text-slate-800 text-[13px] font-medium hover:bg-slate-50 disabled:opacity-60'
  const primaryCls = 'inline-flex items-center gap-2 px-4 min-h-10 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold shadow shadow-purple-400/20 disabled:opacity-60'
  const cls = (k: typeof lead) => (lead === k ? primaryCls : secondary)
  const gapCount = report?.gaps.length ?? 0

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>

      {/* ── centre: the report ── */}
      <div className="min-w-0 space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-600">Your question</p>
            <span className={cn('rounded-full border px-2.5 py-0.5 text-[12px] font-medium', CHIP_TONES[summary.chip.tone])}>{summary.chip.label}</span>
          </div>
          <ClampedTitle text={session.researchQuestion} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Status">
          <h3 className="text-[18px] font-semibold text-slate-900">{summary.headline}</h3>
          {(summary.note ?? (questions.length === 0 ? banner.title : null)) && (
            <p role={banner.role} className={cn('mt-1 text-[13px]', failed ? 'text-red-700' : 'text-slate-700')}>{summary.note ?? banner.title}</p>
          )}
          <QuestionProgress segments={segments} summary={rollupText(rollup)} onSelect={jumpToQuestion} />
        </section>

        {/* The funnel, as one line above the report */}
        {result && <SourcesSummary counts={counts} against={against.length} overall={strengthLabel(result.evidenceStrength)} />}

        {report ? (
          <>
            {report.builtLocally && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                Built here from this session&rsquo;s findings, because the server&rsquo;s report was not available. It follows the same rule: every sentence cites a verified source.
              </p>
            )}
            <DeepResearchReportView part="document" report={report} onOpenSource={openSource} selectedId={selected?.id ?? null} quoteFor={quoteFor}
              onExport={() => onExportReport?.()} exporting={exportingReport} onAsk={q => onFollowUp({ ...prefillFrom(session), question: q, unanswered: [] })} />
          </>
        ) : onExportReport && !reportFailed ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" aria-label="Loading the report" /></div>
        ) : (
          <>
            {reportFailed && (
              <ReportUnavailable hint={reportErrorHint} retrying={retryingReport} generating={generatingReport}
                canGenerate={rows.length > 0 && !!onGenerateReport} onRetry={() => onRetryReport?.()} onGenerate={() => onGenerateReport?.()} />
            )}
            {/* The key findings the session produced, so there is always something to read. */}
            {result && result.keyFindings.length > 0 && (
              <section aria-labelledby="fallback-findings">
                <h3 id="fallback-findings" className="mb-2 text-left text-[15px] font-semibold text-slate-900">Key findings{followUp ? ' so far' : ''}</h3>
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
                          {unique.map(g => (
                            <CitationMarker key={g.id} n={numbers.get(g.id) ?? 0} title={g.title} quote={previewQuote(g)} selected={selected?.id === g.id} onOpen={() => select(g.id)} />
                          ))}
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
        )}

        {/* Under the report: what to do next */}
        <div role="group" aria-label="Next steps" className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          {(canContinue || unanswered > 0) && (
            <button type="button" data-primary={lead === 'continue' ? 'true' : undefined} className={lead === 'continue' ? chipPrimary : chipSecondary}
              onClick={onContinue} disabled={!canContinue || continuing}
              title={canContinue ? undefined : (followUpQuote?.reason ?? 'The server could not price a follow-up right now. Try again in a moment, or start new research from this.')}>
              {continuing ? <Loader2 size={14} className="animate-spin" /> : <Telescope size={14} aria-hidden="true" />}
              {canContinue
                ? <>Research remaining {followUpQuote!.unansweredQuestions} question{followUpQuote!.unansweredQuestions === 1 ? '' : 's'} · {followUpQuote!.followUpCredits} credits</>
                : <>Research remaining {unanswered} question{unanswered === 1 ? '' : 's'}</>}
            </button>
          )}
          <button type="button" className={chipSecondary} onClick={() => jumpTo(report ? 'report-gaps' : 'questions-heading')} disabled={(report ? gapCount : unanswered) === 0}
            title={(report ? gapCount : unanswered) === 0 ? 'No gaps were found' : 'Jump to what the evidence did not answer'}>
            <Search size={14} aria-hidden="true" /> Find gaps{(report ? gapCount : unanswered) > 0 ? ` (${report ? gapCount : unanswered})` : ''}
          </button>
          {onExportReport && (
            <button type="button" data-primary={lead === 'export' ? 'true' : undefined} className={lead === 'export' ? chipPrimary : chipSecondary} onClick={onExportReport} disabled={exportingReport}>
              {exportingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} aria-hidden="true" />} Export report (Word)
            </button>
          )}
          <button type="button" className={chipSecondary} onClick={() => void saveSources()} disabled={savable.length === 0 || saving}
            title={savable.length === 0 ? 'Every accepted, verified source is already in your references' : 'Add the accepted, verified sources to your references'}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : savable.length === 0 ? <Check size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
            {savable.length === 0 ? 'Sources saved' : `Save sources (${savable.length})`}
          </button>
        </div>
        {canContinue && (
          <p className="text-[13px] text-slate-700" data-testid="follow-up-price">
            Keeps your {followUpQuote!.answeredQuestions} answered question{followUpQuote!.answeredQuestions === 1 ? '' : 's'} and their sources, and researches only the rest.
            It holds <strong>{followUpQuote!.followUpCredits} credits</strong> instead of the {followUpQuote!.freshCredits} a fresh run holds; unused credits are returned.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {followUp && <button type="button" className={cls('startNew')} onClick={() => onFollowUp(prefillFrom(session))}>Start new research from this</button>}
          <button type="button" className={cls('download')} onClick={onExport} disabled={exporting}
            title="A JSON file with your questions, accepted and contradicting sources, gaps, search coverage and what was used.">
            {exporting && <Loader2 size={14} className="animate-spin" />} Download evidence package
          </button>
          <button type="button" className={secondary} onClick={() => onFollowUp({ ...prefillFrom(session), unanswered: [] })}>Edit question</button>
          <button type="button" className={secondary} onClick={onNew}>{followUp ? 'Blank new research' : 'New research'}</button>
        </div>
        {followUp && <p className="text-[12px] text-slate-600">Starting from this opens the form with your question filled in, so you can edit it first. It runs as a new session.</p>}

        {result && <QuestionsSection qRows={qRows} questions={questions} numbers={numbers} selectedId={selected?.id ?? null} onSelect={select} />}

        {report && <DeepResearchReportView part="followup" report={report} onOpenSource={openSource} selectedId={selected?.id ?? null}
          onExport={() => onExportReport?.()} exporting={exportingReport} onAsk={q => onFollowUp({ ...prefillFrom(session), question: q, unanswered: [] })} />}

        {result && result.gapCandidates.some(g => g.status === 'GapCandidate') && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <h3 className="mb-1 text-[13px] font-semibold text-amber-900">Possible gaps</h3>
            <p className="mb-1.5 text-[12px] text-amber-900">These are leads based on what this search found — not proof that nothing has been published.</p>
            <ul className="space-y-1 text-[13px] text-amber-900">
              {result.gapCandidates.flatMap((g, i) => g.reasons.map((r, j) => <li key={`${i}-${j}`}>{r}</li>))}
            </ul>
          </section>
        )}

        {result && result.limitations.length > 0 && (
          <section>
            <h3 className="mb-1 text-[13px] font-semibold text-slate-800">Things to keep in mind</h3>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
              {result.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </section>
        )}
      </div>

      {/* ── right: the panel (a bottom sheet on narrow screens) ── */}
      {sheetOpen && <div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={closePanel} aria-hidden="true" />}
      {!sheetOpen && (
        <button type="button" onClick={() => setSheetOpen(true)}
          className="fixed bottom-4 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-4 text-[13px] font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent focus-visible:ring-offset-2 lg:hidden">
          Sources ({groups.length})
        </button>
      )}
      <ResultsPanel
        panelRef={panelRef} sessionId={session.id} view={view} onView={v => { setSelectedRaw(null); setView(v) }}
        filter={filter} onFilter={setFilter} groups={groups} citedIds={citedIds} numbers={numbers}
        questions={questions}
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
