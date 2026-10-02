import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Check,
  X,
  Shield,
  ChevronDown,
  Zap,
  Crown,
  Infinity,
  Sparkles,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { currencySymbol } from '../lib/currency'
import { useAuthStore } from '../store/authStore'
import { subscriptionApi } from '../api/subscription'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { Plan, PlanDefinitionDto } from '../types'

// ─── Plan grouping ────────────────────────────────────────────────────────────
// Pricing itself always comes from GET /subscription/plans — never hardcoded here.

interface GroupedPlan {
  tier: Plan
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
        monthly: rows.find((p) => p.billingInterval === 'Monthly'),
        annual: rows.find((p) => p.billingInterval === 'Annual'),
      }
    })
    .filter((g): g is GroupedPlan => g !== null)
}

// ─── Feature comparison table ─────────────────────────────────────────────────

type FeatureValue = string | boolean

interface Feature {
  label: string
  free: FeatureValue
  pro: FeatureValue
  unlimited: FeatureValue
}

const FEATURES: Feature[] = [
  { label: 'Words per month', free: '500', pro: '50,000', unlimited: 'Unlimited' },
  { label: 'Writing tones', free: '4 tones', pro: 'All tones', unlimited: 'All tones' },
  { label: 'Strength levels', free: true, pro: true, unlimited: true },
  { label: 'History', free: '5 items', pro: 'Unlimited', unlimited: 'Unlimited' },
  { label: 'Priority support', free: false, pro: true, unlimited: true },
  { label: 'Advanced analytics', free: false, pro: true, unlimited: true },
  { label: 'API access', free: false, pro: false, unlimited: true },
  { label: 'Dedicated support', free: false, pro: false, unlimited: true },
]

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How does billing work?',
    a: 'You are billed at the start of each billing period — monthly or annually. Annual plans are charged upfront for the full year at a discounted rate.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: "Yes, you can cancel at any time from your account settings. You'll retain access to your plan until the end of the current billing period.",
  },
  {
    q: 'Do you offer refunds?',
    a: 'We offer a 7-day money-back guarantee. If you are not satisfied within the first 7 days, contact us for a full refund — no questions asked.',
  },
  {
    q: 'Can I upgrade or downgrade my plan?',
    a: 'Absolutely. You can upgrade or downgrade at any time. When upgrading, the price difference is prorated. When downgrading, changes take effect at the next billing cycle.',
  },
  {
    q: 'What happens if I hit my word limit?',
    a: 'Once you reach your monthly word limit, humanisations are paused until your limit resets or you upgrade your plan. Your existing history remains accessible.',
  },
  {
    q: 'Is there a free trial for paid plans?',
    a: 'Pro includes a 7-day money-back guarantee so you can explore all features risk-free. If you are not happy within 7 days, we refund you in full.',
  },
]

// ─── Feature value cell ───────────────────────────────────────────────────────

function FeatureCell({ value }: { value: FeatureValue }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check size={16} className="text-purple-accent mx-auto" />
    ) : (
      <X size={16} className="text-[#d1d5db] mx-auto" />
    )
  }
  return <span className="text-sm text-text-pri">{value}</span>
}

// ─── FAQ accordion item ───────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-[#e0e0da] bg-white rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#f5f5f3] transition-colors"
      >
        <span className="text-sm font-medium text-text-pri pr-4">{q}</span>
        <ChevronDown
          size={16}
          className={cn(
            'text-text-sec shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
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
            <p className="px-5 pb-4 text-sm text-text-sec leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Plan card ────────────────────────────────────────────────────────────────

interface PlanCardProps {
  name: string
  icon: React.ReactNode
  priceMonthly: number
  priceAnnual: number
  currency: string
  description: string
  features: string[]
  cta: string
  featured?: boolean
  isAnnual: boolean
  onSelect: () => void
  isLoading?: boolean
  isFree?: boolean
  ctaLink?: string
  isCurrent?: boolean
}

function PlanCard({
  name,
  icon,
  priceMonthly,
  priceAnnual,
  currency,
  description,
  features,
  cta,
  featured,
  isAnnual,
  onSelect,
  isLoading,
  isFree,
  ctaLink,
  isCurrent,
}: PlanCardProps) {
  // Show per-month cost regardless of billing period
  const monthlyEquivalent = isAnnual ? Math.round(priceAnnual / 12) : priceMonthly
  const annualTotal = priceAnnual
  const annualSaving = priceMonthly * 12 - priceAnnual

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative flex flex-col rounded-xl border p-6 transition-all duration-300',
        featured
          ? 'bg-gradient-to-b from-violet-50 to-white border-purple-accent/50 shadow-[0_0_32px_rgba(124,58,237,0.12)]'
          : 'bg-white border-[#e0e0da]',
      )}
    >
      {featured && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-accent to-[#a855f7] text-white">
            <Sparkles size={10} />
            Most Popular
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#f5f5f3] border border-[#d1d5db] text-text-sec">
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-purple-accent">{icon}</span>
          <span className="text-base font-bold text-text-pri">{name}</span>
        </div>
        <p className="text-xs text-text-sec">{description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {isFree ? (
          <div className="flex items-end gap-1">
            <span className="text-3xl font-bold text-text-pri">{currencySymbol(currency)}0</span>
            <span className="text-sm text-text-sec mb-1"> / month</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-text-pri">
                {currencySymbol(currency)}{monthlyEquivalent}
              </span>
              <span className="text-sm text-text-sec mb-1">/month</span>
            </div>
            {isAnnual ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-text-sec">
                  Billed annually — {currencySymbol(currency)}{annualTotal.toLocaleString()}/year
                </p>
                <p className="text-xs text-emerald-700 font-medium">
                  Save {currencySymbol(currency)}{annualSaving.toLocaleString()}/year vs monthly
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-sec mt-1">Billed monthly · cancel anytime</p>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check size={14} className="text-purple-accent shrink-0 mt-0.5" />
            <span className="text-sm text-text-sec">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrent ? (
        <div className="w-full py-3 rounded-md text-sm font-semibold text-center border border-[#e0e0da] text-text-sec bg-[#f5f5f3] cursor-default">
          Your current plan
        </div>
      ) : isFree || ctaLink ? (
        <Link
          to={ctaLink ?? '/register'}
          className={cn(
            'block text-center py-3 rounded-md text-sm font-semibold transition-all duration-200',
            featured
              ? 'bg-gradient-to-r from-purple-accent to-[#a855f7] text-white hover:opacity-90'
              : 'border border-[#d1d5db] text-text-pri hover:bg-[#f5f5f3]',
          )}
        >
          {cta}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          disabled={isLoading}
          className={cn(
            'w-full py-3 rounded-md text-sm font-semibold transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            featured
              ? 'bg-gradient-to-r from-purple-accent to-[#a855f7] text-white hover:opacity-90'
              : 'border border-[#d1d5db] text-text-pri hover:bg-[#f5f5f3]',
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Redirecting…
            </span>
          ) : (
            cta
          )}
        </button>
      )}
    </motion.div>
  )
}

// ─── Main PricingPage ─────────────────────────────────────────────────────────

export function PricingPage() {
  useDocumentTitle(
    'Pricing — AI Humaniser, Detector, Paraphraser & More | HumaniseAI',
    'Simple USD pricing for HumaniseAI\'s five AI writing tools: Humaniser, Detector, Paraphraser, Grammar Checker, and Summariser. Free plan available, Starter from $10/month.',
    '/pricing',
  )
  const [isAnnual, setIsAnnual] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<'pro' | 'unlimited' | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user } = useAuthStore()

  // Show public Navbar + Footer only when accessed as standalone public page
  const isPublicRoute = location.pathname === '/pricing'
  const currentPlan = user?.plan ?? null

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionApi.getPlans().then((r) => r.data),
  })
  const groupedPlans = groupPlansByTier(plans ?? [])
  const proPlans = groupedPlans.find((g) => g.tier === 'Pro')
  const unlimitedPlans = groupedPlans.find((g) => g.tier === 'Unlimited')

  const checkoutMutation = useMutation({
    mutationFn: (planDefinitionId: string) =>
      subscriptionApi
        .createCheckout(
          planDefinitionId,
          `${window.location.origin}/app/billing?checkout=success`,
          `${window.location.origin}/pricing?checkout=cancelled`,
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      window.location.href = data.url
    },
    onError: () => {
      toast.error('Failed to start checkout. Please try again.')
      setCheckoutPlan(null)
    },
  })

  const handleProCheckout = () => {
    if (!isAuthenticated) {
      navigate('/register?plan=pro')
      return
    }
    const selected = isAnnual ? proPlans?.annual : proPlans?.monthly
    if (!selected) return
    setCheckoutPlan('pro')
    checkoutMutation.mutate(selected.id)
  }

  const handleUnlimitedCheckout = () => {
    if (!isAuthenticated) {
      navigate('/register?plan=unlimited')
      return
    }
    const selected = isAnnual ? unlimitedPlans?.annual : unlimitedPlans?.monthly
    if (!selected) return
    setCheckoutPlan('unlimited')
    checkoutMutation.mutate(selected.id)
  }

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Public navbar — only on /pricing standalone route */}
      {isPublicRoute && <Navbar />}

      {/* Back link — only when inside the app */}
      {!isPublicRoute && isAuthenticated && (
        <div className="px-6 pt-4">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 text-sm text-text-sec hover:text-text-pri transition-colors"
          >
            <ArrowLeft size={14} />
            Back to app
          </Link>
        </div>
      )}

      {/* Header */}
      <div className={cn('px-4 text-center', isPublicRoute ? 'pt-28 pb-12' : 'pt-8 pb-12')}>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-purple-accent border border-violet-200 mb-4">
            <Shield size={11} />
            7-Day Money-Back Guarantee
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-pri mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-text-sec max-w-xl mx-auto mb-8">
            Choose the plan that fits your writing needs. Upgrade or downgrade at any time.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-[#d1d5db] rounded-full p-1.5">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              aria-pressed={!isAnnual}
              className={cn(
                'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                !isAnnual ? 'bg-purple-accent text-white' : 'text-text-sec hover:text-text-pri',
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              aria-pressed={isAnnual}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                isAnnual ? 'bg-purple-accent text-white' : 'text-text-sec hover:text-text-pri',
              )}
            >
              Annual
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlanCard
            name="Free"
            icon={<Zap size={18} />}
            priceMonthly={0}
            priceAnnual={0}
            currency="USD"
            description="Perfect for trying out HumaniseAI"
            features={groupedPlans.find((g) => g.tier === 'Free')?.monthly?.features ?? []}
            cta="Get Started Free"
            isAnnual={isAnnual}
            onSelect={() => {}}
            isFree
            ctaLink="/register"
            isCurrent={currentPlan === 'Free'}
          />

          <PlanCard
            name="Pro"
            icon={<Crown size={18} />}
            priceMonthly={proPlans?.monthly?.price ?? 0}
            priceAnnual={proPlans?.annual?.price ?? 0}
            currency={proPlans?.monthly?.currency ?? proPlans?.annual?.currency ?? 'USD'}
            description="For writers and content creators"
            features={(isAnnual ? proPlans?.annual : proPlans?.monthly)?.features ?? []}
            cta="Upgrade to Pro"
            featured
            isAnnual={isAnnual}
            onSelect={handleProCheckout}
            isLoading={checkoutPlan === 'pro' && checkoutMutation.isPending}
            isCurrent={currentPlan === 'Pro'}
          />

          <PlanCard
            name="Unlimited"
            icon={<Infinity size={18} />}
            priceMonthly={unlimitedPlans?.monthly?.price ?? 0}
            priceAnnual={unlimitedPlans?.annual?.price ?? 0}
            currency={unlimitedPlans?.monthly?.currency ?? unlimitedPlans?.annual?.currency ?? 'USD'}
            description="For teams and power users"
            features={(isAnnual ? unlimitedPlans?.annual : unlimitedPlans?.monthly)?.features ?? []}
            cta="Go Unlimited"
            isAnnual={isAnnual}
            onSelect={handleUnlimitedCheckout}
            isLoading={checkoutPlan === 'unlimited' && checkoutMutation.isPending}
            isCurrent={currentPlan === 'Unlimited'}
          />
        </div>

        {/* Trust row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 text-sm text-text-sec"
        >
          <span className="flex items-center gap-2">
            <Shield size={15} className="text-emerald-600" />
            <span className="text-text-pri font-medium">7-Day Money-Back Guarantee</span>
          </span>
          <span className="hidden sm:block text-[#e0e0da]">·</span>
          <span>No credit card required for Free</span>
          <span className="hidden sm:block text-[#e0e0da]">·</span>
          <span>Cancel anytime</span>
        </motion.div>

        {/* Login nudge for unauthenticated visitors */}
        {!isAuthenticated && (
          <p className="text-center text-sm text-text-sec mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-accent hover:text-purple-text font-medium transition-colors">
              Log in →
            </Link>
          </p>
        )}
      </div>

      {/* Feature comparison table */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-text-pri text-center mb-8">Compare Plans</h2>
        <div className="bg-white border border-[#e0e0da] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e0e0da]">
                <th className="text-left px-5 py-4 text-sm font-semibold text-text-sec">Feature</th>
                <th className="text-center px-4 py-4 text-sm font-semibold text-text-sec">Free</th>
                <th className="text-center px-4 py-4 text-sm font-bold text-purple-accent">Pro</th>
                <th className="text-center px-4 py-4 text-sm font-semibold text-text-sec">Unlimited</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr
                  key={f.label}
                  className={cn(
                    'border-b border-[#e0e0da] last:border-b-0',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-[#f8fafc]',
                  )}
                >
                  <td className="px-5 py-3.5 text-sm text-text-pri">{f.label}</td>
                  <td className="px-4 py-3.5 text-center"><FeatureCell value={f.free} /></td>
                  <td className="px-4 py-3.5 text-center bg-violet-50"><FeatureCell value={f.pro} /></td>
                  <td className="px-4 py-3.5 text-center"><FeatureCell value={f.unlimited} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-text-pri text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>

      {/* Final CTA — appears after FAQ so users who scroll down have a destination */}
      <div className="max-w-2xl mx-auto px-4 pb-20 text-center">
        <p className="text-text-sec text-sm mb-4">Still have questions?</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {!isAuthenticated ? (
            <>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-accent to-[#a855f7] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Start for free — no card needed
              </Link>
              <Link
                to="/login"
                className="text-sm text-text-sec hover:text-text-pri transition-colors"
              >
                Log in to your account →
              </Link>
            </>
          ) : (
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-accent to-[#a855f7] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Back to your workspace →
            </Link>
          )}
        </div>
      </div>

      {/* Public footer */}
      {isPublicRoute && <Footer />}
    </div>
  )
}

export default PricingPage
