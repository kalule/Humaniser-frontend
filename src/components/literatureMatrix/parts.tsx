import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { statusLabel, type EvidenceStatus } from '../../lib/literatureMatrix'

const TONES = {
  green: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  blue: 'border-sky-300 bg-sky-50 text-sky-900',
  slate: 'border-slate-300 bg-slate-50 text-slate-700',
  purple: 'border-purple-200 bg-purple-tint text-purple-text',
  amber: 'border-amber-400 bg-amber-50 text-amber-900',
} as const

/** The evidence status of a cell, in words. Colour is never the only signal. */
export function StatusChip({ status, verified, interpretation, className }: { status: EvidenceStatus | null | undefined; verified?: boolean; interpretation?: boolean; className?: string }) {
  const label = statusLabel(status, interpretation)
  return (
    <span title={label.long} className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-px text-[11px] font-medium leading-4', TONES[label.tone], className)}>
      {label.short}{verified ? <span aria-label="verified by you"> · ✓</span> : null}
    </span>
  )
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800">
      {message}{' '}
      {onRetry ? <button type="button" onClick={onRetry} className="font-semibold underline">Try again</button> : null}
    </div>
  )
}

/**
 * A light dialog: Escape and the close button close it, focus moves into it on open and returns to where it was
 * on close, and the page behind does not scroll.
 */
export function Dialog({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  // Callers pass a new arrow each render; a ref keeps the setup below (focus, scroll lock) to once per open.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title}
        className={cn('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-elevated sm:rounded-2xl', wide ? 'sm:max-w-5xl' : 'sm:max-w-2xl')}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="min-w-0 text-[16px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

export const buttonClass = {
  primary: 'inline-flex items-center gap-1.5 rounded-lg bg-purple-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
  secondary: 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  danger: 'inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[13px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50',
  link: 'font-medium text-purple-deep underline disabled:opacity-50',
}

/** The notice shown before any source text is sent to an AI service. */
export function ConsentNotice({ checked, onChange, retentionDays, id = 'lm-consent' }: { checked: boolean; onChange: (v: boolean) => void; retentionDays: number; id?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-800">
      <p>
        To extract the details of a study, the text you uploaded or the abstract is sent to an AI service (Anthropic). It is
        used only to answer this request. Uploaded text and extracted passages are stored encrypted, and are deleted when you
        delete the matrix or after {retentionDays} days without activity.
      </p>
      <label htmlFor={id} className="mt-2 flex items-start gap-2 font-medium text-slate-900">
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5" />
        I understand, and I have the right to use the documents I upload.
      </label>
    </div>
  )
}
