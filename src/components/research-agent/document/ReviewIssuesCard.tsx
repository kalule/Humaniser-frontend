import { memo } from 'react'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { REVIEW_KIND_LABEL, type ReviewIssue } from '../../../lib/documentReview'

interface Props {
  /** Null until Review has run in this session. */
  issues:    ReviewIssue[] | null
  running:   boolean
  /** Sections changed since the last Review: the list may be out of date. */
  outdated:  boolean
  onRun:     () => void
  onOpen:    (issue: ReviewIssue) => void
  sectionLabel: (code: string) => string
}

/**
 * The whole-document review (placeholders, study-decision mismatches, variable conflicts), each issue
 * one click from its text. Shown inside the agent panel's Next step card once every section is
 * drafted, so it has no frame of its own. Its Run button is primary only while there is no current
 * result; afterwards the issues themselves are the actions.
 */
function ReviewIssuesCardImpl({ issues, running, outdated, onRun, onOpen, sectionLabel }: Props) {
  const open = issues?.filter(i => i.blocking) ?? []
  const advisory = issues?.filter(i => !i.blocking) ?? []
  const needsRun = issues === null || outdated
  return (
    <div aria-label="Review" role="group" className="flex flex-col gap-2">
      <div className="flex items-start gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        <ClipboardCheck size={13} className="mt-0.5" aria-hidden="true" style={{ color: 'var(--color-purple-text)' }} />
        <span>{issues === null ? 'Every section is drafted. Run the review' : open.length === 0 ? 'Review found no open issues' : `Review found ${open.length} open issue${open.length === 1 ? '' : 's'}`}</span>
      </div>
      <p className="m-0 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
        {issues === null ? 'Checks placeholders, study decisions and variables across the whole proposal'
          : outdated ? 'The text changed since, so run it again'
          : open.length ? 'Open each one to see it in the text' : 'Approve the sections still waiting, then export'}
      </p>
      <button type="button" onClick={onRun} disabled={running}
        className="dm-action self-start inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
        style={needsRun ? { background: 'var(--color-purple)', color: 'white' } : { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
        {running && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
        {running ? 'Reviewing…' : issues === null ? 'Run review' : 'Run again'}
      </button>
      {issues !== null && [...open, ...advisory].length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-1 max-h-[320px] overflow-y-auto dm-scroll">
          {[...open, ...advisory].map(issue => (
            <li key={issue.id}>
              <button type="button" onClick={() => onOpen(issue)}
                className="dm-action w-full text-left rounded-md px-2 py-1.5 text-[12px] leading-[1.4] hover:bg-slate-50 flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold rounded-full px-1.5 py-px"
                    style={issue.blocking ? { background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' } : { background: 'var(--surface-rail)', color: 'var(--text-secondary)' }}>
                    {REVIEW_KIND_LABEL[issue.kind]}{issue.blocking ? '' : ' · advisory'}
                  </span>
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>{sectionLabel(issue.sectionCode)}</span>
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{issue.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const ReviewIssuesCard = memo(ReviewIssuesCardImpl)
