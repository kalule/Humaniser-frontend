import { memo, useEffect, useRef, type RefObject } from 'react'
import { AlertTriangle, ExternalLink, Lock, SearchCheck, Square } from 'lucide-react'
import { Link } from 'react-router-dom'
import { sectionCheckLink } from '../../../lib/citationCheckView'
import type { ProjectSection } from '../../../types/research'
import { isSectionHeld, type DocumentSectionStatus, type DraftDecision } from '../../../lib/sectionWorkflow'
import type { SectionFlag } from '../../../lib/documentOutline'
import { SECTION_PROMPTS } from '../../../data/proposalOutline'
import { useNearViewport } from '../../../hooks/useNearViewport'
import { SectionStatusChip } from './SectionStatusMark'
import { SectionEditor } from './SectionEditor'
import { LiveDraftBody, WritingChip } from './LiveDraft'
import { countUncostedRows } from './pendingCells'

export interface DocumentSectionBlockProps {
  projectId:     string
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
  onDemoted:     (code: string) => void
  onDraft:       (code: string) => void
  onStop:        (code: string) => void
  isStopping:    boolean
  registerFlush: (code: string, flush: (() => Promise<boolean>) | null) => void
}

const FLAG_LABEL: Record<SectionFlag['kind'], string> = {
  alignment:   'Alignment',
  citation:    'Citation',
  interrupted: 'Interrupted',
  stopped:     'Stopped',
}

/** Rough height of an unmounted body, so the scrollbar does not jump before it is measured. */
const estimateHeight = (words: number) => Math.max(72, Math.round(words / 11) * 26)

const actionClass = 'dm-action rounded-lg text-[13px] px-4 py-2 transition-colors disabled:cursor-not-allowed'

function DocumentSectionBlockImpl({
  projectId, section, status, flags, draft, lockedReason, isApproving, scrollRoot, registerAnchor,
  onApprove, onRewrite, onOpenGuided, onDemoted, registerFlush, onDraft, onStop, isStopping,
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
  const uncosted = hasBody ? countUncostedRows(section.content) : 0
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
        {status === 'writing' ? <WritingChip projectId={projectId} code={section.code} /> : <SectionStatusChip status={status} />}
        <div className="flex-1" />
        {status === 'writing' && (
          <button type="button" onClick={() => onStop(section.code)} disabled={isStopping}
            className="dm-action inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-md px-2.5 py-1 disabled:opacity-60"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)', background: 'white' }}
            aria-label={`Stop writing ${label}`}>
            <Square size={10} aria-hidden="true" /> {isStopping ? 'Stopping…' : 'Stop'}
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenGuided(section.code)}
          className="dm-action inline-flex items-center gap-1 text-[12px] rounded-md px-2 py-1 hover:bg-white/60"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={`Open ${label} in Guided`}
        >
          <ExternalLink size={12} aria-hidden="true" /> Open in Guided
        </button>
        {hasBody && section.content.trim() && (
          <Link
            to={sectionCheckLink(projectId, section.code, label)}
            className="dm-action inline-flex items-center gap-1 text-[12px] rounded-md px-2 py-1 hover:bg-white/60"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={`Check the citations in ${label}`}
          >
            <SearchCheck size={12} aria-hidden="true" /> Check citations
          </Link>
        )}
      </div>

      {hasBody && flags.length > 0 && (
        // Above the text, not after it: a flag at the end of a 500-word section is a flag nobody sees.
        <ul className="list-none m-0 p-0 mb-3 flex flex-col gap-1.5" aria-label={`${flags.length} flag${flags.length === 1 ? '' : 's'} on ${label}`}>
          {flags.map(flag => (
            <li key={flag.id} className="flex items-start gap-2 text-[13px] leading-[1.45] rounded-lg px-3 py-2 bg-white"
              style={{ border: '1px solid var(--color-amber)', color: 'var(--color-amber-text)' }}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span><b className="font-semibold">{FLAG_LABEL[flag.kind]}:</b> {flag.message}</span>
            </li>
          ))}
        </ul>
      )}

      {uncosted > 0 && (
        <p className="m-0 mb-3 text-[13px] leading-[1.45] rounded-lg px-3 py-2" style={{ background: 'var(--surface-rail)', color: 'var(--text-secondary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <b className="font-semibold" style={{ color: 'var(--text-primary)' }}>{uncosted} budget line{uncosted === 1 ? '' : 's'} still need{uncosted === 1 ? 's' : ''} a cost.</b>{' '}
          Type your rates into the table below; the subtotal covers costed items only until then.
        </p>
      )}

      <div ref={bodyRef}>
        {status === 'locked' && (
          <p className="flex items-start gap-2 text-[13px] m-0" style={{ color: 'var(--text-secondary)' }}>
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {lockedReason}
          </p>
        )}

        {status === 'queued' && (
          <div className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <p className="m-0 italic" style={{ fontFamily: 'Georgia, serif' }}>{SECTION_PROMPTS[section.code]?.prompt ?? 'Not drafted yet.'}</p>
            {section.isApplicableForMethodology !== false && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={() => onDraft(section.code)} disabled={!draft.allowed}
                  aria-describedby={!draft.allowed && draft.reason ? `draft-reason-${section.code}` : undefined}
                  className={`${actionClass} font-semibold disabled:opacity-100`}
                  style={draft.allowed ? { background: 'var(--color-purple)', color: 'white' } : { background: 'var(--surface-rail)', color: 'var(--text-secondary)' }}>
                  Draft this section
                </button>
                {!draft.allowed && draft.reason && <span id={`draft-reason-${section.code}`} className="text-[12px]">{draft.reason}</span>}
              </div>
            )}
          </div>
        )}

        {status === 'writing' && <LiveDraftBody projectId={projectId} code={section.code} />}

        {hasBody && (near
          ? <SectionEditor projectId={projectId} code={section.code} content={section.content} label={label}
              editable={!isSectionHeld(section)} onDemoted={onDemoted} registerFlush={registerFlush}
              citationsPending={section.citationsPendingVerification} />
          : <div aria-hidden="true" style={{ height: measured.current ?? estimateHeight(section.wordCount) }} />)}
      </div>

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
  && a.section.status === b.section.status
  && a.section.lockedBy === b.section.lockedBy
  && a.section.citationsPendingVerification === b.section.citationsPendingVerification
  && a.projectId === b.projectId
  && a.onDemoted === b.onDemoted && a.registerFlush === b.registerFlush
  && a.onDraft === b.onDraft && a.onStop === b.onStop && a.isStopping === b.isStopping
  && flagsKey(a.flags) === flagsKey(b.flags)
  && a.onApprove === b.onApprove && a.onRewrite === b.onRewrite && a.onOpenGuided === b.onOpenGuided
  && a.registerAnchor === b.registerAnchor && a.scrollRoot === b.scrollRoot)
