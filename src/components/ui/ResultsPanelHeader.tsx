import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ResultsPanelHeaderProps {
  title: ReactNode
  tinted?: boolean
  className?: string
}

/**
 * Title-only header for input/output panels, shared across tool pages.
 * Actions (Copy, Download, Paste, Upload…) and metadata (word count, delta,
 * status) live in PanelFooterBar at the bottom of the panel instead, so the
 * header stays a single line.
 */
export function ResultsPanelHeader({ title, tinted, className }: ResultsPanelHeaderProps) {
  return (
    <div
      className={cn('shrink-0 border-b border-[#e0e0da] px-5 py-2.5 flex items-center gap-2 transition-colors', className)}
      style={tinted ? { background: '#faf8ff' } : undefined}
    >
      {title}
    </div>
  )
}
