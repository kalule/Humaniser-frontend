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

/** "Review": placeholders, study-decision mismatches and variable conflicts, each one click from its text. */
function ReviewIssuesCardImpl({ issues, running, outdated, onRun, onOpen, sectionLabel }: Props) {
  const open = issues?.filter(i => i.blocking) ?? []
  const advisory = issues?.filter(i => !i.blocking) ?? []
  return (
    <section aria-label="Review" className="rounded-[10px] p-3.5 flex flex-col gap-2" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            <ClipboardCheck size={13} aria-hidden="true" style={{ color: 'var(--color-purple-text)' }} /> Review
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }} aria-live="polite">
            {issues === null ? 'Placeholders, study decisions, variables'
              : open.length === 0 ? 'No open issues'
              : `${open.length} open issue${open.length === 1 ? '' : 's'}`}
            {issues !== null && outdated && ' · text changed since'}
          </div>
        </div>
        <button type="button" onClick={onRun} disabled={running}
          className="dm-action shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-60"
          style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
          {running && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
          {running ? 'Reviewing…' : issues === null ? 'Run review' : 'Run again'}
        </button>
      </div>
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
    </section>
  )
}

export const ReviewIssuesCard = memo(ReviewIssuesCardImpl)
