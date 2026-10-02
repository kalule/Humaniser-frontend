import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/admin'
import { Badge } from '../../components/ui/Badge'
import { AdminShell } from '../../components/admin/AdminShell'
import { Pagination } from '../../components/admin/Pagination'
import { formatDate } from '../../lib/utils'

const PAGE_SIZE = 20

export function AdminPaymentsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', page, status],
    queryFn: () => adminApi.getPayments({ page, pageSize: PAGE_SIZE, status: status || undefined }).then((r) => r.data),
  })

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-text-main">Payments</h2>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm rounded-md bg-card border border-border text-text-main focus:outline-none focus:border-primary"
          >
            <option value="">All statuses</option>
            <option value="Succeeded">Succeeded</option>
            <option value="Failed">Failed</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  {['User', 'Amount', 'Status', 'Provider', 'Date'].map((h) => (
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
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-white/10 rounded-full animate-pulse" style={{ width: `${50 + j * 8}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-muted">
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  (data?.items ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/users/${p.userId}`} className="text-sm text-text-main hover:text-primary">
                          {p.userEmail}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-main">
                        {p.currency} {p.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === 'Succeeded' ? 'success' : p.status === 'Failed' ? 'error' : 'warning'}>
                          {p.status}
                        </Badge>
                        {p.failureReason && <p className="text-[11px] text-muted mt-0.5">{p.failureReason}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="tone">
                          Provider: {p.provider}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{formatDate(p.createdAt)}</td>
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

export default AdminPaymentsPage
