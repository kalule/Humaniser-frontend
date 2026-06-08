import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  User,
  Shield,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronRight,
  Loader2,
  TriangleAlert,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { cn, formatNumber, formatDate } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { userApi } from '../../api/user'
import { subscriptionApi } from '../../api/subscription'
import { Badge } from '../../components/ui/Badge'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'security' | 'billing' | 'danger'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'security', label: 'Security', icon: <Shield size={15} /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard size={15} /> },
  { id: 'danger', label: 'Danger Zone', icon: <AlertTriangle size={15} /> },
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80, 'Name too long'),
  email: z.string().email('Invalid email address'),
})
type ProfileForm = z.infer<typeof profileSchema>

const securitySchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type SecurityForm = z.infer<typeof securitySchema>

const deleteSchema = z.object({
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'You must type DELETE to confirm' }),
  }),
  password: z.string().min(1, 'Password is required'),
})
type DeleteForm = z.infer<typeof deleteSchema>

// ─── Progress bar ─────────────────────────────────────────────────────────────

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const isWarning = pct >= 80 && pct < 100
  const isDanger = pct >= 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{formatNumber(used)} used</span>
        <span className="text-muted">{formatNumber(limit)} limit</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-gradient-to-r from-primary to-secondary',
          )}
        />
      </div>
    </div>
  )
}

// ─── Password field with toggle ───────────────────────────────────────────────

interface PasswordFieldProps {
  label: string
  error?: string
  registration: React.InputHTMLAttributes<HTMLInputElement>
}

function PasswordField({ label, error, registration }: PasswordFieldProps) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-text-main">{label}</label>
      <div className="relative">
        <input
          {...registration}
          type={show ? 'text' : 'password'}
          className={cn(
            'w-full bg-card border rounded-md px-4 py-3 pr-10 text-sm text-text-main placeholder:text-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all',
            error ? 'border-red-500' : 'border-border',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text-main transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Password strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.pass).length

  const strengthLabel =
    score === 0 ? '' : score === 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong'
  const strengthColor =
    score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-amber-400' : score === 3 ? 'bg-yellow-400' : 'bg-emerald-500'

  if (!password) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', strengthColor)}
            style={{ width: `${(score / 4) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted w-12 text-right">{strengthLabel}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {checks.map((c) => (
          <span
            key={c.label}
            className={cn(
              'flex items-center gap-1 text-xs',
              c.pass ? 'text-emerald-400' : 'text-muted',
            )}
          >
            <CheckCircle2 size={10} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const queryClient = useQueryClient()

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '??'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => userApi.updateProfile(data).then((r) => r.data),
    onSuccess: (data) => {
      updateUser({ name: data.name, email: data.email })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      reset({ name: data.name ?? '', email: data.email })
      toast.success('Profile updated!')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6 max-w-md">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold select-none">
            {initials}
          </div>
          <button
            type="button"
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium"
          >
            Change
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-text-main">{user?.name ?? 'No name set'}</p>
          <p className="text-xs text-muted">{user?.email}</p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-main">Full Name</label>
        <input
          {...register('name')}
          type="text"
          placeholder="Your name"
          className={cn(
            'w-full bg-card border rounded-md px-4 py-3 text-sm text-text-main placeholder:text-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all',
            errors.name ? 'border-red-500' : 'border-border',
          )}
        />
        {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-main">Email Address</label>
        <div className="relative">
          <input
            {...register('email')}
            type="email"
            placeholder="you@example.com"
            className={cn(
              'w-full bg-card border rounded-md px-4 py-3 pr-24 text-sm text-text-main placeholder:text-muted',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all',
              errors.email ? 'border-red-500' : 'border-border',
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {user?.isEmailVerified ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={10} />
                Verified
              </span>
            ) : (
              <button
                type="button"
                className="text-xs text-primary hover:text-secondary underline underline-offset-2 transition-colors"
              >
                Verify
              </button>
            )}
          </div>
        </div>
        {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
      </div>

      <button
        type="submit"
        disabled={!isDirty || mutation.isPending}
        className={cn(
          'inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold transition-all duration-200',
          'bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 hover:shadow-glow',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {mutation.isPending && <Loader2 size={15} className="animate-spin" />}
        Save Changes
      </button>
    </form>
  )
}

// ─── Security tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<SecurityForm>({
    resolver: zodResolver(securitySchema),
  })

  const newPassword = watch('newPassword', '')

  const mutation = useMutation({
    mutationFn: (data: SecurityForm) =>
      userApi
        .changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Password changed successfully!')
      reset()
    },
    onError: () => toast.error('Failed to change password. Check your current password.'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5 max-w-md">
      <PasswordField
        label="Current Password"
        error={errors.currentPassword?.message}
        registration={register('currentPassword')}
      />

      <PasswordField
        label="New Password"
        error={errors.newPassword?.message}
        registration={register('newPassword')}
      />

      {newPassword && <PasswordStrength password={newPassword} />}

      <PasswordField
        label="Confirm New Password"
        error={errors.confirmPassword?.message}
        registration={register('confirmPassword')}
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className={cn(
          'inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold transition-all duration-200',
          'bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 hover:shadow-glow',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {mutation.isPending && <Loader2 size={15} className="animate-spin" />}
        Change Password
      </button>
    </form>
  )
}

// ─── Billing tab ──────────────────────────────────────────────────────────────

function BillingTab() {
  const user = useAuthStore((s) => s.user)

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: () => userApi.getUsage().then((r) => r.data),
  })

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getStatus().then((r) => r.data),
    enabled: user?.plan !== 'Free',
  })

  const portalMutation = useMutation({
    mutationFn: () => subscriptionApi.getPortalUrl().then((r) => r.data),
    onSuccess: (data) => {
      window.location.href = data.url
    },
    onError: () => toast.error('Failed to open billing portal'),
  })

  const planLabel = user?.plan ?? 'Free'
  const planBadgeVariant =
    planLabel === 'Pro'
      ? 'plan-pro'
      : planLabel === 'Unlimited'
        ? 'plan-unlimited'
        : ('plan-free' as const)

  const planPrice =
    planLabel === 'Pro' ? 'R149/month' : planLabel === 'Unlimited' ? 'R299/month' : 'Free'

  return (
    <div className="space-y-6 max-w-lg">
      {/* Current plan */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider font-medium mb-1">Current Plan</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-text-main">{planLabel}</span>
              <Badge variant={planBadgeVariant}>{planLabel}</Badge>
            </div>
            <p className="text-sm text-muted mt-0.5">{planPrice}</p>
          </div>
          {user?.plan === 'Free' ? (
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity"
            >
              Upgrade Plan
              <ChevronRight size={14} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border text-text-main hover:bg-white/5 disabled:opacity-50 transition-colors"
            >
              {portalMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Manage Billing
            </button>
          )}
        </div>

        {/* Usage */}
        {usageLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-white/10 rounded-full w-1/3" />
            <div className="h-2 bg-white/10 rounded-full" />
          </div>
        ) : usage ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">Words used this month</p>
            <UsageBar used={usage.wordsUsedThisMonth} limit={usage.wordsLimit} />
            <p className="text-xs text-muted">
              {formatNumber(usage.wordsRemaining)} words remaining · Resets{' '}
              {formatDate(usage.resetDate)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Subscription details */}
      {!subLoading && subscription && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm font-semibold text-text-main">Subscription Details</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted mb-0.5">Status</p>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  subscription.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400',
                )}
              >
                {subscription.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted mb-0.5">Next billing date</p>
              <p className="text-text-main font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
            </div>
            {subscription.cancelAtPeriodEnd && (
              <div className="col-span-2">
                <p className="text-xs text-amber-400">
                  Your subscription will cancel on {formatDate(subscription.currentPeriodEnd)}.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Free-plan upgrade prompt */}
      {user?.plan === 'Free' && (
        <div className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-indigo-400" />
            <p className="text-sm font-semibold text-text-main">Unlock more with Pro</p>
          </div>
          <ul className="space-y-2 mb-5">
            {[
              '10,000 words per month (vs 500 free)',
              'All 4 tones + Heavy rewriting mode',
              'Full history access & restore',
              'Priority processing speed',
              '7-day money-back guarantee',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 size={13} className="text-indigo-400 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            View Plans
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Danger zone tab ──────────────────────────────────────────────────────────

function DangerZoneTab() {
  const [showModal, setShowModal] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DeleteForm>({
    resolver: zodResolver(deleteSchema),
  })

  const deleteMutation = useMutation({
    mutationFn: (data: DeleteForm) => userApi.deleteAccount(data.password),
    onSuccess: () => {
      toast.success('Account deleted. Goodbye!')
      logout()
      navigate('/')
    },
    onError: () => toast.error('Failed to delete account. Check your password.'),
  })

  return (
    <div className="max-w-lg">
      <div className="border border-red-500/30 rounded-lg p-6 bg-red-500/5">
        <div className="flex items-start gap-3 mb-4">
          <TriangleAlert size={20} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-base font-semibold text-text-main">Delete Account</p>
            <p className="text-sm text-muted mt-1">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <AlertTriangle size={15} />
          Delete My Account
        </button>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowModal(false); reset() }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative bg-card border border-red-500/30 rounded-lg p-6 max-w-md w-full shadow-elevated"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-400" />
                <h3 className="text-base font-semibold text-text-main">Confirm Account Deletion</h3>
              </div>
              <p className="text-sm text-muted mb-5">
                This will permanently delete your account, all your history, and cancel any active subscription. Type{' '}
                <code className="text-red-400 bg-red-500/10 px-1 rounded">DELETE</code> to confirm.
              </p>

              <form
                onSubmit={handleSubmit((d) => deleteMutation.mutate(d))}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-main">
                    Type <span className="text-red-400 font-bold">DELETE</span> to confirm
                  </label>
                  <input
                    {...register('confirmation')}
                    type="text"
                    placeholder="DELETE"
                    autoComplete="off"
                    className={cn(
                      'w-full bg-dark border rounded-md px-4 py-3 text-sm text-text-main placeholder:text-muted/50',
                      'focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all',
                      errors.confirmation ? 'border-red-500' : 'border-border',
                    )}
                  />
                  {errors.confirmation && (
                    <p className="text-xs text-red-400">{errors.confirmation.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-main">Your password</label>
                  <input
                    {...register('password')}
                    type="password"
                    placeholder="Enter your password"
                    className={cn(
                      'w-full bg-dark border rounded-md px-4 py-3 text-sm text-text-main placeholder:text-muted/50',
                      'focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all',
                      errors.password ? 'border-red-500' : 'border-border',
                    )}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); reset() }}
                    className="flex-1 py-2.5 rounded-md text-sm font-medium border border-border text-text-main hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                    Delete Account
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main AccountPage ─────────────────────────────────────────────────────────

export function AccountPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  const TAB_CONTENT: Record<Tab, React.ReactNode> = {
    profile: <ProfileTab />,
    security: <SecurityTab />,
    billing: <BillingTab />,
    danger: <DangerZoneTab />,
  }

  return (
    <div className="min-h-screen bg-dark px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-main">Account Settings</h1>
          <p className="text-sm text-muted mt-1">Manage your profile, security, and billing</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-border mb-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 -mb-px',
                activeTab === tab.id
                  ? tab.id === 'danger'
                    ? 'border-red-500 text-red-400'
                    : 'border-primary text-text-main'
                  : 'border-transparent text-muted hover:text-text-main',
              )}
            >
              <span className={activeTab === tab.id && tab.id === 'danger' ? 'text-red-400' : ''}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {TAB_CONTENT[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default AccountPage
