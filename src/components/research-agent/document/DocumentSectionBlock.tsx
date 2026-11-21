import { memo, useEffect, useRef, type RefObject } from 'react'
import { AlertTriangle, ExternalLink, Loader2, Lock } from 'lucide-react'
import type { ProjectSection } from '../../../types/research'
import type { DocumentSectionStatus, DraftDecision } from '../../../lib/sectionWorkflow'
import type { SectionFlag } from '../../../lib/documentOutline'
import { SECTION_PROMPTS } from '../../../data/proposalOutline'
import { stripTrailingReferences } from '../../../lib/wordCount'
import { useNearViewport } from '../../../hooks/useNearViewport'
import { ProposalMarkdown } from '../ProposalMarkdown'
import { SectionStatusChip } from './SectionStatusMark'

export interface DocumentSectionBlockProps {
  section:       ProjectSection
  status:        DocumentSectionStatus
  flags:         SectionFlag[]
  draft:         DraftDecision
  /** Why this section is locked, when status is locked. */
  lockedReason:  string | null
  isApproving:   boolean
  scrollRoot:    RefObject<HTMLElement | null>
  registerAnchor: (code: string, el: HTMLElement | null) => void
  onApprove:     (code: string) => void
  onRewrite:     (code: string) => void
  onOpenGuided:  (code: string) => void
}

const FLAG_LABEL: Record<SectionFlag['kind'], string> = {
  alignment:   'Alignment',
  citation:    'Citation',
  interrupted: 'Interrupted',
}

/** Rough height of an unmounted body, so the scrollbar does not jump before it is measured. */
const estimateHeight = (words: number) => Math.max(72, Math.round(words / 11) * 26)

const actionClass = 'dm-action rounded-lg text-[13px] px-4 py-2 transition-colors disabled:cursor-not-allowed'

function DocumentSectionBlockImpl({
  section, status, flags, draft, lockedReason, isApproving, scrollRoot, registerAnchor,
  onApprove, onRewrite, onOpenGuided,
}: DocumentSectionBlockProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const measured = useRef<number | null>(null)
  const near = useNearViewport(bodyRef, scrollRoot)
  const label = `${section.displayCode || section.code} ${section.title}`
  const headingId = `doc-heading-${section.code}`
  const hasBody = status === 'needs_review' || status === 'approved'

  // Remember the real height while mounted so the placeholder keeps the same size off-screen.
  useEffect(() => {
    const el = bodyRef.current
    if (!el || !near || !hasBody || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { measured.current = el.offsetHeight })
    observer.observe(el)
    return () => observer.disconnect()
  }, [near, hasBody])

  const review = status === 'needs_review'
  const blockedRewrite = !draft.allowed

  return (
    <section
      aria-labelledby={headingId}
      ref={el => registerAnchor(section.code, el)}
      data-section-code={section.code}
      className={review ? 'rounded-[10px] -mx-3 sm:-mx-5 px-3 sm:px-5 pt-3.5 pb-4 my-3' : 'py-2 my-1'}
      style={review ? { background: 'color-mix(in srgb, var(--color-amber-tint) 40%, white)', border: '1px solid var(--color-amber)' } : undefined}
    >
      <div className="flex items-center gap-2.5 flex-wrap mb-2">
        <h3 id={headingId} tabIndex={-1} className="dm-heading m-0 text-[18px] font-semibold" style={{ fontFamily: 'Georgia, serif', color: 'var(--text-primary)' }}>
          {label}
        </h3>
        <SectionStatusChip status={status} detail={status === 'writing' && section.wordCount > 0 ? `${section.wordCount} words` : undefined} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onOpenGuided(section.code)}
          className="dm-action inline-flex items-center gap-1 text-[12px] rounded-md px-2 py-1 hover:bg-white/60"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={`Open ${label} in Guided`}
        >
          <ExternalLink size={12} aria-hidden="true" /> Open in Guided
        </button>
      </div>

      <div ref={bodyRef}>
        {status === 'locked' && (
          <p className="flex items-start gap-2 text-[13px] m-0" style={{ color: 'var(--text-secondary)' }}>
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {lockedReason}
          </p>
        )}

        {status === 'queued' && (
          <div className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <p className="m-0 italic" style={{ fontFamily: 'Georgia, serif' }}>{SECTION_PROMPTS[section.code]?.prompt ?? 'Not drafted yet.'}</p>
            {!draft.allowed && draft.reason && <p className="m-0 mt-1.5 text-[12px]">{draft.reason}</p>}
          </div>
        )}

        {status === 'writing' && (
          <div aria-live="polite">
            <p className="flex items-center gap-1.5 text-[12px] m-0 mb-3" style={{ color: 'var(--color-purple-text)' }}>
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> The agent is writing this section. It opens for review when the draft is finished.
            </p>
            <div className="skeleton-lines" aria-hidden="true">
              <div className="skeleton-line" /><div className="skeleton-line" style={{ width: '92%' }} /><div className="skeleton-line" style={{ width: '64%' }} />
            </div>
          </div>
        )}

        {hasBody && (near
          ? <div className="dm-prose"><ProposalMarkdown content={stripTrailingReferences(section.content)} /></div>
          : <div aria-hidden="true" style={{ height: measured.current ?? estimateHeight(section.wordCount) }} />)}
      </div>

      {hasBody && flags.length > 0 && (
        <ul className="list-none m-0 p-0 mt-3 flex flex-col gap-1.5" aria-label={`${flags.length} flag${flags.length === 1 ? '' : 's'} on ${label}`}>
          {flags.map(flag => (
            <li key={flag.id} className="flex items-start gap-2 text-[13px] leading-[1.45] rounded-lg px-3 py-2 bg-white"
              style={{ border: '1px solid var(--color-amber)', color: 'var(--color-amber-text)' }}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span><b className="font-semibold">{FLAG_LABEL[flag.kind]}:</b> {flag.message}</span>
            </li>
          ))}
        </ul>
      )}

      {review && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onApprove(section.code)} disabled={isApproving}
              className={`${actionClass} font-semibold text-white disabled:opacity-60`} style={{ background: 'var(--color-purple)' }}>
              {isApproving ? 'Approving…' : 'Approve'}
            </button>
            <button type="button" onClick={() => onRewrite(section.code)} disabled={blockedRewrite}
              title={draft.reason ?? undefined}
              className={`${actionClass} bg-white hover:bg-slate-50 disabled:opacity-60`}
              style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
              Rewrite
            </button>
            {flags.length > 0 && (
              <button type="button" onClick={() => onOpenGuided(section.code)}
                className={`${actionClass} bg-white hover:bg-slate-50`}
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                Resolve flags
              </button>
            )}
          </div>
          {blockedRewrite && draft.reason && draft.blocker !== 'writing' && (
            <p className="m-0 mt-2 text-[12px]" style={{ color: 'var(--color-amber-text)' }}>Rewrite unavailable: {draft.reason}</p>
          )}
        </div>
      )}
    </section>
  )
}

const flagsKey = (flags: SectionFlag[]) => flags.map(f => `${f.id}:${f.message}`).join('|')

/**
 * Re-renders only when something this section shows has changed, so a poll that replaces every
 * section object, or activity in another section, does not re-render the whole thesis.
 */
export const DocumentSectionBlock = memo(DocumentSectionBlockImpl, (a, b) =>
  a.status === b.status
  && a.isApproving === b.isApproving
  && a.lockedReason === b.lockedReason
  && a.draft.allowed === b.draft.allowed && a.draft.reason === b.draft.reason
  && a.section.content === b.section.content
  && a.section.title === b.section.title
  && a.section.displayCode === b.section.displayCode
  && a.section.wordCount === b.section.wordCount
  && flagsKey(a.flags) === flagsKey(b.flags)
  && a.onApprove === b.onApprove && a.onRewrite === b.onRewrite && a.onOpenGuided === b.onOpenGuided
  && a.registerAnchor === b.registerAnchor && a.scrollRoot === b.scrollRoot)
