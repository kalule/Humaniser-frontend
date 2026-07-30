interface ScoreBarProps {
  score: number
  label: string
  size?: 'detailed' | 'compact'
  colorForScore: (score: number) => string
  className?: string
}

/**
 * Horizontal score visualization shared by the AI Detector's "Analysis
 * report" (detailed) and Rewrite's detection sidebar (compact) — the same
 * bar style renders both pages' AI-probability metric instead of mixing a
 * bar with a circular badge.
 */
export function ScoreBar({ score, label, size = 'detailed', colorForScore, className = '' }: ScoreBarProps) {
  const barColor = colorForScore(score)

  if (size === 'compact') {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-text-mut">{label}</span>
          <span className="text-sm font-semibold text-text-pri tabular-nums">{score}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-2xl font-medium text-gray-900">{score}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
