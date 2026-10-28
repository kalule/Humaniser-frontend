import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface WorkspacePanel {
  header: ReactNode
  body: ReactNode
  footer?: ReactNode
}

interface ToolWorkspaceCardProps {
  /** Opaque slot above the two-column grid — Level/Style, Mode/Intensity, etc. Internals are entirely page-owned. */
  toggleBar?: ReactNode
  leftPanel: WorkspacePanel
  rightPanel: WorkspacePanel
  /** Small-screen tab strip (e.g. Original / Result) shown above the grid below `lg`. Pair with `mobilePanel`. */
  mobileTabs?: ReactNode
  /** Below `lg`, show only this panel (the grid is always two-up from `lg`). Omit to stack both, as before. */
  mobilePanel?: 'left' | 'right'
  /** Full-width row below the grid, inside the same outer border — not per-column. */
  bottomActionBar?: ReactNode
  /** Rendered outside/after the card, e.g. <ToolSidebarShell />. Its own responsive/animation wrapper is page-owned. */
  sidebar?: ReactNode
  /** Applied to the main-column wrapper — for page-specific height/sticky (e.g. `lg:sticky lg:top-4`). */
  className?: string
  style?: CSSProperties
}

/**
 * Shared unified-card shell for "Check & Improve" tool pages (Humaniser,
 * Detector, Paraphrase, Grammar): one bordered container holding an optional
 * toggle bar, a two-column input/output grid, and an optional full-width
 * bottom action row — plus the contextual sidebar as a sibling column.
 * Panel header/body/footer are opaque so page-specific interactive content
 * (sentence highlighting, annotated marks, hover-linked spans) drops in
 * unmodified.
 */
export function ToolWorkspaceCard({
  toggleBar,
  leftPanel,
  rightPanel,
  mobileTabs,
  mobilePanel,
  bottomActionBar,
  sidebar,
  className,
  style,
}: ToolWorkspaceCardProps) {
  return (
    <div className="flex gap-5 items-start">
      <div className={cn('flex-1 min-w-0', className)} style={style}>
        <div className="bg-white border border-[#e0e0da] rounded-2xl overflow-hidden flex flex-col h-full shadow-card">
          {toggleBar && (
            <div className="px-5 py-4 border-b border-[#e0e0da] shrink-0">
              {toggleBar}
            </div>
          )}

          {mobileTabs && (
            <div className="lg:hidden px-5 py-2 border-b border-[#e0e0da] shrink-0">{mobileTabs}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#e0e0da] flex-1 min-h-0">
            <div className={cn('flex-col min-h-0 lg:flex', mobilePanel === 'right' ? 'hidden' : 'flex')}>
              {leftPanel.header}
              {leftPanel.body}
              {leftPanel.footer}
            </div>
            <div className={cn('flex-col min-h-0 lg:flex', mobilePanel === 'left' ? 'hidden' : 'flex')}>
              {rightPanel.header}
              {rightPanel.body}
              {rightPanel.footer}
            </div>
          </div>

          {bottomActionBar && (
            <div className="px-5 py-3 border-t border-[#e0e0da] shrink-0">
              {bottomActionBar}
            </div>
          )}
        </div>
      </div>

      {sidebar}
    </div>
  )
}
