import { CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'

interface VerdictBadgeProps {
  verdict: string
  humanScore: number
  size?: 'sm' | 'md'
}

function getBadgeStyle(humanScore: number) {
  if (humanScore >= 80)
    return { classes: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', Icon: CheckCircle }
  if (humanScore >= 60)
    return { classes: 'bg-lime-500/20 text-lime-400 border-lime-500/30', Icon: CheckCircle }
  if (humanScore >= 40)
    return { classes: 'bg-amber-500/20 text-amber-400 border-amber-500/30', Icon: AlertTriangle }
  if (humanScore >= 20)
    return { classes: 'bg-orange-500/20 text-orange-400 border-orange-500/30', Icon: AlertTriangle }
  return { classes: 'bg-red-500/20 text-red-400 border-red-500/30', Icon: AlertTriangle }
}

export function VerdictBadge({ verdict, humanScore, size = 'md' }: VerdictBadgeProps) {
  const { classes, Icon } = getBadgeStyle(humanScore)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm',
        classes,
      )}
    >
      <Icon size={size === 'sm' ? 11 : 14} />
      {verdict}
    </span>
  )
}
