import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface PanelFooterBarProps {
  metadata?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Bottom metadata+actions row for input/output panels, shared across tool
 * pages — word count / delta / status on the left, utility actions (Paste,
 * Upload, Copy, Download…) on the right. Sits below the panel content, above
 * ToolBottomActionRow's Clear/primary row when both are present, so the
 * panel header stays reduced to just its title.
 */
export function PanelFooterBar({ metadata, actions, className }: PanelFooterBarProps) {
  if (!metadata && !actions) return null
  return (
    <div className={cn('px-5 py-2.5 border-t border-[#e0e0da] shrink-0 flex items-center justify-between gap-3 flex-wrap', className)}>
      <div className="flex items-center gap-2 min-w-0 flex-wrap">{metadata}</div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  )
}
