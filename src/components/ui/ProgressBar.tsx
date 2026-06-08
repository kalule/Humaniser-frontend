import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface ProgressBarProps {
  value: number
  max: number
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const INT_MAX = 2_147_483_647

function getBarColor(pct: number): string {
  if (pct >= 0.9) return 'from-red-500 to-red-400'
  if (pct >= 0.7) return 'from-amber-500 to-amber-400'
  return 'from-primary to-secondary'
}

function getLabelColor(pct: number): string {
  if (pct >= 0.9) return 'text-red-400'
  if (pct >= 0.7) return 'text-amber-400'
  return 'text-muted'
}

export function ProgressBar({
  value,
  max,
  showLabel = false,
  size = 'md',
  className,
}: ProgressBarProps) {
  const isUnlimited = max >= INT_MAX

  const clampedValue = Math.max(0, value)
  const clampedMax = Math.max(1, max)
  const pct = isUnlimited ? 0 : Math.min(clampedValue / clampedMax, 1)

  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2.5'
  const barColor = getBarColor(pct)
  const labelColor = getLabelColor(pct)

  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs">
          <span className={labelColor}>
            {isUnlimited
              ? 'Unlimited'
              : `${clampedValue.toLocaleString()} / ${clampedMax.toLocaleString()}`}
          </span>
          {!isUnlimited && (
            <span className={labelColor}>
              {Math.round(pct * 100)}%
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          'w-full bg-border rounded-full overflow-hidden',
          trackHeight,
        )}
        role="progressbar"
        aria-valuenow={isUnlimited ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={isUnlimited ? undefined : clampedMax}
        aria-label={isUnlimited ? 'Unlimited usage' : undefined}
      >
        {isUnlimited ? (
          // Show a full indigo bar for unlimited plans
          <div className="h-full w-full bg-gradient-to-r from-primary to-secondary rounded-full" />
        ) : (
          <motion.div
            className={cn(
              'h-full rounded-full bg-gradient-to-r',
              barColor,
            )}
            initial={{ width: 0 }}
            animate={{ width: `${pct * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  )
}
