import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/admin'
import { Badge } from '../../components/ui/Badge'
import { AdminShell } from '../../components/admin/AdminShell'
import { Pagination } from '../../components/admin/Pagination'
import { formatDate } from '../../lib/utils'

const PAGE_SIZE = 20

function PlanBadge({ plan }: { plan: string }) {
  const variant = plan === 'Pro' ? 'plan-pro' : plan === 'Unlimited' ? 'plan-unlimited' : ('plan-free' as const)
  return <Badge variant={variant}>{plan}</Badge>
}

export function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [plan, setPlan] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', page, status, plan],
    queryFn: () =>
      adminApi.getSubscriptions({ page, pageSize: PAGE_SIZE, status: status || undefined, plan: plan || undefined }).then((r) => r.data),
  })

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-text-main">Subscriptions</h2>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm rounded-md bg-card border border-border text-text-main focus:outline-none focus:border-primary"
            >
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Cancelled">Cancelled</option>
              <option value="PastDue">Past due</option>
              <option value="Trialing">Trialing</option>
            </select>
            <select
              value={plan}
              onChange={(e) => { setPlan(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm rounded-md bg-card border border-border text-text-main focus:outline-none focus:border-primary"
            >
              <option value="">All plans</option>
              <option value="Pro">Pro</option>
              <option value="Unlimited">Unlimited</option>
            </select>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  {['User', 'Plan', 'Status', 'Provider', 'Period', 'Auto-renew'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-white/10 rounded-full animate-pulse" style={{ width: `${50 + j * 8}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-muted">
                      No subscriptions found.
                    </td>
                  </tr>
                ) : (
                  (data?.items ?? []).map((s) => (
                    <tr key={s.id} className="border-b border-border/50 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/users/${s.userId}`} className="text-sm text-text-main hover:text-primary">
                          {s.userEmail}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={s.plan} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.status === 'Active' ? 'success' : s.status === 'Cancelled' ? 'error' : 'warning'}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="tone">{s.provider}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {formatDate(s.currentPeriodStart)} – {formatDate(s.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{s.cancelAtPeriodEnd ? 'Off' : 'On'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
      </div>
    </AdminShell>
  )
}

export default AdminSubscriptionsPage
