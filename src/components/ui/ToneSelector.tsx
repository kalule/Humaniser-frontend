import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import type { Tone } from '../../types'

interface ToneSelectorProps {
  value: Tone
  onChange: (tone: Tone) => void
  disabled?: boolean
  compact?: boolean
}

const tones: { value: Tone; label: string; description: string }[] = [
  { value: 'casual', label: 'Casual', description: 'Natural & relaxed' },
  { value: 'professional', label: 'Professional', description: 'Warm & formal' },
  { value: 'academic', label: 'Academic', description: 'Scholarly & precise' },
  { value: 'conversational', label: 'Conversational', description: 'Engaging & lively' },
]

export function ToneSelector({ value, onChange, disabled = false, compact = false }: ToneSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent, tone: Tone) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) onChange(tone)
    }
  }

  if (compact) {
    return (
      <div
        role="tablist"
        aria-label="Tone"
        className={cn('flex items-center gap-1.5 flex-wrap', disabled && 'opacity-50 pointer-events-none')}
      >
        {tones.map((tone) => {
          const isActive = tone.value === value
          return (
            <button
              key={tone.value}
              role="tab"
              type="button"
              aria-selected={isActive}
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && onChange(tone.value)}
              onKeyDown={(e) => handleKeyDown(e, tone.value)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-full font-medium transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white border border-slate-600',
              )}
            >
              {tone.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Tone"
      className={cn(
        'flex items-center gap-1 p-1 bg-dark border border-border rounded-lg',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      {tones.map((tone) => {
        const isActive = tone.value === value

        return (
          <button
            key={tone.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-label={`${tone.label}: ${tone.description}`}
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && onChange(tone.value)}
            onKeyDown={(e) => handleKeyDown(e, tone.value)}
            className={cn(
              'relative flex-1 flex flex-col items-center gap-0.5 px-3 py-2 rounded-md text-sm font-medium',
              'transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
              isActive ? 'text-white' : 'text-muted hover:text-white',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="tone-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}

            <span className="relative z-10 whitespace-nowrap">{tone.label}</span>
            <span
              className={cn(
                'relative z-10 text-[10px] leading-tight whitespace-nowrap',
                isActive ? 'text-white/70' : 'text-muted',
              )}
            >
              {tone.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
