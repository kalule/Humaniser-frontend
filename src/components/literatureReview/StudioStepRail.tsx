import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface StudioStep { id: string; label: string; hint?: string; count?: string }

/**
 * A studio's step list: done, current and not-yet-reached steps. Every reached step is a link back; later steps are
 * shown but not clickable. A vertical rail on wide screens, a horizontal scroller on tablet and phone widths.
 * Shared by design (no studio had a reusable stepper); Systematic Review keeps its own for now.
 */
export function StudioStepRail({ steps, current, reached, onSelect, label = 'Steps' }: {
  steps: readonly StudioStep[]
  current: number
  reached: number
  onSelect: (index: number) => void
  label?: string
}) {
  return (
    <nav aria-label={label} className="min-w-0">
      <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {steps.map((step, i) => {
          const done = i < current && i <= reached
          const active = i === current
          const open = i <= Math.max(reached, current)
          return (
            <li key={step.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                disabled={!open}
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                  active ? 'bg-purple-tint text-purple-text' : open ? 'text-slate-800 hover:bg-slate-100' : 'cursor-not-allowed text-slate-400',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                    active ? 'border-purple-accent bg-purple-accent text-white' : done ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 bg-white',
                  )}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[14px] font-medium">{step.label}</span>
                  {step.count || step.hint ? (
                    <span className="hidden text-[12px] text-slate-600 lg:block">{step.count ?? step.hint}</span>
                  ) : null}
                </span>
                <span className="sr-only">{done ? ' (done)' : active ? ' (current step)' : !open ? ' (not reached yet)' : ''}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
