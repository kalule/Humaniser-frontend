import { memo } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ProjectSection } from '../../../types/research'
import type { SectionFlag } from '../../../lib/documentOutline'
import type { DraftDecision } from '../../../lib/sectionWorkflow'

interface Props {
  writing:      ProjectSection[]
  flags:        SectionFlag[]
  /** First section waiting for review, if any. */
  nextReview:   ProjectSection | null
  /** First section not drafted yet, with whether it may be drafted now. */
  nextDraft:    { section: ProjectSection; decision: DraftDecision } | null
  lockedNote:   string | null
  onJump:       (code: string) => void
  onDraftInGuided: (code: string) => void
  /** Sections edited materially since the last alignment check. */
  staleAlignment: string[]
  isValidating: boolean
  onCheckAlignment: () => void
}

const label = (s: ProjectSection) => `${s.displayCode || s.code} ${s.title}`

function DocumentAgentPanelImpl({ writing, flags, nextReview, nextDraft, lockedNote, onJump, onDraftInGuided, staleAlignment, isValidating, onCheckAlignment }: Props) {
  const bySection = new Map<string, number>()
  for (const f of flags) bySection.set(f.sectionCode, (bySection.get(f.sectionCode) ?? 0) + 1)

  return (
    <aside aria-label="Agent" className="h-full flex flex-col gap-4 p-[18px] overflow-y-auto dm-scroll">
      <h2 className="m-0 text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Agent</h2>

      {writing.length > 0 ? (
        <div className="rounded-[10px] p-3.5" style={{ border: '0.5px solid var(--border-strong)' }} aria-live="polite">
          <div className="text-[12px] mb-1" style={{ color: 'var(--text-secondary)' }}>Now drafting</div>
          {writing.map(s => (
            <button key={s.code} type="button" onClick={() => onJump(s.code)}
              className="dm-action flex items-center gap-2 text-left text-[14px] font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>
              <Loader2 size={13} className="animate-spin shrink-0" aria-hidden="true" style={{ color: 'var(--color-purple)' }} /> {label(s)}
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Nothing is being drafted right now.</p>
      )}

      {staleAlignment.length > 0 && (
        <div className="rounded-[10px] px-3.5 py-3 flex flex-col gap-2" style={{ border: '0.5px solid var(--border-strong)' }}>
          <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>
            Alignment has not been re-checked since you edited {staleAlignment.join(', ')}.
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
        {nextDraft ? (
          <>
            <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>
              {nextDraft.decision.allowed ? `${label(nextDraft.section)} is ready to draft.` : nextDraft.decision.reason}
            </p>
            <button type="button" disabled={!nextDraft.decision.allowed} onClick={() => onDraftInGuided(nextDraft.section.code)}
              className="dm-action rounded-lg px-3.5 py-2 text-[13px] font-semibold text-left disabled:cursor-not-allowed"
              style={nextDraft.decision.allowed ? { background: 'var(--color-purple)', color: 'white' } : { background: 'var(--surface-rail)', color: 'var(--text-secondary)' }}>
              Draft {nextDraft.section.displayCode || nextDraft.section.code} in Guided
              {!nextDraft.decision.allowed && <span className="sr-only"> (unavailable: {nextDraft.decision.reason})</span>}
            </button>
          </>
        ) : !nextReview && (
          <p className="m-0 text-[12px]" style={{ color: 'var(--text-secondary)' }}>Every available section is drafted.</p>
        )}
        {lockedNote && <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>{lockedNote}</p>}
      </div>
    </aside>
  )
}

export const DocumentAgentPanel = memo(DocumentAgentPanelImpl)
