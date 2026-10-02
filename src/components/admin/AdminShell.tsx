import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/utils'

const TABS = [
  { label: 'Overview', to: '/admin' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Subscriptions', to: '/admin/subscriptions' },
  { label: 'Payments', to: '/admin/payments' },
  { label: 'Plans', to: '/admin/plans' },
  { label: 'Audit Log', to: '/admin/audit-log' },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-dark">
      <div className="border-b border-border px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-lg font-bold text-text-main">Admin</h1>
              <p className="text-xs text-muted">Operational management — not visible to normal users</p>
            </div>
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text-main transition-colors"
            >
              <ArrowLeft size={13} />
              Back to app
            </Link>
          </div>
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const active = tab.to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(tab.to)
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    'px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    active
                      ? 'border-primary text-text-main'
                      : 'border-transparent text-muted hover:text-text-main',
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</div>
    </div>
  )
}
