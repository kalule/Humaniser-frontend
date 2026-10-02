import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ToolBottomActionRowProps {
  clearButton: ReactNode
  hint?: ReactNode
  primaryButton: ReactNode
  className?: string
}

/**
 * Shared bottom action row for tool input panels — Clear + hint text on the
 * left, primary action button on the right. Every tool page (Humaniser,
 * Detector, Paraphrase, Grammar, Summarise) converged on this layout
 * independently; this makes it one component so future tools inherit it.
 */
export function ToolBottomActionRow({ clearButton, hint, primaryButton, className }: ToolBottomActionRowProps) {
  return (
    <div className={cn('px-5 py-3 border-t border-[#e0e0da] shrink-0 flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {clearButton}
        {hint && <span className="text-[13px] text-text-mut truncate">{hint}</span>}
      </div>
      {primaryButton}
    </div>
  )
}
