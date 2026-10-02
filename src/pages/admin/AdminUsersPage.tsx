import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { Badge } from '../../components/ui/Badge'
import { AdminShell } from '../../components/admin/AdminShell'
import { Pagination } from '../../components/admin/Pagination'
import { formatDate, formatNumber } from '../../lib/utils'

const PAGE_SIZE = 20

function PlanBadge({ plan }: { plan: string }) {
  const variant = plan === 'Pro' ? 'plan-pro' : plan === 'Unlimited' ? 'plan-unlimited' : ('plan-free' as const)
  return <Badge variant={variant}>{plan}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={status === 'Active' ? 'success' : 'error'}>{status}</Badge>
}

export function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [planFilter, setPlanFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, planFilter],
    queryFn: () =>
      adminApi.getUsers({ page, pageSize: PAGE_SIZE, search: search || undefined, plan: planFilter || undefined }).then((r) => r.data),
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-text-main">Users</h2>
          <div className="flex gap-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by email or name…"
                className="pl-8 pr-3 py-2 text-sm rounded-md bg-card border border-border text-text-main placeholder:text-muted focus:outline-none focus:border-primary w-64"
              />
            </form>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 text-sm rounded-md bg-card border border-border text-text-main focus:outline-none focus:border-primary"
            >
              <option value="">All plans</option>
              <option value="Free">Free</option>
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
                  {['Email', 'Role', 'Status', 'Plan', 'Subscription', 'Words Used', 'Joined'].map((h) => (
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
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-white/10 rounded-full animate-pulse" style={{ width: `${50 + j * 8}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-sm text-muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  (data?.items ?? []).map((u) => (
                    <tr key={u.id} className="border-b border-border/50 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/users/${u.id}`} className="text-sm text-text-main font-medium hover:text-primary">
                          {u.email}
                        </Link>
                        {u.name && <p className="text-xs text-muted">{u.name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === 'Admin' ? 'plan-unlimited' : 'default'}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.accountStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={u.plan} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{u.subscriptionStatus ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted">{formatNumber(u.wordsUsed)}</td>
                      <td className="px-4 py-3 text-sm text-muted">{formatDate(u.createdAt)}</td>
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

export default AdminUsersPage
