import { cn } from '../../lib/utils'
import type { ScreeningVerdict } from '../../types/systematicReview'

const VERDICT_STYLE: Record<ScreeningVerdict, string> = {
  Pending:   'bg-slate-100 text-slate-500',
  Match:     'bg-green-100 text-green-700',
  NoMatch:   'bg-red-100 text-red-700',
  Uncertain: 'bg-amber-tint text-amber-text',
}

const VERDICT_LABEL: Record<ScreeningVerdict, string> = {
  Pending: 'Pending', Match: 'Match', NoMatch: 'No Match', Uncertain: 'Uncertain',
}

interface ScreeningVerdictBadgeProps {
  verdict: ScreeningVerdict
  isManualOverride?: boolean
  /** Optional text shown before the verdict label, e.g. a criterion name in a summary list. */
  prefix?: string
  title?: string
  /** AI model that produced this verdict, if any — appended to the tooltip for provenance. */
  aiModel?: string | null
  onClick?: () => void
}

/** Single source of truth for verdict badge markup — used by every screening matrix/summary cell. */
export function ScreeningVerdictBadge({ verdict, isManualOverride, prefix, title, aiModel, onClick }: ScreeningVerdictBadgeProps) {
  const clickable = Boolean(onClick) && verdict !== 'Pending'
  const Tag = clickable ? 'button' : 'span'
  const fullTitle = aiModel && !isManualOverride && title ? `${title} (${aiModel})` : title

  return (
    <Tag
      onClick={clickable ? onClick : undefined}
      title={isManualOverride ? `Manually overridden by reviewer${title ? ` — ${title}` : ''}` : fullTitle}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition-opacity',
        VERDICT_STYLE[verdict],
        clickable && 'hover:opacity-80 cursor-pointer',
      )}
    >
      {isManualOverride && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {prefix && `${prefix}: `}
      {VERDICT_LABEL[verdict]}
    </Tag>
  )
}
