import type { ReactNode } from 'react'

interface TwoColumnModulePageProps {
  topbarTitle: string
  topbarDesc?: string
  topbarActions?: ReactNode
  leftPanel: ReactNode
  leftPanelWidth?: number
  children: ReactNode
}

export function TwoColumnModulePage({
  topbarTitle,
  topbarDesc,
  topbarActions,
  leftPanel,
  leftPanelWidth = 300,
  children,
}: TwoColumnModulePageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Page subheader */}
      <div style={{
        height: 44,
        background: '#ffffff',
        borderBottom: '0.5px solid var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {topbarTitle}
        </span>
        {topbarDesc && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{topbarDesc}</span>
        )}
        <div style={{ flex: 1 }} />
        {topbarActions}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{
          width: leftPanelWidth,
          background: '#ffffff',
          borderRight: '0.5px solid var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {leftPanel}
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-page)',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          {children}
        </div>

      </div>
    </div>
  )
}
