import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

// Human-score bands driving the gauge's color/label — tune here, not inline,
// so DetectionService calibration changes don't require touching the component.
export const DETECTION_SCORE_THRESHOLDS = {
  human: 80, // humanScore >= this → green "Looks Human"
  mixed: 50, // humanScore >= this (below `human`) → amber "Mixed Signals"; below this → red "Likely Flagged"
}

function bandFor(humanScore: number): { ring: string; textDark: string; textLight: string; label: string } {
  if (humanScore >= DETECTION_SCORE_THRESHOLDS.human) {
    return { ring: '#34d399', textDark: 'text-emerald-400', textLight: 'text-emerald-600', label: 'Looks Human' }
  }
  if (humanScore >= DETECTION_SCORE_THRESHOLDS.mixed) {
    return { ring: '#fbbf24', textDark: 'text-amber-400', textLight: 'text-amber-600', label: 'Mixed Signals' }
  }
  return { ring: '#f87171', textDark: 'text-red-400', textLight: 'text-red-600', label: 'Likely Flagged' }
}

interface DetectionScoreGaugeProps {
  humanScore: number
  isLoading?: boolean
  size?: number
  strokeWidth?: number
  className?: string
  /** 'dark' for slate-panel UIs, 'light' for white-card UIs. */
  variant?: 'dark' | 'light'
  /** Show the "Looks Human"/etc status text beside the ring. */
  showLabel?: boolean
  /**
   * Whether `humanScore` came from an independently-run detection scan
   * (DetectionService) rather than the rewrite pipeline's own self-reported
   * estimate. Defaults to true so existing callers that already only pass
   * real scan results are unaffected. When false, the gauge visibly marks
   * itself as an estimate (tilde prefix + dashed ring) — the model that just
   * generated the text isn't a trustworthy judge of its own output, so this
   * must never read the same as a verified score.
   */
  verified?: boolean
}

export function DetectionScoreGauge({
  humanScore,
  isLoading = false,
  size = 44,
  strokeWidth = 4,
  className,
  variant = 'dark',
  showLabel = true,
  verified = true,
}: DetectionScoreGaugeProps) {
  if (isLoading) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs',
        variant === 'dark' ? 'bg-slate-700/60 text-slate-400' : 'bg-neutral-100 text-neutral-500',
        className,
      )}>
        <Loader2 size={10} className="animate-spin" />
        Scanning…
      </span>
    )
  }

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, Math.round(humanScore)))
  const offset = circumference * (1 - clamped / 100)
  const band = bandFor(clamped)

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={variant === 'dark' ? '#334155' : '#e5e7eb'} strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={band.ring} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={verified ? circumference : `${circumference * 0.75} ${circumference * 0.06}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 700ms ease' }}
          />
        </svg>
        <span className={cn(
          'absolute text-[10px] font-bold tabular-nums',
          variant === 'dark' ? 'text-slate-100' : 'text-neutral-800',
        )}>
          {clamped}%
        </span>
      </div>
      {showLabel && (
        <span className={cn('text-xs font-medium whitespace-nowrap', variant === 'dark' ? band.textDark : band.textLight)}>
          {band.label}
        </span>
      )}
    </div>
  )
}
