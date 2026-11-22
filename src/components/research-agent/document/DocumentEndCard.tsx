import { memo } from 'react'
import { ArrowUp, CheckCircle2, Download } from 'lucide-react'
import type { ProjectSection } from '../../../types/research'
import type { FlagGroup } from './DocumentAgentPanel'

interface Props {
  progress:    { approved: number; total: number }
  flagGroups:  FlagGroup[]
  nextReview:  ProjectSection | null
  isExporting: boolean
  onJump:      (key: string) => void
  onNextFlag:  () => void
  onExport:    () => void
  onTop:       () => void
}

/**
 * The bottom of the document: where the student stands and the one thing to do next. Without it
 * the page just ran out after the last section, with no way forward but scrolling back up.
 */
function DocumentEndCardImpl({ progress, flagGroups, nextReview, isExporting, onJump, onNextFlag, onExport, onTop }: Props) {
  const flagTotal = flagGroups.reduce((n, g) => n + g.count, 0)
  const allApproved = progress.total > 0 && progress.approved === progress.total
  const primary = nextReview
    ? { text: `Review ${nextReview.displayCode || nextReview.code} ${nextReview.title}`, run: () => onJump(nextReview.code) }
    : flagTotal > 0
      ? { text: 'Go to the next flag', run: onNextFlag }
      : null

  const summary = [
    `${progress.approved} of ${progress.total} sections approved`,
    ...(flagTotal > 0 ? [`${flagTotal} thing${flagTotal === 1 ? '' : 's'} to check`] : []),
  ].join(' · ')

  return (
    <section aria-label="End of document"
      className="mt-10 pt-6 flex flex-col gap-4" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
      <div className="flex items-start gap-3">
        {allApproved && flagTotal === 0 && <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: 'var(--color-green)' }} />}
        <div>
          <h2 className="m-0 text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {allApproved && flagTotal === 0 ? 'Ready to export' : 'End of document'}
          </h2>
          <p className="m-0 mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>{summary}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {primary && (
          <button type="button" onClick={primary.run}
            className="dm-action rounded-lg px-4 py-2 text-[13px] font-semibold max-w-full truncate"
            style={{ background: 'var(--color-purple)', color: 'white' }}>
            {primary.text}
          </button>
        )}
        <button type="button" onClick={onExport} disabled={isExporting}
          className="dm-action inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
          style={primary ? { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' } : { background: 'var(--color-purple)', color: 'white' }}>
          <Download size={13} aria-hidden="true" /> {isExporting ? 'Exporting…' : 'Export .docx'}
        </button>
        <button type="button" onClick={onTop}
          className="dm-action inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] hover:bg-slate-50" style={{ color: 'var(--text-secondary)' }}>
          <ArrowUp size={13} aria-hidden="true" /> Back to top
        </button>
      </div>
    </section>
  )
}

export const DocumentEndCard = memo(DocumentEndCardImpl)
