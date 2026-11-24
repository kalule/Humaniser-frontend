import { Check, History, Lock, Pencil } from 'lucide-react'
import { DOCUMENT_STATUS_LABELS, type DocumentSectionStatus } from '../../../lib/sectionWorkflow'

/**
 * Status dot for the outline. Each state has its own shape or glyph (tick, "!", pulse, ring,
 * padlock) and a screen-reader label, so status never depends on colour alone.
 */
export function SectionStatusMark({ status, size = 10 }: { status: DocumentSectionStatus; size?: number }) {
  const base: React.CSSProperties = {
    width: size + 4, height: size + 4, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
  }
  const label = <span className="sr-only">{DOCUMENT_STATUS_LABELS[status]}</span>
  switch (status) {
    case 'approved':
      return <span style={{ ...base, background: 'var(--color-green)' }}><Check size={size - 2} color="white" strokeWidth={3} aria-hidden="true" />{label}</span>
    case 'needs_review':
      return <span style={{ ...base, background: 'var(--color-amber)', color: 'white', fontSize: size, fontWeight: 700, lineHeight: 1 }}><span aria-hidden="true">!</span>{label}</span>
    case 'writing':
      return <span className="dm-pulse" style={{ ...base, background: 'var(--color-purple)' }}>{label}</span>
    case 'locked':
      return <span style={{ ...base }}><Lock size={size} color="var(--text-muted)" aria-hidden="true" />{label}</span>
    case 'edited_after_approval':
      return <span style={{ ...base, border: '1.5px solid var(--color-green)' }}><Pencil size={size - 3} color="var(--color-green-text)" strokeWidth={2.5} aria-hidden="true" />{label}</span>
    case 'stale':
      return <span style={{ ...base, border: '1.5px solid var(--color-amber)' }}><History size={size - 3} color="var(--color-amber-text)" strokeWidth={2.5} aria-hidden="true" />{label}</span>
    case 'queued':
    default:
      return <span style={{ ...base, border: '1.5px solid var(--text-muted)' }}>{label}</span>
  }
}

const CHIP_STYLES: Record<DocumentSectionStatus, React.CSSProperties> = {
  approved:     { background: 'var(--color-green-tint)',  color: 'var(--color-green-text)' },
  needs_review: { background: 'var(--color-amber-tint)',  color: 'var(--color-amber-text)' },
  writing:      { background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' },
  queued:       { background: 'var(--surface-rail)',      color: 'var(--text-secondary)' },
  locked:       { background: 'var(--surface-rail)',      color: 'var(--text-secondary)' },
  edited_after_approval: { background: 'var(--color-green-tint)', color: 'var(--color-green-text)', boxShadow: 'inset 0 0 0 1px var(--color-green)' },
  stale:        { background: 'var(--color-amber-tint)',  color: 'var(--color-amber-text)', boxShadow: 'inset 0 0 0 1px var(--color-amber)' },
}

/** Visible text label for a section heading. */
export function SectionStatusChip({ status, detail }: { status: DocumentSectionStatus; detail?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-semibold rounded-full"
      style={{ ...CHIP_STYLES[status], padding: '2px 9px', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {status === 'writing' && <span className="dm-pulse" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-purple)' }} />}
      {status === 'locked' && <Lock size={10} aria-hidden="true" />}
      {status === 'edited_after_approval' && <Pencil size={10} aria-hidden="true" />}
      {status === 'stale' && <History size={10} aria-hidden="true" />}
      {DOCUMENT_STATUS_LABELS[status]}{detail ? ` · ${detail}` : ''}
    </span>
  )
}
