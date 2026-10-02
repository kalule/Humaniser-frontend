import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ToolSidebarShellProps {
  icon: ReactNode
  label: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  className?: string
}

/**
 * Shared chrome for the third contextual sidebar column that appears once a
 * tool has output (Detection Score, Grammar Score, Mode Info, Stats, …) —
 * standardizes the header bar, scroll region, and optional footer slot so
 * each tool only supplies its own metrics content.
 */
export function ToolSidebarShell({ icon, label, children, footer, width = 216, className }: ToolSidebarShellProps) {
  return (
    <div
      className={cn(
        'hidden lg:flex shrink-0 flex-col bg-white border border-[#e0e0da] rounded-2xl overflow-hidden shadow-card',
        className,
      )}
      style={{ width }}
    >
      <div className="px-4 py-3 border-b border-[#e0e0da] shrink-0">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-semibold text-text-mut uppercase tracking-wider">{label}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 p-4">
        {children}
      </div>
      {footer && <div className="px-4 py-3 border-t border-[#e0e0da] shrink-0">{footer}</div>}
    </div>
  )
}
