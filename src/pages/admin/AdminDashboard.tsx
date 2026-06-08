import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Users,
  FileText,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn, formatNumber, formatDate } from '../../lib/utils'
import { adminApi } from '../../api/admin'
import type { AdminUser } from '../../api/admin'
import { Badge } from '../../components/ui/Badge'

// ─── Custom recharts tooltip ──────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-elevated text-xs">
      <p className="text-muted mb-1">{label}</p>
      <p className="font-semibold text-text-main">{formatNumber(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  trend?: string
  trendPositive?: boolean
  icon: React.ReactNode
  loading?: boolean
}

function StatCard({ label, value, trend, trendPositive = true, icon, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-white/10 rounded-full w-20" />
          <div className="w-9 h-9 rounded-lg bg-white/10" />
        </div>
        <div className="h-8 bg-white/10 rounded-full w-1/2" />
        <div className="h-3 bg-white/10 rounded-full w-24" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-lg p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-text-main mb-1.5">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {trend && (
        <div
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            trendPositive ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          <ArrowUpRight size={12} className={trendPositive ? '' : 'rotate-180'} />
          {trend}
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton chart ───────────────────────────────────────────────────────────

function SkeletonChart() {
  return (
    <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
      <div className="h-4 bg-white/10 rounded-full w-32 mb-6" />
      <div className="h-48 bg-white/5 rounded-lg" />
    </div>
  )
}

// ─── Skeleton table row ───────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-white/10 rounded-full animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Plan badge helper ────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const variant =
    plan === 'Pro'
      ? 'plan-pro'
      : plan === 'Unlimited'
        ? 'plan-unlimited'
        : ('plan-free' as const)
  return <Badge variant={variant}>{plan}</Badge>
}

// ─── Main AdminDashboard ──────────────────────────────────────────────────────

export function AdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () =>
      Promise.all([
        adminApi.getStats().then((r) => r.data),
        adminApi.getUsage().then((r) => r.data),
      ]).then(([stats]) => stats),
    refetchInterval: 60_000,
  })

  const loading = isLoading

  return (
    <div className="min-h-screen bg-dark px-4 sm:px-6 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-main">Admin Dashboard</h1>
          <p className="text-sm text-muted mt-1">Platform overview and analytics</p>
        </div>

        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-5 py-4 text-sm text-red-400">
            Failed to load admin stats. Please refresh the page.
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={data?.totalUsers ?? 0}
            trend={data?.newUsersToday ? `+${data.newUsersToday} today` : undefined}
            trendPositive
            icon={<Users size={18} />}
            loading={loading}
          />
          <StatCard
            label="Words Today"
            value={data?.wordsToday ?? 0}
            icon={<FileText size={18} />}
            loading={loading}
          />
          <StatCard
            label="Words This Month"
            value={data?.totalWordsThisMonth ?? 0}
            icon={<TrendingUp size={18} />}
            loading={loading}
          />
          <StatCard
            label="Active Subscriptions"
            value={data?.activeSubscriptions ?? 0}
            icon={<CreditCard size={18} />}
            loading={loading}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Signups by day */}
          {loading ? (
            <SkeletonChart />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-lg p-5"
            >
              <p className="text-sm font-semibold text-text-main mb-4">Signups — Last 30 Days</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={data?.signupsByDay ?? []}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v)
                      return `${d.getDate()}/${d.getMonth() + 1}`
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366F1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#6366F1' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Words by tone */}
          {loading ? (
            <SkeletonChart />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-lg p-5"
            >
              <p className="text-sm font-semibold text-text-main mb-4">Words by Tone</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data?.toneUsage ?? []}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="tone" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>

        {/* Quick stats — users by plan */}
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-sm font-semibold text-text-main mb-4">Users by Plan</p>
          {loading ? (
            <div className="flex gap-3 animate-pulse">
              {[80, 64, 72].map((w, i) => (
                <div key={i} className={`h-7 rounded-full bg-white/10`} style={{ width: `${w}px` }} />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-500/20 border border-slate-500/30">
                <span className="text-sm font-semibold text-slate-300">
                  {formatNumber(data?.usersByPlan.free ?? 0)}
                </span>
                <span className="text-xs text-muted">Free</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                <span className="text-sm font-semibold text-indigo-300">
                  {formatNumber(data?.usersByPlan.pro ?? 0)}
                </span>
                <span className="text-xs text-muted">Pro</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                <span className="text-sm font-semibold text-purple-300">
                  {formatNumber(data?.usersByPlan.unlimited ?? 0)}
                </span>
                <span className="text-xs text-muted">Unlimited</span>
              </div>
            </div>
          )}
        </div>

        {/* Recent users table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-text-main">Recent Users</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Words Used
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : (data?.recentUsers ?? []).slice(0, 10).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-muted">
                      No users yet
                    </td>
                  </tr>
                ) : (
                  (data?.recentUsers ?? []).slice(0, 10).map((user: AdminUser) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-border/50 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm text-text-main font-medium truncate max-w-[200px]">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={user.plan} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted">{formatNumber(user.wordsUsed)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted">{formatDate(user.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {user.isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 size={12} />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                            <XCircle size={12} />
                            Unverified
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
