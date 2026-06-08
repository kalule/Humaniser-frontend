import { Zap, Flame, Rocket, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Strength } from '../../types'

interface StrengthSelectorProps {
  value: Strength
  onChange: (strength: Strength) => void
  disabled?: boolean
}

const strengths: { value: Strength; label: string; Icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', Icon: Zap },
  { value: 'medium', label: 'Medium', Icon: Flame },
  { value: 'heavy', label: 'Heavy', Icon: Rocket },
]

export function StrengthSelector({
  value,
  onChange,
  disabled = false,
}: StrengthSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Humanisation strength"
      className={cn(
        'flex rounded-md overflow-hidden border border-border',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      {strengths.map((s, idx) => {
        const isActive = s.value === value
        const isFirst = idx === 0
        const isLast = idx === strengths.length - 1

        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={s.label}
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && onChange(s.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault()
                onChange(s.value)
              }
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-sm font-medium',
              'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60',
              // Dividers between buttons
              !isFirst && 'border-l border-border',
              // Rounded corners only on outer edges
              isFirst && 'rounded-l-md',
              isLast && 'rounded-r-md',
              isActive
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-transparent text-muted hover:text-white hover:bg-white/5',
            )}
          >
            <s.Icon
              size={15}
              className={cn(
                'shrink-0',
                isActive ? 'text-primary' : 'text-muted',
              )}
            />
            <span>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
