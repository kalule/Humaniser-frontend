import { memo } from 'react'
import { AlertTriangle, Check, Circle, Square, X } from 'lucide-react'
import type { ProjectSection } from '../../../types/research'
import type { SectionFlag } from '../../../lib/documentOutline'
import type { DraftAction } from '../../../lib/draftPlan'
import { useLiveDraft } from '../../../lib/liveDraftStore'
import type { ActivityEntry } from './DocumentModeView'

interface Props {
  projectId:    string
  writing:      ProjectSection[]
  flags:        SectionFlag[]
  /** First section waiting for review, if any. */
  nextReview:   ProjectSection | null
  /** The next chapter (or section) to draft, with whether it may be drafted now. */
  draftAction:  DraftAction | null
  /** Sections still waiting in the chapter being drafted. */
  queued:       string[]
  onDraftAction: () => void
  onStop:       (code: string) => void
  stoppingCode: string | null
  targetWords:  number
  activity:     ActivityEntry[]
  lockedNote:   string | null
  onJump:       (code: string) => void
  /** Sections drafted or edited since the last alignment check. */
  staleAlignment: string[]
  isValidating: boolean
  onCheckAlignment: () => void
  /** The opt-in "draft ahead, review later" setting for Chapters 1-3. */
  draftAhead:   boolean
  onToggleDraftAhead: () => void
}

const label = (s: ProjectSection) => `${s.displayCode || s.code} ${s.title}`

function Mark({ state }: { state: ActivityEntry['state'] }) {
  if (state === 'done') return <Check size={13} className="mt-0.5 shrink-0" aria-label="Done" style={{ color: 'var(--color-green)' }} />
  if (state === 'error') return <X size={13} className="mt-0.5 shrink-0" aria-label="Problem" style={{ color: 'var(--color-red)' }} />
  return <Circle size={9} className="dm-pulse mt-1 shrink-0" aria-label="In progress" fill="var(--color-purple)" style={{ color: 'var(--color-purple)' }} />
}

/** The section being drafted: progress, sources read, and what the run is doing. Watches only its own stream. */
function NowDrafting({ projectId, section, targetWords, queued, onJump, onStop, stopping }: {
  projectId: string; section: ProjectSection; targetWords: number; queued: string[]
  onJump: (code: string) => void; onStop: (code: string) => void; stopping: boolean
}) {
  const live = useLiveDraft(projectId, section.code)
  const pct = Math.min(100, Math.round((live.words / Math.max(1, targetWords)) * 100))
  const steps: ActivityEntry[] = [
    ...live.activities.map((a, i) => ({ id: `a${i}`, text: a, state: 'done' as const })),
    { id: 'draft', text: 'Drafting the section', state: live.streamEnded ? 'done' : 'active' },
    ...(live.streamEnded ? [{ id: 'check', text: 'Checking citations and claims', state: 'active' as const }] : []),
  ]
  return (
    <div className="rounded-[10px] p-3.5" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] mb-1" style={{ color: 'var(--text-secondary)' }}>Now drafting</div>
          <button type="button" onClick={() => onJump(section.code)} className="dm-action text-left text-[14px] font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>
            {label(section)}
          </button>
        </div>
        <button type="button" onClick={() => onStop(section.code)} disabled={stopping}
          className="dm-action shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
          style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} aria-label={`Stop drafting ${label(section)}`}>
          <Square size={10} aria-hidden="true" /> {stopping ? 'Stopping…' : 'Stop'}
        </button>
      </div>
      <div className="h-1.5 rounded-full mt-2.5" style={{ background: 'var(--surface-rail)' }}
        role="progressbar" aria-valuemin={0} aria-valuemax={targetWords} aria-valuenow={live.words} aria-label={`${live.words} of about ${targetWords} words`}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'var(--color-purple)', transition: 'width .2s' }} />
      </div>
      <div className="flex justify-between text-[12px] mt-2" style={{ color: 'var(--text-secondary)' }}>
        <span>{live.words.toLocaleString()} of about {targetWords.toLocaleString()} words</span>
        {live.sourcesRead !== null && <span>{live.sourcesRead} source{live.sourcesRead === 1 ? '' : 's'} read</span>}
      </div>
      <ul className="list-none m-0 mt-3 p-0 flex flex-col gap-1.5 text-[12px] leading-[1.4]" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
        {steps.map(step => <li key={step.id} className="flex gap-2"><Mark state={step.state} />{step.text}</li>)}
      </ul>
      {queued.length > 0 && (
        <p className="m-0 mt-2.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>Then: {queued.join(', ')}</p>
      )}
    </div>
  )
}

function DocumentAgentPanelImpl({
  projectId, writing, flags, nextReview, draftAction, queued, onDraftAction, onStop, stoppingCode, targetWords,
  activity, lockedNote, onJump, staleAlignment, isValidating, onCheckAlignment, draftAhead, onToggleDraftAhead,
}: Props) {
  const bySection = new Map<string, number>()
  for (const f of flags) bySection.set(f.sectionCode, (bySection.get(f.sectionCode) ?? 0) + 1)
  const busy = writing.length > 0 || queued.length > 0

  return (
    <aside aria-label="Agent" className="h-full flex flex-col gap-4 p-[18px] overflow-y-auto dm-scroll">
      <h2 className="m-0 text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Agent</h2>

      {writing.length > 0 ? writing.map(s => (
        <NowDrafting key={s.code} projectId={projectId} section={s} targetWords={targetWords} queued={queued}
          onJump={onJump} onStop={onStop} stopping={stoppingCode === s.code} />
      )) : (
        <p className="m-0 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Nothing is being drafted right now.</p>
      )}

      {activity.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.08em] mb-2" style={{ color: 'var(--text-secondary)' }}>ACTIVITY</div>
          <ul className="list-none m-0 p-0 flex flex-col gap-2 text-[13px] leading-[1.4]" style={{ color: 'var(--text-secondary)' }}>
            {activity.map(a => <li key={a.id} className="flex gap-2"><Mark state={a.state === 'active' ? 'done' : a.state} />{a.text}</li>)}
          </ul>
        </div>
      )}

      {staleAlignment.length > 0 && (
        <div className="rounded-[10px] px-3.5 py-3 flex flex-col gap-2" style={{ border: '0.5px solid var(--border-strong)' }}>
          <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>
            Alignment has not been checked since {staleAlignment.join(', ')} {staleAlignment.length === 1 ? 'was' : 'were'} drafted or edited.
          </p>
          <button type="button" onClick={onCheckAlignment} disabled={isValidating}
            className="dm-action self-start rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            {isValidating ? 'Checking…' : 'Check alignment'}
          </button>
        </div>
      )}

      {flags.length > 0 && (
        <div className="rounded-[10px] px-3.5 py-3" style={{ background: 'var(--color-amber-tint)', border: '1px solid var(--color-amber)' }}>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5" style={{ color: 'var(--color-amber-text)' }}>
            <AlertTriangle size={13} aria-hidden="true" /> {flags.length} open flag{flags.length === 1 ? '' : 's'}
          </div>
          <ul className="list-none m-0 p-0 flex flex-col gap-1">
            {[...bySection.entries()].slice(0, 6).map(([code, count]) => (
              <li key={code}>
                <button type="button" onClick={() => onJump(code)} className="dm-action text-left text-[12px] hover:underline" style={{ color: 'var(--color-amber-text)' }}>
                  {code}: {count} flag{count === 1 ? '' : 's'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto rounded-[10px] p-3.5 flex flex-col gap-2.5" style={{ border: '0.5px solid var(--border-strong)' }}>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Up next</div>
        {nextReview && (
          <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>
            Review <button type="button" onClick={() => onJump(nextReview.code)} className="dm-action font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>{label(nextReview)}</button> and approve it, or rewrite it.
          </p>
        )}
        {draftAction ? (
          <>
            {!draftAction.decision.allowed && (
              <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>{draftAction.decision.reason}</p>
            )}
            <button type="button" disabled={!draftAction.decision.allowed || busy} onClick={onDraftAction}
              className="dm-action rounded-lg px-3.5 py-2 text-[13px] font-semibold text-left disabled:cursor-not-allowed"
              style={draftAction.decision.allowed && !busy ? { background: 'var(--color-purple)', color: 'white' } : { background: 'var(--surface-rail)', color: 'var(--text-secondary)' }}>
              {draftAction.label}
              {!draftAction.decision.allowed && <span className="sr-only"> (unavailable: {draftAction.decision.reason})</span>}
              {draftAction.decision.allowed && busy && <span className="sr-only"> (available when the current draft finishes)</span>}
            </button>
            {draftAction.decision.allowed && draftAction.codes.length > 1 && (
              <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>Each finished section stops at Needs review.</p>
            )}
          </>
        ) : !nextReview && (
          <p className="m-0 text-[12px]" style={{ color: 'var(--text-secondary)' }}>Every available section is drafted.</p>
        )}
        {lockedNote && <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>{lockedNote}</p>}
        <div className="flex items-start gap-2.5 pt-2.5" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
          <button type="button" role="switch" aria-checked={draftAhead} onClick={onToggleDraftAhead}
            aria-describedby="draft-ahead-help"
            className="dm-action shrink-0 mt-0.5 relative w-8 h-[18px] rounded-full transition-colors"
            style={{ background: draftAhead ? 'var(--color-purple)' : 'var(--border-strong)' }}>
            <span className="sr-only">Draft ahead, review later</span>
            <span aria-hidden="true" className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all" style={{ left: draftAhead ? 16 : 2 }} />
          </button>
          <div>
            <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Draft ahead, review later {draftAhead ? '· On' : '· Off'}</div>
            <p id="draft-ahead-help" className="m-0 text-[11px] leading-[1.45]" style={{ color: 'var(--text-muted)' }}>
              Chapters 1 to 3 draft without waiting for approval. Chapter 4 onward and Results always wait.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export const DocumentAgentPanel = memo(DocumentAgentPanelImpl)
