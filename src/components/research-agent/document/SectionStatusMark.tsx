import { Check, CircleDashed, Clock, FilePen, History, Lock, Pencil, ScanEye } from 'lucide-react'
import { DOCUMENT_STATUS_LABELS, type DocumentSectionStatus } from '../../../lib/sectionWorkflow'

/**
 * Status mark for the outline. Every state has its own glyph and a screen-reader label, so status
 * never depends on colour alone:
 *   approved               green disc, tick
 *   needs_review           accent ring, eye ("Ready for review")
 *   writing                accent disc, pencil, pulsing
 *   up_next                clock
 *   not_started            dashed circle
 *   locked                 padlock
 *   edited_after_approval  green ring, page with pen
 *   stale                  amber ring, history arrow
 */
export function SectionStatusMark({ status, size = 10 }: { status: DocumentSectionStatus; size?: number }) {
  const box = size + 4
  const base: React.CSSProperties = {
    width: box, height: box, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
  }
  const label = <span className="sr-only">{DOCUMENT_STATUS_LABELS[status]}</span>
  switch (status) {
    case 'approved':
      return <span style={{ ...base, background: 'var(--color-green)' }}><Check size={size - 2} color="white" strokeWidth={3} aria-hidden="true" />{label}</span>
    case 'needs_review':
      return <span style={{ ...base, border: '1.5px solid var(--color-purple)', background: 'var(--color-purple-tint)' }}><ScanEye size={size - 2} color="var(--color-purple-text)" strokeWidth={2.5} aria-hidden="true" />{label}</span>
    case 'writing':
      return <span className="dm-pulse" style={{ ...base, background: 'var(--color-purple)' }}><Pencil size={size - 3} color="white" strokeWidth={2.5} aria-hidden="true" />{label}</span>
    case 'up_next':
      return <span style={base}><Clock size={box} color="var(--text-secondary)" strokeWidth={2} aria-hidden="true" />{label}</span>
    case 'locked':
      return <span style={base}><Lock size={size} color="var(--text-muted)" aria-hidden="true" />{label}</span>
    case 'edited_after_approval':
      return <span style={{ ...base, border: '1.5px solid var(--color-green)' }}><FilePen size={size - 3} color="var(--color-green-text)" strokeWidth={2.5} aria-hidden="true" />{label}</span>
    case 'stale':
      return <span style={{ ...base, border: '1.5px solid var(--color-amber)' }}><History size={size - 3} color="var(--color-amber-text)" strokeWidth={2.5} aria-hidden="true" />{label}</span>
    case 'not_started':
    default:
      return <span style={base}><CircleDashed size={box} color="var(--text-muted)" strokeWidth={2} aria-hidden="true" />{label}</span>
  }
}

const CHIP_STYLES: Record<DocumentSectionStatus, React.CSSProperties> = {
  approved:     { background: 'var(--color-green-tint)',  color: 'var(--color-green-text)' },
  needs_review: { background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' },
  writing:      { background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' },
  not_started:  { background: 'var(--surface-rail)',      color: 'var(--text-secondary)' },
  up_next:      { background: 'var(--surface-rail)',      color: 'var(--text-primary)' },
  locked:       { background: 'var(--surface-rail)',      color: 'var(--text-secondary)' },
  edited_after_approval: { background: 'var(--color-green-tint)', color: 'var(--color-green-text)', boxShadow: 'inset 0 0 0 1px var(--color-green)' },
  stale:        { background: 'var(--color-amber-tint)',  color: 'var(--color-amber-text)', boxShadow: 'inset 0 0 0 1px var(--color-amber)' },
}

const CHIP_ICON: Partial<Record<DocumentSectionStatus, typeof Check>> = {
  approved: Check, needs_review: ScanEye, up_next: Clock, not_started: CircleDashed, locked: Lock,
  edited_after_approval: FilePen, stale: History,
}

/** Visible text label for a section heading. */
export function SectionStatusChip({ status, detail }: { status: DocumentSectionStatus; detail?: string }) {
  const Icon = CHIP_ICON[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-semibold rounded-full"
      style={{ ...CHIP_STYLES[status], padding: '2px 9px', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {status === 'writing' && <span className="dm-pulse" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-purple)' }} />}
      {Icon && <Icon size={10} aria-hidden="true" />}
      {DOCUMENT_STATUS_LABELS[status]}{detail ? ` · ${detail}` : ''}
    </span>
  )
}
