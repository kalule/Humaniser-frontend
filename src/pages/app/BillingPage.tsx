import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Zap,
  Crown,
  Infinity as InfinityIcon,
  Check,
  Shield,
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ChevronDown,
  CalendarDays,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'
import { cn, formatNumber, formatDate } from '../../lib/utils'
import { currencySymbol } from '../../lib/currency'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { userApi } from '../../api/user'
import { subscriptionApi } from '../../api/subscription'
import type { Plan, PlanDefinitionDto } from '../../types'

// ─── Plan presentation config ──────────────────────────────────────────────────
// Pricing/features come from the backend (GET /subscription/plans) — this table only
// supplies presentation details (icon, accent color) that aren't part of the pricing data.

const PLAN_PRESENTATION: Record<Plan, { Icon: React.ElementType; accentColor: string; featured?: boolean }> = {
  Free: { Icon: Zap, accentColor: '#888888' },
  Pro: { Icon: Crown, accentColor: '#7c3aed', featured: true },
  Unlimited: { Icon: InfinityIcon, accentColor: '#0ea5e9' },
}

interface GroupedPlan {
  tier: Plan
  name: string
  monthly?: PlanDefinitionDto
  annual?: PlanDefinitionDto
}

function groupPlansByTier(plans: PlanDefinitionDto[]): GroupedPlan[] {
  const order: Plan[] = ['Free', 'Pro', 'Unlimited']
  return order
    .map((tier): GroupedPlan | null => {
      const rows = plans.filter((p) => p.tier === tier)
      if (rows.length === 0) return null
      return {
        tier,
        name: rows[0].name,
        monthly: rows.find((p) => p.billingInterval === 'Monthly'),
        annual: rows.find((p) => p.billingInterval === 'Annual'),
      }
    })
    .filter((g): g is GroupedPlan => g !== null)
}

// ─── SVG usage ring ───────────────────────────────────────────────────────────

function UsageRing({ pct, color }: { pct: number; color: string }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const [animPct, setAnimPct] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimPct(Math.min(pct, 100)))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <svg width={96} height={96} className="-rotate-90" aria-hidden="true">
      <circle cx={48} cy={48} r={r} fill="none" stroke="#e0e0da" strokeWidth={7} />
      <circle
        cx={48}
        cy={48}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${circ * (animPct / 100)} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

// ─── Plan pill badge ──────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: Plan }) {
  const styles: Record<Plan, { bg: string; border: string; color: string }> = {
    Free:      { bg: '#f5f5f3', border: '#d1d5db', color: '#555555' },
    Pro:       { bg: '#ede9fe', border: '#c4b5fd', color: '#5b21b6' },
    Unlimited: { bg: '#e0f2fe', border: '#7dd3fc', color: '#0369a1' },
  }
  const s = styles[plan] ?? styles.Free
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {plan}
    </span>
  )
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-[11px] font-medium uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How does billing work?',
    a: 'You are billed at the start of each period — monthly or annually. Annual plans are charged upfront at a 20% discount.',
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes. Cancel from the billing portal and you'll retain full access until the end of the current billing period. No questions asked.",
  },
  {
    q: 'Is there a money-back guarantee?',
    a: 'Pro and Unlimited plans come with a 7-day money-back guarantee. Contact support within 7 days of subscribing for a full refund.',
  },
  {
    q: 'What happens when I hit my word limit?',
    a: 'Humanisations pause until your limit resets at the start of next month, or you upgrade your plan. All existing history stays accessible.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--border-hairline)', background: 'var(--surface-card)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-[#f9f9f7]"
      >
        <span className="text-sm font-medium pr-4" style={{ color: 'var(--text-primary)' }}>{q}</span>
        <ChevronDown
          size={15}
          className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main BillingPage ─────────────────────────────────────────────────────────

export function BillingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null)
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const currentPlan = (user?.plan ?? 'Free') as Plan
  const queryClient = useQueryClient()

  useEffect(() => {
    const checkout = params.get('checkout')
    if (checkout === 'success') toast.success('Payment successful — your plan is now active.')
    else if (checkout === 'failed') toast.error('Payment could not be completed. No subscription was activated.')
    else if (checkout === 'cancelled') toast('Payment cancelled. You have not been charged.', { icon: '↩' })
  }, [params])

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: () => userApi.getUsage().then((r) => r.data),
  })

  const { data: subscriptionStatus, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    // GET /subscription/status returns { plan, hasActiveSubscription, subscription }, not the
    // subscription itself — unwrap it here so callers below get the real SubscriptionDto (or
    // undefined), not the wrapper object.
    queryFn: () => subscriptionApi.getStatus().then((r) => r.data),
    enabled: currentPlan !== 'Free',
  })
  const subscription = subscriptionStatus?.subscription ?? undefined

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionApi.getPlans().then((r) => r.data),
  })
  const groupedPlans = groupPlansByTier(plans ?? [])

  const { data: payments } = useQuery({
    queryKey: ['payments'],
    queryFn: () => subscriptionApi.getPayments().then((r) => r.data),
  })

  const portalMutation = useMutation({
    mutationFn: () => subscriptionApi.getPortalUrl().then((r) => r.data),
    onSuccess: (d) => { window.location.href = d.url },
    onError: () => toast.error('Could not open billing portal'),
  })

  const checkoutMutation = useMutation({
    mutationFn: (planDefinitionId: string) =>
      subscriptionApi
        .createCheckout(
          planDefinitionId,
          `${window.location.origin}/app/billing?checkout=success`,
          `${window.location.origin}/app/billing?checkout=cancelled`,
        )
        .then((r) => r.data),
    onSuccess: (d) => { window.location.href = d.url },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to start checkout')
      setCheckoutPlan(null)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionApi.cancelSubscription(),
    onSuccess: () => {
      toast.success('Your subscription will cancel at the end of the current period.')
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
    onError: () => toast.error('Could not cancel subscription'),
  })

  const handleUpgrade = (plan: Plan) => {
    if (plan === 'Free' || plan === currentPlan) return
    const group = groupedPlans.find((g) => g.tier === plan)
    const selected = isAnnual ? group?.annual : group?.monthly
    if (!selected) return
    setCheckoutPlan(plan)
    checkoutMutation.mutate(selected.id)
  }

  const usagePct = usage ? Math.min((usage.wordsUsedThisMonth / usage.wordsLimit) * 100, 100) : 0
  const ringColor =
    usagePct >= 100 ? '#ef4444' : usagePct >= 80 ? '#f59e0b' : 'var(--color-purple)'

  const currentPlanMonthly = groupedPlans.find((g) => g.tier === currentPlan)?.monthly
  const planDisplayPrice = currentPlanMonthly
    ? `${currencySymbol(currentPlanMonthly.currency)}${currentPlanMonthly.price}/month`
    : '—'

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6" style={{ background: 'var(--surface-page)' }}>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Billing & Plans
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Manage your subscription, usage, and payment details
          </p>
        </div>

        {/* ── Current plan / usage hero card ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border p-6"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-hairline)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">

            {/* Usage ring */}
            <div
              className="relative shrink-0 flex items-center justify-center"
              style={{ width: 96, height: 96 }}
            >
              {usageLoading ? (
                <div
                  className="w-24 h-24 rounded-full animate-pulse"
                  style={{ background: 'var(--border-hairline)' }}
                />
              ) : usage ? (
                <>
                  <UsageRing pct={usagePct} color={ringColor} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                      {Math.round(usagePct)}%
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>used</span>
                  </div>
                </>
              ) : (
                <div
                  className="w-24 h-24 rounded-full"
                  style={{ background: 'var(--border-hairline)' }}
                />
              )}
            </div>

            {/* Plan info + usage bar */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <p
                  className="text-[11px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Current Plan
                </p>
                <PlanBadge plan={currentPlan} />
              </div>

              <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {planDisplayPrice}
              </p>

              {usageLoading ? (
                <div className="space-y-2 mt-3">
                  <div className="h-3 w-48 rounded animate-pulse" style={{ background: 'var(--border-hairline)' }} />
                  <div className="h-2 w-full rounded animate-pulse" style={{ background: 'var(--border-hairline)' }} />
                </div>
              ) : usage ? (
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>
                      {formatNumber(usage.wordsUsedThisMonth)} of {formatNumber(usage.wordsLimit)} words used
                    </span>
                    <span>{formatNumber(usage.wordsRemaining)} remaining</span>
                  </div>
                  <div
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{ background: '#e0e0da' }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${usagePct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: ringColor }}
                    />
                  </div>
                  <div
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <RotateCcw size={10} />
                    Resets {formatDate(usage.resetDate)}
                  </div>
                  {((user?.bonusWords ?? 0) > 0 || (user?.bonusCredits ?? 0) > 0) && (
                    <div className="text-xs" style={{ color: 'var(--color-purple)' }}>
                      + {formatNumber(user?.bonusWords ?? 0)} bonus words · {formatNumber(user?.bonusCredits ?? 0)} bonus credits (never expires)
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => useUiStore.getState().openTopUpModal()}
                    className="text-xs font-medium underline underline-offset-2"
                    style={{ color: 'var(--color-purple)' }}
                  >
                    Buy a one-time top-up
                  </button>
                </div>
              ) : null}
            </div>

            {/* Action column */}
            <div className="flex flex-col items-start gap-2 shrink-0">
              {currentPlan === 'Free' ? (
                <button
                  type="button"
                  onClick={() => handleUpgrade('Pro')}
                  disabled={checkoutMutation.isPending}
                  className="btn-primary inline-flex items-center gap-1.5 !h-9 text-sm font-semibold disabled:opacity-50"
                >
                  {checkoutPlan === 'Pro' && checkoutMutation.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Zap size={13} />
                  )}
                  Upgrade to Pro
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
                  style={{
                    background: 'var(--surface-card)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {portalMutation.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ExternalLink size={13} />
                  )}
                  Manage Billing
                </button>
              )}
              {currentPlan !== 'Free' && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Invoices, receipts & card details
                </p>
              )}
              {currentPlan !== 'Free' && subscription && !subscription.cancelAtPeriodEnd && (
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="text-[11px] font-medium underline underline-offset-2 disabled:opacity-50"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {cancelMutation.isPending ? 'Cancelling…' : 'Cancel subscription'}
                </button>
              )}
            </div>
          </div>

          {/* Subscription stats row */}
          {!subLoading && subscription && (
            <div
              className="mt-5 pt-5 border-t"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Status">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
                      subscription.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200',
                    )}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        subscription.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                    />
                    {subscription.status.charAt(0).toUpperCase() +
                      subscription.status.slice(1).replace(/_/g, ' ')}
                  </span>
                </Stat>

                <Stat label="Next charge">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays size={13} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                </Stat>

                <Stat label="Auto-renew">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {subscription.cancelAtPeriodEnd ? 'Off' : 'On'}
                  </span>
                </Stat>

                <Stat label="All-time words">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={13} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {usage ? formatNumber(usage.totalWordsAllTime) : '—'}
                    </span>
                  </div>
                </Stat>
              </div>

              {/* Cancellation notice */}
              {subscription.cancelAtPeriodEnd && (
                <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Your subscription cancels on{' '}
                    <span className="font-semibold">{formatDate(subscription.currentPeriodEnd)}</span>.
                    You keep full access until then.{' '}
                    <button
                      type="button"
                      onClick={() => portalMutation.mutate()}
                      className="font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors"
                    >
                      Undo cancellation →
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Plan selection ────────────────────────────────────────────────── */}
        {currentPlan === 'Unlimited' ? (
          /* Top-tier banner */
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-xl border p-6 text-center"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-hairline)' }}
          >
            <div
              className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: '#e0f2fe' }}
            >
              <InfinityIcon size={22} style={{ color: '#0ea5e9' }} />
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              You're on Unlimited — our highest tier
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              All features, no word cap. Use the billing portal to manage invoices, update payment
              details, or cancel.
            </p>
            <button
              type="button"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
              style={{
                background: 'var(--surface-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              {portalMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ExternalLink size={13} />
              )}
              Manage Billing
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {/* Section header + billing toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {currentPlan === 'Free' ? 'Choose your plan' : 'Upgrade your plan'}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  7-day money-back guarantee · Cancel anytime
                </p>
              </div>

              {/* Monthly / Annual toggle */}
              <div
                className="inline-flex items-center rounded-full p-0.5 border"
                style={{
                  background: 'var(--surface-card)',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                {(['Monthly', 'Annual'] as const).map((period) => {
                  const active = (period === 'Annual') === isAnnual
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setIsAnnual(period === 'Annual')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        active ? 'text-white' : '',
                      )}
                      style={
                        active
                          ? { background: 'var(--color-purple)' }
                          : { color: 'var(--text-secondary)' }
                      }
                    >
                      {period}
                      {period === 'Annual' && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1 py-0.5 rounded-full',
                            active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700',
                          )}
                        >
                          −20%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {groupedPlans.map((group, i) => {
                const presentation = PLAN_PRESENTATION[group.tier]
                const priceMonthly = group.monthly?.price ?? 0
                const priceAnnual = group.annual?.price ?? 0
                const currency = group.monthly?.currency ?? group.annual?.currency ?? 'USD'
                const features = (isAnnual ? group.annual : group.monthly)?.features ?? []
                const plan = {
                  id: group.tier,
                  name: group.name,
                  priceMonthly,
                  priceAnnual,
                  currency,
                  features,
                  accentColor: presentation.accentColor,
                  featured: presentation.featured,
                }
                const isCurrent = plan.id === currentPlan
                const monthlyEq =
                  isAnnual && plan.priceMonthly > 0
                    ? Math.round(plan.priceAnnual / 12)
                    : plan.priceMonthly
                const annualSaving = plan.priceMonthly * 12 - plan.priceAnnual
                const isLoading = checkoutPlan === plan.id && checkoutMutation.isPending
                const Icon = presentation.Icon

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * i }}
                    className="relative flex flex-col rounded-xl border p-5"
                    style={{
                      background: 'var(--surface-card)',
                      borderColor: isCurrent
                        ? 'var(--border-strong)'
                        : plan.featured
                        ? '#c4b5fd'
                        : 'var(--border-hairline)',
                      boxShadow:
                        plan.featured && !isCurrent
                          ? '0 0 0 1px #7c3aed18, 0 4px 20px #7c3aed10'
                          : undefined,
                      opacity: isCurrent ? 0.75 : 1,
                    }}
                  >
                    {/* Top tag */}
                    {plan.featured && !isCurrent && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                          style={{ background: 'var(--color-purple)' }}
                        >
                          <Sparkles size={9} />
                          Most Popular
                        </span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={{
                            background: 'var(--surface-page)',
                            borderColor: 'var(--border-strong)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Current plan
                        </span>
                      </div>
                    )}

                    {/* Plan header */}
                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${plan.accentColor}18` }}
                      >
                        <Icon size={14} style={{ color: plan.accentColor }} />
                      </div>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {plan.name}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="flex items-end gap-1">
                        <span
                          className="text-2xl font-bold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {plan.priceMonthly === 0 ? `${currencySymbol(plan.currency)}0` : `${currencySymbol(plan.currency)}${monthlyEq}`}
                        </span>
                        <span className="text-xs pb-0.5" style={{ color: 'var(--text-muted)' }}>
                          /mo
                        </span>
                      </div>
                      {plan.priceMonthly > 0 &&
                        (isAnnual ? (
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {currencySymbol(plan.currency)}{plan.priceAnnual.toLocaleString()}/yr ·{' '}
                            <span className="text-emerald-600 font-medium">
                              save {currencySymbol(plan.currency)}{annualSaving}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Billed monthly
                          </p>
                        ))}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-5 flex-1">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-xs"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <Check
                            size={11}
                            className="mt-0.5 shrink-0"
                            style={{ color: plan.accentColor }}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {isCurrent ? (
                      <div
                        className="w-full py-2 rounded-lg text-xs font-medium text-center border"
                        style={{
                          borderColor: 'var(--border-hairline)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Current plan
                      </div>
                    ) : plan.id === 'Free' ? (
                      <button
                        type="button"
                        onClick={() => portalMutation.mutate()}
                        disabled={portalMutation.isPending}
                        className="w-full py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                        style={{
                          borderColor: 'var(--border-hairline)',
                          color: 'var(--text-muted)',
                          background: 'var(--surface-card)',
                        }}
                      >
                        Downgrade via portal
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={isLoading || checkoutMutation.isPending}
                        className={cn(
                          'w-full py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          plan.featured ? 'text-white' : 'border',
                        )}
                        style={
                          plan.featured
                            ? { background: 'var(--color-purple)' }
                            : {
                                borderColor: 'var(--border-strong)',
                                color: 'var(--text-primary)',
                                background: 'var(--surface-card)',
                              }
                        }
                      >
                        {isLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            {plan.id === 'Pro' ? 'Upgrade to Pro' : 'Go Unlimited'}
                            <ArrowRight size={11} />
                          </>
                        )}
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Payment history ───────────────────────────────────────────────── */}
        {payments && payments.length > 0 && (
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-hairline)' }}
          >
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Payment history
            </h2>
            <div className="space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs py-2 border-b last:border-b-0"
                  style={{ borderColor: 'var(--border-hairline)' }}
                >
                  <div>
                    <span style={{ color: 'var(--text-primary)' }}>{formatDate(p.createdAt)}</span>
                    <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                      {p.currency} {p.amount.toFixed(2)}
                    </span>
                    {p.provider === 'Mock' && (
                      <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Test payment
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-medium border',
                      p.status === 'Succeeded' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      p.status === 'Failed' && 'bg-red-50 text-red-700 border-red-200',
                      p.status === 'Cancelled' && 'bg-[#f5f5f3] text-text-sec border-[#d1d5db]',
                      p.status === 'Pending' && 'bg-amber-50 text-amber-700 border-amber-200',
                    )}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Trust strip ───────────────────────────────────────────────────── */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-3.5 rounded-xl border text-xs"
          style={{
            background: 'var(--surface-card)',
            borderColor: 'var(--border-hairline)',
            color: 'var(--text-muted)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <Shield size={13} className="text-emerald-500" />
            7-day money-back guarantee
          </span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span>No credit card needed for Free</span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span>Cancel anytime, no lock-in</span>
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

export default BillingPage
