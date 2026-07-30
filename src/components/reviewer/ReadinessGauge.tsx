interface ReadinessGaugeProps {
  score: number
  size?: number
  strokeWidth?: number
}

// Same red/amber/green status thresholds as ScoreBar's colorForScore callers
// elsewhere in the app (ResearchAgentPage, DetectorPage) — kept in sync so a
// score reads the same color whether it's in a bar or this ring.
function statusColor(score: number): string {
  return score >= 70 ? '#22c55e' : score >= 40 ? '#fbbf24' : '#f87171'
}

/**
 * Circular readiness ring for the reviewer results sidebar — the one place a
 * single headline score benefits from a hero treatment over ScoreBar's
 * horizontal bar (used everywhere the score sits alongside a label in a list).
 */
export function ReadinessGauge({ score, size = 140, strokeWidth = 10 }: ReadinessGaugeProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - clamped / 100)
  const color = statusColor(clamped)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
      </svg>
      <span className="absolute text-3xl font-bold text-slate-900 tabular-nums">{clamped}</span>
    </div>
  )
}
