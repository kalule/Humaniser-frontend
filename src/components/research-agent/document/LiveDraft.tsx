import { Loader2, Lock } from 'lucide-react'
import { useLiveDraft } from '../../../lib/liveDraftStore'
import { stripTrailingReferences } from '../../../lib/wordCount'
import { ProposalMarkdown } from '../ProposalMarkdown'
import { SectionStatusChip } from './SectionStatusMark'

/** "Writing · 312 words" — re-renders with its own section's stream only. */
export function WritingChip({ projectId, code }: { projectId: string; code: string }) {
  const live = useLiveDraft(projectId, code)
  return <SectionStatusChip status="writing" detail={live.words > 0 ? `${live.words.toLocaleString()} words` : undefined} />
}

/**
 * The body of a section being written: streamed text in place, a cursor, and skeleton lines for
 * what is still to come. Read-only — the section is held by its run until it finishes or stops.
 */
export function LiveDraftBody({ projectId, code }: { projectId: string; code: string }) {
  const live = useLiveDraft(projectId, code)
  const checking = live.streamEnded
  const note = checking
    ? 'Checking citations and claims. The section opens for review when this finishes.'
    : live.text ? 'The agent is writing this section.' : 'The agent is reading sources for this section.'
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12px] m-0 mb-3" style={{ color: 'var(--color-purple-text)' }} aria-live="polite">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> {note}
        <span className="inline-flex items-center gap-1 ml-auto" style={{ color: 'var(--text-muted)' }}>
          <Lock size={11} aria-hidden="true" /> Read-only while writing
        </span>
      </p>
      {live.text && (
        <div className="dm-prose dm-streaming">
          <ProposalMarkdown content={stripTrailingReferences(live.text)} />
        </div>
      )}
      {!checking && (
        <div className="skeleton-lines" aria-hidden="true">
          <div className="skeleton-line" /><div className="skeleton-line" style={{ width: '92%' }} /><div className="skeleton-line" style={{ width: '64%' }} />
        </div>
      )}
    </div>
  )
}
