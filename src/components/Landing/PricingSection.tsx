import { useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Check, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

const PLANS = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    annualTotal: 0,
    description: 'Try all five tools',
    highlight: false,
    features: [
      '500 words per month',
      '2 writing tones',
      'Light & medium strength',
      'Basic history (last 10)',
      'Standard processing speed',
    ],
    cta: 'Get started free',
    ctaLink: '/register',
  },
  {
    name: 'Starter',
    monthlyPrice: 10,
    annualPrice: 8,
    annualTotal: 96,
    annualSaving: 24,
    description: 'For regular writers',
    highlight: true,
    badge: 'Most Popular',
    features: [
      '10,000 credits per month',
      'All writing tones & strength levels',
      'Full access to all 5 tools',
      'Full history · Priority processing',
    ],
    cta: 'Start Starter trial',
    ctaLink: '/register?plan=pro',
  },
  {
    name: 'Professional',
    monthlyPrice: 20,
    annualPrice: 16,
    annualTotal: 192,
    annualSaving: 48,
    description: 'For teams and heavy users',
    highlight: false,
    features: [
      '35,000 credits per month',
      'Full access to all 5 tools',
      'Fastest processing',
      'Priority support',
      'API access (coming soon)',
    ],
    cta: 'Go Professional',
    ctaLink: '/register?plan=unlimited',
  },
]

interface PricingCardProps {
  plan: typeof PLANS[number]
  annual: boolean
}

function PricingCard({ plan, annual }: PricingCardProps) {
  const price = annual ? plan.annualPrice : plan.monthlyPrice

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative rounded-2xl border p-6 flex flex-col transition-all duration-300',
        plan.highlight
          ? 'border-[#7c3aed] shadow-lg shadow-violet-100 bg-white'
          : 'border-[#e0e0da] bg-white hover:border-[#d1d5db] hover:shadow-sm',
      )}
    >
      {plan.highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#7c3aed] text-white text-xs font-semibold whitespace-nowrap">
          {plan.badge}
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-[#1a1a18]">{plan.name}</h3>
        <p className="text-sm text-[#888888] mt-0.5">{plan.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-end gap-1">
          {annual && plan.monthlyPrice > 0 && (
            <span className="text-sm text-[#888888] line-through mb-1">${plan.monthlyPrice}</span>
          )}
          <span className="text-xs text-[#888888] font-medium mt-2">$</span>
          <span className="text-4xl font-bold text-[#1a1a18]">{price}</span>
          {price > 0 && (
            <span className="text-xs text-[#888888] mb-1">
              /{annual ? 'mo, billed annually' : 'mo'}
            </span>
          )}
        </div>
        {price === 0 && <span className="text-xs text-[#888888]">Forever free</span>}
        {annual && 'annualSaving' in plan && plan.annualSaving && plan.annualSaving > 0 && (
          <p className="text-xs text-[#065f46] font-semibold mt-1">
            Save ${plan.annualSaving}/year
          </p>
        )}
      </div>

      <ul className="space-y-2.5 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check size={14} className="text-[#7c3aed] shrink-0 mt-0.5" />
            <span className="text-sm text-[#555555]">{f}</span>
          </li>
        ))}
      </ul>

      <Link to={plan.ctaLink}>
        <button
          className={cn(
            'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200',
            plan.highlight
              ? 'bg-[#7c3aed] hover:bg-[#4c1d95] text-white transition-colors'
              : 'border border-[#d1d5db] text-[#555555] hover:bg-[#f1f5f9] hover:text-[#1a1a18]',
          )}
        >
          {plan.cta}
        </button>
      </Link>
    </motion.div>
  )
}

export function PricingSection() {
  const [annual, setAnnual] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="pricing" ref={ref} className="py-20 px-4 bg-slate-50 border-y border-[#e0e0da]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-xs font-semibold mb-4">
            Simple Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a18] mb-4">
            Simple Plans for Every Writer
          </h2>
          <p className="text-[#555555] text-base max-w-xl mx-auto">
            Start free. Upgrade for more words and priority processing. Cancel anytime.
          </p>
        </motion.div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={cn('text-sm', !annual ? 'text-[#1a1a18] font-medium' : 'text-[#888888]')}>
            Monthly
          </span>
          <button
            type="button"
            onClick={() => setAnnual((p) => !p)}
            role="switch"
            aria-checked={annual}
            aria-label="Toggle annual billing"
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors duration-300',
              annual ? 'bg-[#7c3aed]' : 'bg-[#d1d5db]',
            )}
          >
            <span
              className={cn(
                'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300',
                annual ? 'left-7' : 'left-1',
              )}
            />
          </button>
          <span className={cn('text-sm', annual ? 'text-[#1a1a18] font-medium' : 'text-[#888888]')}>
            Annual
            <span className="ml-1.5 text-xs text-[#065f46] font-semibold">Save 20%</span>
          </span>
        </div>

        {/* Cards */}
        <motion.div
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {PLANS.map((plan) => (
            <PricingCard key={plan.name} plan={plan} annual={annual} />
          ))}
        </motion.div>

        {/* Comparison line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-sm text-[#555555] mt-8"
        >
          QuillBot costs $9.99/month. HumaniseAI Starter costs $10/month — with four more tools included.{' '}
          <span className="text-[#555555]">Same quality. Global pricing.</span>
        </motion.p>

        {/* Money-back guarantee */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-2 mt-6 text-sm text-[#555555]"
        >
          <Shield size={15} className="text-emerald-700" />
          7-day money back guarantee · No questions asked
        </motion.div>
      </div>
    </section>
  )
}
