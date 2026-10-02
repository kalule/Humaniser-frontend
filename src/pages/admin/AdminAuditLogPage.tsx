import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/admin'
import { Badge } from '../../components/ui/Badge'
import { AdminShell } from '../../components/admin/AdminShell'
import { Pagination } from '../../components/admin/Pagination'
import { formatDate } from '../../lib/utils'

const PAGE_SIZE = 25

export function AdminAuditLogPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-log', page],
    queryFn: () => adminApi.getAuditLog({ page, pageSize: PAGE_SIZE }).then((r) => r.data),
  })

  return (
    <AdminShell>
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-main">Audit Log</h2>
          <p className="text-xs text-muted mt-0.5">
            Append-only record of sensitive admin actions — role changes, account status changes, plan overrides, plan edits.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  {['Admin', 'Action', 'Target', 'Details', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
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
                      No admin actions recorded yet.
                    </td>
                  </tr>
                ) : (
                  (data?.items ?? []).map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 last:border-b-0">
                      <td className="px-4 py-3 text-sm text-text-main">{entry.adminEmail}</td>
                      <td className="px-4 py-3">
                        <Badge variant="tone">{entry.action}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {entry.targetType}
                        {entry.targetId ? ` #${entry.targetId.slice(0, 8)}` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted font-mono max-w-[300px] truncate">{entry.details ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted">{formatDate(entry.createdAt)}</td>
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

export default AdminAuditLogPage
