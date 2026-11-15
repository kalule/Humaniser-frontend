import { Link } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Hourglass } from 'lucide-react'
import { TOOLS } from '../../config/navigation'
import { useIsToolEnabled, type ToolId } from '../../config/features'

export function ComingSoon({ tool }: { tool: ToolId }) {
  const { label, description, icon: Icon } = TOOLS[tool]
  return (
    <div className="h-full min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-4 w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-purple-tint)', color: 'var(--color-purple)' }}
        >
          <Icon size={22} />
        </div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{label} is coming soon</h2>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>{description}.</p>
        <p className="mt-3 text-sm inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <Hourglass size={14} /> We&apos;re rolling this out in a later release.
        </p>
        <div className="mt-6">
          <Link
            to="/app/library"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--color-purple)' }}
          >
            Back to Documents
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Layout route: renders the nested tool routes when the tool is enabled (launch set, admin, or
 * VITE_ENABLE_ALL_TOOLS), otherwise a friendly "Coming soon" page at the same URL.
 */
export function ToolGate({ tool }: { tool: ToolId }) {
  const isEnabled = useIsToolEnabled()
  return isEnabled(tool) ? <Outlet /> : <ComingSoon tool={tool} />
}
