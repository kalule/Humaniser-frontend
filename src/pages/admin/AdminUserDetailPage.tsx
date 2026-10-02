import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react'
import { adminApi } from '../../api/admin'
import { Badge } from '../../components/ui/Badge'
import { AdminShell } from '../../components/admin/AdminShell'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { formatDate, formatNumber } from '../../lib/utils'

function PlanBadge({ plan }: { plan: string }) {
  const variant = plan === 'Pro' ? 'plan-pro' : plan === 'Unlimited' ? 'plan-unlimited' : ('plan-free' as const)
  return <Badge variant={variant}>{plan}</Badge>
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'reactivate' | 'promote' | 'demote' | 'resetUsage' | null>(null)

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminApi.getUserDetail(id!).then((r) => r.data),
    enabled: !!id,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-user', id] })

  const actionConfig: Record<
    NonNullable<typeof confirmAction>,
    { title: string; message: string; confirmLabel: string; run: () => Promise<void> }
  > = {
    suspend: {
      title: 'Suspend this account?',
      message: 'The user will be logged out and unable to log back in until reactivated. No data is deleted.',
      confirmLabel: 'Suspend account',
      run: async () => {
        await adminApi.updateUserStatus(id!, 'Suspended')
        toast.success('Account suspended.')
      },
    },
    reactivate: {
      title: 'Reactivate this account?',
      message: 'The user will be able to log in again immediately.',
      confirmLabel: 'Reactivate account',
      run: async () => {
        await adminApi.updateUserStatus(id!, 'Active')
        toast.success('Account reactivated.')
      },
    },
    promote: {
      title: 'Grant administrator access?',
      message: 'This user will gain full access to the admin panel, including managing other users.',
      confirmLabel: 'Make admin',
      run: async () => {
        await adminApi.updateUserRole(id!, 'Admin')
        toast.success('User promoted to Admin.')
      },
    },
    demote: {
      title: 'Remove administrator access?',
      message: 'This user will lose access to the admin panel.',
      confirmLabel: 'Remove admin role',
      run: async () => {
        await adminApi.updateUserRole(id!, 'User')
        toast.success('Admin role removed.')
      },
    },
    resetUsage: {
      title: 'Reset word usage to zero?',
      message: "This clears the user's current-period word usage. Their limit and plan are unchanged.",
      confirmLabel: 'Reset usage',
      run: async () => {
        await adminApi.resetUsage(id!)
        toast.success('Usage reset.')
      },
    },
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    try {
      await actionConfig[confirmAction].run()
      refresh()
    } catch {
      toast.error('Action failed.')
    } finally {
      setConfirmAction(null)
    }
  }

  if (isLoading || !user) {
    return (
      <AdminShell>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-white/10 rounded-full" />
          <div className="h-40 bg-white/5 rounded-lg" />
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text-main">
          <ArrowLeft size={13} />
          Back to users
        </Link>

        {/* Account */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-text-main">{user.name || user.email}</h2>
                <Badge variant={user.role === 'Admin' ? 'plan-unlimited' : 'default'}>{user.role}</Badge>
                <Badge variant={user.accountStatus === 'Active' ? 'success' : 'error'}>{user.accountStatus}</Badge>
              </div>
              <p className="text-sm text-muted">{user.email}</p>
              <p className="text-xs text-muted mt-1">Joined {formatDate(user.createdAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.accountStatus === 'Active' ? (
                <button
                  onClick={() => setConfirmAction('suspend')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <ShieldAlert size={13} />
                  Suspend
                </button>
              ) : (
                <button
                  onClick={() => setConfirmAction('reactivate')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <ShieldCheck size={13} />
                  Reactivate
                </button>
              )}
              {user.role === 'Admin' ? (
                <button
                  onClick={() => setConfirmAction('demote')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted hover:text-text-main transition-colors"
                >
                  <UserCog size={13} />
                  Remove admin
                </button>
              ) : (
                <button
                  onClick={() => setConfirmAction('promote')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted hover:text-text-main transition-colors"
                >
                  <UserCog size={13} />
                  Make admin
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Plan</p>
              <PlanBadge plan={user.plan} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Words</p>
              <p className="text-sm text-text-main">
                {formatNumber(user.wordsUsed)} / {user.wordsLimit >= 2_000_000_000 ? '∞' : formatNumber(user.wordsLimit)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Credits</p>
              <p className="text-sm text-text-main">
                {formatNumber(user.creditsUsed)} / {user.creditsLimit >= 2_000_000_000 ? '∞' : formatNumber(user.creditsLimit)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Last login</p>
              <p className="text-sm text-text-main">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</p>
            </div>
          </div>
          <button
            onClick={() => setConfirmAction('resetUsage')}
            className="mt-4 text-xs text-muted hover:text-text-main underline underline-offset-2"
          >
            Reset word usage
          </button>
        </div>

        {/* Usage */}
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold text-text-main mb-3">Usage</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Humanisations (history)</p>
              <p className="text-xl font-bold text-text-main">{formatNumber(user.historyCount)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Research projects</p>
              <p className="text-xl font-bold text-text-main">{formatNumber(user.researchProjectCount)}</p>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold text-text-main mb-3">Subscriptions</p>
          {user.subscriptions.length === 0 ? (
            <p className="text-sm text-muted">No subscriptions.</p>
          ) : (
            <div className="space-y-2">
              {user.subscriptions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border/50 last:border-b-0 text-sm">
                  <div className="flex items-center gap-2">
                    <PlanBadge plan={s.plan} />
                    <Badge variant={s.status === 'Active' ? 'success' : s.status === 'Cancelled' ? 'error' : 'warning'}>{s.status}</Badge>
                    <Badge variant="tone">{s.provider}</Badge>
                  </div>
                  <span className="text-muted text-xs">
                    {formatDate(s.currentPeriodStart)} – {formatDate(s.currentPeriodEnd)}
                    {s.cancelAtPeriodEnd && ' (cancels at period end)'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-text-main">Recent Payments</p>
          </div>
          {user.recentPayments.length === 0 ? (
            <p className="text-sm text-muted px-5 py-6">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-white/[0.02]">
                    {['Date', 'Amount', 'Status', 'Provider'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {user.recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-b-0">
                      <td className="px-4 py-3 text-sm text-muted">{formatDate(p.createdAt)}</td>
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
                        <Badge variant="tone">{p.provider}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <ConfirmActionModal
          title={actionConfig[confirmAction].title}
          message={actionConfig[confirmAction].message}
          confirmLabel={actionConfig[confirmAction].confirmLabel}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
        />
      )}
    </AdminShell>
  )
}

export default AdminUserDetailPage
