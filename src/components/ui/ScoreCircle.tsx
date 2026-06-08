import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export type ScoreCircleSize = 'sm' | 'md' | 'lg'

interface ScoreCircleProps {
  score: number
  size?: ScoreCircleSize
  showLabel?: boolean
  animated?: boolean
}

const SIZE_CONFIG = {
  sm: { viewBox: 80, r: 32, strokeWidth: 6, fontSize: 'text-xl', labelSize: 'text-xs', center: 40 },
  md: { viewBox: 120, r: 45, strokeWidth: 8, fontSize: 'text-3xl', labelSize: 'text-sm', center: 60 },
  lg: { viewBox: 160, r: 65, strokeWidth: 10, fontSize: 'text-4xl', labelSize: 'text-base', center: 80 },
} as const

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#84CC16'
  if (score >= 40) return '#F59E0B'
  if (score >= 20) return '#F97316'
  return '#EF4444'
}

export function ScoreCircle({
  score,
  size = 'md',
  showLabel = true,
  animated = true,
}: ScoreCircleProps) {
  const [displayCount, setDisplayCount] = useState(animated ? 0 : score)
  const cfg = SIZE_CONFIG[size]
  const circumference = 2 * Math.PI * cfg.r
  const offset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)

  useEffect(() => {
    if (!animated) {
      setDisplayCount(score)
      return
    }
    const duration = 1200
    const startTime = Date.now()
    const startVal = 0
    let rafId: number

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayCount(Math.round(startVal + (score - startVal) * eased))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [score, animated])

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={cfg.viewBox}
        height={cfg.viewBox}
        viewBox={`0 0 ${cfg.viewBox} ${cfg.viewBox}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Background ring */}
        <circle
          cx={cfg.center}
          cy={cfg.center}
          r={cfg.r}
          fill="none"
          stroke="#1e293b"
          strokeWidth={cfg.strokeWidth}
        />
        {/* Score ring */}
        <motion.circle
          cx={cfg.center}
          cy={cfg.center}
          r={cfg.r}
          fill="none"
          stroke={color}
          strokeWidth={cfg.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset, stroke: color }}
          transition={{ duration: animated ? 1.2 : 0, ease: 'easeOut' }}
        />
      </svg>

      {/* Center text */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold text-slate-100 tabular-nums leading-none ${cfg.fontSize}`}>
            {displayCount}%
          </span>
          <span className={`text-slate-500 mt-0.5 ${cfg.labelSize}`}>Human</span>
        </div>
      )}
    </div>
  )
}
