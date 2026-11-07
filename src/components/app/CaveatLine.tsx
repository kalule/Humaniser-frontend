import { cn } from '../../lib/utils'
import { caveatReason, stripSeparators } from '../../lib/deepResearchView'

/**
 * A qualification of a finding. Colour is used only when the text gives a reason for it, and the reason is written out
 * beside it ("Region mismatch", "Weak support"); a note with no recognisable reason is plain text.
 */
export function CaveatLine({ text, children }: { text: string; children?: React.ReactNode }) {
  const clean = stripSeparators(text)
  if (!clean) return null
  const reason = caveatReason(clean)
  return (
    <p className={cn('text-[12px] leading-snug', reason ? 'text-amber-900' : 'text-slate-600')}>
      {reason && <span className="mr-1.5 inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[11px] font-semibold text-amber-800">{reason.tag}</span>}
      {clean} {children}
    </p>
  )
}
