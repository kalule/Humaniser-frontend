import { cn } from '../../lib/utils'

interface LevelSliderProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

function getStrengthLabel(value: number): string {
  if (value <= 3) return 'Light touch'
  if (value <= 6) return 'Medium rewrite'
  return 'Heavy rewrite'
}

export function LevelSlider({ value, onChange, disabled }: LevelSliderProps) {
  const pct = ((value - 1) / 9) * 100

  return (
    <div className={cn('w-full', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">Level</span>
        <span className="text-sm text-slate-400">{value}/10</span>
      </div>

      <div className="relative h-2 mb-1">
        <div className="absolute inset-0 bg-slate-700 rounded-full" />
        <div
          className="absolute left-0 top-0 h-full bg-indigo-600 rounded-full transition-all duration-100"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          aria-label={`Level ${value} of 10`}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md pointer-events-none transition-all duration-100"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-slate-500">Subtle</span>
        <span className="text-xs text-indigo-400 font-medium">{getStrengthLabel(value)}</span>
        <span className="text-xs text-slate-500">Aggressive</span>
      </div>
    </div>
  )
}
