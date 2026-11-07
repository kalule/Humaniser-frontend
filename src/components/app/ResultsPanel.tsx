import type { KeyboardEvent, RefObject } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { EvidenceQuestion } from '../../api/deepResearch'
import {
  filterSources, questionAnchor, rateQuestion, type OutlineItem, type QuestionRow, type SourceFilterId, type SourceGroup,
} from '../../lib/deepResearchView'
import { HintChip, SearchLog, SourceDetail, SourceRow, prettyType } from './resultsBlocks'

export type PanelView = 'sources' | 'outline' | 'against' | 'activity' | 'questions' | 'left'

const MAIN_TABS: PanelView[] = ['sources', 'outline', 'against', 'activity']

interface Props {
  panelRef: RefObject<HTMLElement | null>
  sessionId: string
  view: PanelView
  onView: (v: PanelView) => void
  filter: SourceFilterId
  onFilter: (f: SourceFilterId) => void
  /** Every paper found, one entry per DOI. */
  groups: SourceGroup[]
  citedIds: Set<string>
  /** Source id → the number shown on its citation marker in the report. */
  numbers: Map<string, number>
  against: SourceGroup[]
  leftOut: SourceGroup[]
  qRows: QuestionRow[]
  questions: EvidenceQuestion[]
  outline: OutlineItem[]
  currentSectionId: string | null
  onJump: (id: string) => void
  selected: SourceGroup | null
  selectedId: string | null
  onSelect: (id: string) => void
  onBack: () => void
  busyId: string | null
  added: boolean
  onAdd: () => void
  onUse: () => void
  onExclude: () => void
  onRestore: () => void
  /** The bottom sheet on a narrow screen; from lg up the panel is always on the page. */
  open: boolean
  onClose: () => void
}

/**
 * The right-hand panel: Sources, Outline, Evidence against and Activity, with the earlier Questions and Left out lists one
 * click away. Opening a source (from a row or a citation marker) replaces the list with its verification card, with a
 * way back. Nothing the page used to show is removed; it moved here.
 */
export function ResultsPanel(p: Props) {
  const { view, selected } = p
  const label = (v: PanelView) => ({
    sources: `Sources`, outline: 'Outline', against: `Evidence against (${p.against.length})`, activity: 'Activity',
    questions: `Questions (${p.questions.length})`, left: `Left out (${p.leftOut.length})`,
  }[v])

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = e.key === 'ArrowRight' ? (i + 1) % MAIN_TABS.length : e.key === 'ArrowLeft' ? (i - 1 + MAIN_TABS.length) % MAIN_TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? MAIN_TABS.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    p.onView(MAIN_TABS[next])
    requestAnimationFrame(() => document.getElementById(`ptab-${MAIN_TABS[next]}`)?.focus())
  }

  const cited = filterSources(p.groups, 'cited', p.citedIds)
  const chips: { id: SourceFilterId; label: string }[] = [
    { id: 'cited', label: `Cited ${cited.length}` },
    { id: 'all', label: `All ${p.groups.length}` },
    { id: 'disagree', label: `Disagree ${p.against.length}` },
  ]
  const listed = filterSources(p.groups, p.filter, p.citedIds)
  const row = (g: SourceGroup, questionId?: string) => (
    <SourceRow key={g.id} source={g} questionId={questionId} cite={p.numbers.get(g.id)} selected={p.selectedId === g.id} onSelect={() => p.onSelect(g.id)} />
  )
  const researched = p.qRows.filter(r => r.state !== 'not-searched')
  const planned = p.qRows.filter(r => r.state === 'not-searched')
  const numberOf = (r: QuestionRow) => p.questions.findIndex(q => q.id === r.question.id) + 1

  return (
    <aside id="selected-source-panel" ref={p.panelRef} tabIndex={-1} aria-label="Research panel"
      className={cn('flex flex-col rounded-2xl border border-slate-200 bg-white outline-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]',
        p.open ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[78vh] max-lg:rounded-b-none max-lg:shadow-2xl' : 'max-lg:hidden')}>
      <div className="shrink-0 border-b border-slate-200 px-3 pt-3">
        {selected ? (
          <div className="flex items-center justify-between gap-2 pb-3">
            <button type="button" onClick={p.onBack}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-purple-deep hover:bg-purple-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
              <ArrowLeft size={14} aria-hidden="true" /> Back to {view === 'questions' || view === 'left' || view === 'against' || view === 'outline' || view === 'activity' ? label(view).replace(/ \(\d+\)$/, '') : 'Sources'}
            </button>
            <button type="button" onClick={p.onClose} aria-label="Close the panel" title="Close (Esc)"
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 lg:hidden">
              <X size={14} aria-hidden="true" /> Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div role="tablist" aria-label="Research panel" className="flex flex-wrap gap-x-1">
                {MAIN_TABS.map((t, i) => (
                  <button key={t} type="button" role="tab" id={`ptab-${t}`} aria-selected={view === t} aria-controls={`ppanel-${t}`} tabIndex={view === t || (!MAIN_TABS.includes(view) && i === 0) ? 0 : -1}
                    onClick={() => p.onView(t)} onKeyDown={e => onTabKey(e, i)}
                    className={cn('-mb-px min-h-9 rounded-t border-b-[3px] px-2.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                      view === t ? 'border-purple-accent text-purple-deep' : 'border-transparent text-slate-700 hover:text-slate-900')}>
                    {label(t)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={p.onClose} aria-label="Close the panel" title="Close"
                className="inline-flex h-9 items-center rounded-lg px-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 lg:hidden">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1 pb-2 pt-1 text-[12px] text-slate-700">
              <span>Also:</span>
              {(['questions', 'left'] as const).filter(v => v !== 'left' || p.leftOut.length > 0).map(v => (
                <button key={v} type="button" id={`ptab-${v}`} aria-pressed={view === v} onClick={() => p.onView(v)}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                    view === v ? 'border-purple-accent bg-purple-tint text-purple-deep' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50')}>
                  {label(v)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selected ? (
          <SourceDetail source={selected} questions={p.questions} busy={p.busyId === selected.id} added={p.added}
            onAdd={p.onAdd} onUse={p.onUse} onExclude={p.onExclude} onRestore={p.onRestore} />
        ) : (
          <div role={MAIN_TABS.includes(view) ? 'tabpanel' : 'region'} id={`ppanel-${view}`} aria-labelledby={`ptab-${view}`} className="space-y-3">
            {view === 'sources' && (
              <>
                <div role="group" aria-label="Filter sources" className="flex flex-wrap gap-1.5">
                  {chips.map(c => (
                    <button key={c.id} type="button" aria-pressed={p.filter === c.id} onClick={() => p.onFilter(c.id)}
                      className={cn('rounded-full border px-3 py-1 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                        p.filter === c.id ? 'border-purple-accent bg-purple-tint text-purple-deep' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50')}>
                      {c.label}
                    </button>
                  ))}
                </div>
                {listed.length === 0
                  ? <p className="text-[13px] text-slate-700">{p.filter === 'disagree' ? 'No accepted source disagreed with your question or found no effect.' : 'No sources here yet.'}</p>
                  : <ul className="space-y-2" aria-label="Sources">{listed.map(g => row(g))}</ul>}
                <p className="text-[12px] text-slate-600">Choose a source, or a citation in the report, to see its DOI, record checks and supporting quote.</p>
              </>
            )}

            {view === 'outline' && (
              p.outline.length === 0
                ? <p className="text-[13px] text-slate-700">The report has no sections to jump to yet.</p>
                : (
                  <nav aria-label="Report outline">
                    <ol className="space-y-0.5">
                      {p.outline.map(o => (
                        <li key={o.id}>
                          <button type="button" onClick={() => p.onJump(o.id)} aria-current={p.currentSectionId === o.id ? 'location' : undefined}
                            className={cn('w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                              o.level === 2 && 'pl-6',
                              p.currentSectionId === o.id ? 'bg-purple-tint font-semibold text-purple-deep' : 'text-slate-800 hover:bg-slate-100')}>
                            {o.label}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )
            )}

            {view === 'against' && (
              p.against.length === 0
                ? <p className="text-[13px] text-slate-700">No accepted source disagreed with your question or found no effect.</p>
                : <ul className="space-y-2" aria-label="Evidence against">{p.against.map(g => row(g))}</ul>
            )}

            {view === 'activity' && <SearchLog sessionId={p.sessionId} questions={p.questions} />}

            {view === 'questions' && (
              <>
                {researched.map(r => {
                  const rating = rateQuestion(r)
                  return (
                    <section key={r.question.id} id={questionAnchor(r.question.id)} tabIndex={-1} aria-label={`Question ${numberOf(r)}`}
                      className="scroll-mt-2 rounded-2xl border border-slate-200 bg-white p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[12px] font-semibold tracking-wide text-purple-deep">QUESTION {numberOf(r)} · {prettyType(r.question.type)}</p>
                        <span className="shrink-0"><HintChip label={rating.label} hint={rating.reason} tone={rating.tone} /></span>
                      </div>
                      <h4 className="mt-1 text-[14px] font-semibold text-slate-900">{r.question.question}</h4>
                      <p className="mt-0.5 text-[12px] tabular-nums text-slate-600">{r.used.length} source{r.used.length === 1 ? '' : 's'} accepted{rating.cap ? ` · ${rating.cap}` : ''}</p>
                      {r.question.reasons.length > 0 && r.state !== 'supported' && (
                        <ul className="mt-2 list-disc pl-4 text-[12px] text-slate-600">{r.question.reasons.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ul>
                      )}
                      {r.used.length === 0
                        ? <p className="mt-3 text-[12px] text-slate-600">No source has been accepted for this question.</p>
                        : <ul className="mt-3 space-y-2">{r.used.map(g => row(g, r.question.id))}</ul>}
                    </section>
                  )
                })}
                {planned.length > 0 && (
                  <section className="rounded-2xl border border-dashed border-purple-200 bg-purple-tint/50 p-3.5">
                    <h4 className="mb-1 text-[14px] font-semibold text-slate-900">{planned.length} question{planned.length === 1 ? '' : 's'} still to research</h4>
                    <ul>
                      {planned.map(r => (
                        <li key={r.question.id} id={questionAnchor(r.question.id)} tabIndex={-1} className="scroll-mt-2 border-t border-purple-100 py-2 outline-none first:border-t-0">
                          <span className="text-[13px] text-slate-800">
                            <span className="font-semibold">Question {numberOf(r)}</span>{' '}
                            <span className="ml-1 rounded-full border border-purple-200 bg-white px-2 py-0.5 text-[12px] text-purple-deep">{r.question.type}</span>
                            <span className="mt-0.5 block text-[12px] text-slate-600">{r.question.question}</span>
                          </span>
                          <span className="text-[12px] text-slate-600">Planned, not yet researched</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {researched.length === 0 && planned.length === 0 && <p className="text-[13px] text-slate-700">No questions were planned for this session.</p>}
              </>
            )}

            {view === 'left' && (
              <ul className="space-y-2" aria-label="Left out">
                {p.leftOut.map(g => (
                  <li key={g.id}>
                    <button type="button" aria-pressed={p.selectedId === g.id} onClick={() => p.onSelect(g.id)}
                      className={cn('w-full rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                        p.selectedId === g.id ? 'border-purple-accent bg-purple-tint' : 'border-slate-200 bg-slate-50 hover:border-slate-300')}>
                      <span className="block text-[13px] font-medium text-slate-700">{g.title}</span>
                      <span className="mt-0.5 block text-[12px] text-slate-600">{g.year ?? 'n.d.'}{g.journal ? ` · ${g.journal}` : ''}</span>
                      <span className="mt-1 block text-[12px] text-slate-600">
                        {g.bucket === 'unassessed' ? 'Not reviewed before the research stopped.' : `Left out${g.exclusionReason ? `: ${g.exclusionReason}` : '.'}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
