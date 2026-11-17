import type { KeyboardEvent, RefObject } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { DeepResearchCounts, EvidenceQuestion } from '../../api/deepResearch'
import { filterSources, type OutlineItem, type SourceFilterId, type SourceGroup } from '../../lib/deepResearchView'
import { SearchLog, SourceDetail, SourceRow } from './resultsBlocks'

export type PanelView = 'sources' | 'outline' | 'activity'

const TABS: { id: PanelView; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'outline', label: 'Outline' },
  { id: 'activity', label: 'Activity' },
]

interface Props {
  panelRef: RefObject<HTMLElement | null>
  sessionId: string
  view: PanelView
  onView: (v: PanelView) => void
  filter: SourceFilterId
  onFilter: (f: SourceFilterId) => void
  /** Every paper found, one entry per DOI. */
  groups: SourceGroup[]
  /** Ids of the cited sources (from the shared citation index), and their citation numbers. */
  citedIds: Set<string>
  numbers: Map<string, number>
  questions: EvidenceQuestion[]
  /** The server's counts for the filter chips. */
  counts?: DeepResearchCounts | null
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
 * The right-hand panel: Sources (filtered Cited / All / Disagree / Left out), the report Outline, and Activity (the search
 * log). Opening a source, from a row or from a citation marker, replaces the list with its verification card, with a way
 * back. The Questions list lives in the main column.
 */
export function ResultsPanel(p: Props) {
  const { view, selected } = p
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    p.onView(TABS[next].id)
    requestAnimationFrame(() => document.getElementById(`ptab-${TABS[next].id}`)?.focus())
  }

  // Chip numbers are the server's counts; only when an older response has none are they counted from the list.
  const server = p.counts
  const count = (f: SourceFilterId) => filterSources(p.groups, f, p.citedIds).length
  const chips: { id: SourceFilterId; label: string; n: number }[] = [
    { id: 'cited', label: 'Cited', n: server?.cited ?? count('cited') },
    { id: 'contradicts', label: 'Contradicts', n: server?.contradicts ?? count('contradicts') },
    { id: 'noEffect', label: 'No effect', n: server?.noEffect ?? count('noEffect') },
    { id: 'offTopic', label: 'Off-topic', n: server?.offTopic ?? count('offTopic') },
    { id: 'left', label: 'Left out', n: server?.leftOut ?? count('left') },
    { id: 'all', label: 'All', n: server?.found ?? p.groups.length },
  ]
  const listed = filterSources(p.groups, p.filter, p.citedIds)
  const empty: Record<SourceFilterId, string> = {
    cited: 'Nothing is cited yet. Choose All to see every source found.',
    all: 'No sources here yet.',
    contradicts: 'No accepted source contradicts your question.',
    noEffect: 'No accepted source reported finding no effect.',
    offTopic: 'No source was judged off-topic.',
    left: 'Nothing was left out.',
  }
  const note = (g: SourceGroup) => p.filter === 'left'
    ? (g.bucket === 'unassessed' ? 'Not reviewed before the research stopped.' : `Left out${g.exclusionReason ? `: ${g.exclusionReason}` : '.'}`)
    : p.filter === 'offTopic' ? (g.relevanceReason ?? undefined) : undefined

  return (
    <aside id="selected-source-panel" ref={p.panelRef} tabIndex={-1} aria-label="Research panel"
      className={cn('flex flex-col rounded-2xl border border-slate-200 bg-white outline-none lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:min-h-[20rem]',
        p.open ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[78vh] max-lg:rounded-b-none max-lg:shadow-2xl' : 'max-lg:hidden')}>
      <div className="shrink-0 border-b border-slate-200 px-3 pt-3">
        {selected ? (
          <div className="flex items-center justify-between gap-2 pb-3">
            <button type="button" onClick={p.onBack}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-purple-deep hover:bg-purple-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
              <ArrowLeft size={14} aria-hidden="true" /> Back to {TABS.find(t => t.id === view)?.label ?? 'Sources'}
            </button>
            <button type="button" onClick={p.onClose} aria-label="Close the panel" title="Close (Esc)"
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 lg:hidden">
              <X size={14} aria-hidden="true" /> Close
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div role="tablist" aria-label="Research panel" className="flex flex-wrap gap-x-1">
              {TABS.map((t, i) => (
                <button key={t.id} type="button" role="tab" id={`ptab-${t.id}`} aria-selected={view === t.id} aria-controls={`ppanel-${t.id}`} tabIndex={view === t.id ? 0 : -1}
                  onClick={() => p.onView(t.id)} onKeyDown={e => onTabKey(e, i)}
                  className={cn('-mb-px min-h-9 rounded-t border-b-[3px] px-3 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                    view === t.id ? 'border-purple-accent text-purple-deep' : 'border-transparent text-slate-700 hover:text-slate-900')}>
                  {t.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={p.onClose} aria-label="Close the panel" title="Close"
              className="inline-flex h-9 items-center rounded-lg px-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 lg:hidden">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selected ? (
          <SourceDetail source={selected} questions={p.questions} busy={p.busyId === selected.id} added={p.added}
            onAdd={p.onAdd} onUse={p.onUse} onExclude={p.onExclude} onRestore={p.onRestore} />
        ) : (
          <div role="tabpanel" id={`ppanel-${view}`} aria-labelledby={`ptab-${view}`} className="space-y-3">
            {view === 'sources' && (
              <>
                <div role="group" aria-label="Filter sources" className="flex flex-wrap gap-1.5">
                  {chips.map(c => (
                    <button key={c.id} type="button" aria-pressed={p.filter === c.id} onClick={() => p.onFilter(c.id)}
                      className={cn('rounded-full border px-3 py-1 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                        p.filter === c.id ? 'border-purple-accent bg-purple-tint text-purple-deep' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50')}>
                      {c.label} <span className="tabular-nums">{c.n}</span>
                    </button>
                  ))}
                </div>
                {listed.length === 0
                  ? <p className="text-[13px] text-slate-700">{empty[p.filter]}</p>
                  : (
                    <ul className="space-y-2" aria-label="Sources">
                      {listed.map(g => <SourceRow key={g.id} source={g} cite={p.numbers.get(g.id)} note={note(g)} selected={p.selectedId === g.id} onSelect={() => p.onSelect(g.id)} />)}
                    </ul>
                  )}
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

            {view === 'activity' && <SearchLog sessionId={p.sessionId} questions={p.questions} />}
          </div>
        )}
      </div>
    </aside>
  )
}
