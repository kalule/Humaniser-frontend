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
    description: 'Perfect for occasional use',
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
    name: 'Pro',
    monthlyPrice: 149,
    annualPrice: 119,
    annualTotal: 1428,
    annualSaving: 360,
    description: 'For writers and professionals',
    highlight: true,
    badge: 'Most Popular',
    features: [
      '10,000 words per month',
      'All 4 writing tones',
      'All strength levels',
      'Full history (unlimited)',
      'Priority processing',
      'Word analytics dashboard',
    ],
    cta: 'Start Pro trial',
    ctaLink: '/register?plan=pro',
  },
  {
    name: 'Unlimited',
    monthlyPrice: 299,
    annualPrice: 239,
    annualTotal: 2868,
    annualSaving: 720,
    description: 'For teams and heavy users',
    highlight: false,
    features: [
      'Unlimited words',
      'All 4 writing tones',
      'All strength levels',
      'Full history (unlimited)',
      'Fastest processing',
      'Word analytics dashboard',
      'Priority support',
      'API access (coming soon)',
    ],
    cta: 'Go Unlimited',
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
          ? 'border-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.15)] bg-slate-800'
          : 'border-slate-700 bg-slate-800 hover:border-slate-600',
      )}
    >
      {plan.highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold whitespace-nowrap">
          {plan.badge}
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
        <p className="text-sm text-slate-500 mt-0.5">{plan.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-end gap-1">
          {annual && plan.monthlyPrice > 0 && (
            <span className="text-sm text-slate-500 line-through mb-1">R{plan.monthlyPrice}</span>
          )}
          <span className="text-xs text-slate-400 font-medium mt-2">R</span>
          <span className="text-4xl font-bold text-white">{price}</span>
          {price > 0 && (
            <span className="text-xs text-slate-500 mb-1">
              /{annual ? 'mo, billed annually' : 'mo'}
            </span>
          )}
        </div>
        {price === 0 && <span className="text-xs text-slate-500">Forever free</span>}
        {annual && 'annualSaving' in plan && plan.annualSaving && plan.annualSaving > 0 && (
          <p className="text-xs text-emerald-400 font-semibold mt-1">
            Save R{plan.annualSaving}/year
          </p>
        )}
      </div>

      <ul className="space-y-2.5 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check size={14} className="text-indigo-400 shrink-0 mt-0.5" />
            <span className="text-sm text-slate-400">{f}</span>
          </li>
        ))}
      </ul>

      <Link to={plan.ctaLink}>
        <button
          className={cn(
            'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200',
            plan.highlight
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white transition-colors'
              : 'border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white',
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
    <section id="pricing" ref={ref} className="py-20 px-4 bg-slate-800/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-slate-700 text-slate-400 text-xs font-semibold mb-4">
            Simple Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Plans for Every Writer
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Start free. Upgrade when you need more. Cancel anytime.
          </p>
        </motion.div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={cn('text-sm', !annual ? 'text-white font-medium' : 'text-slate-400')}>
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
              annual ? 'bg-indigo-600' : 'bg-slate-600',
            )}
          >
            <span
              className={cn(
                'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300',
                annual ? 'left-7' : 'left-1',
              )}
            />
          </button>
          <span className={cn('text-sm', annual ? 'text-white font-medium' : 'text-slate-400')}>
            Annual
            <span className="ml-1.5 text-xs text-emerald-400 font-semibold">Save 20%</span>
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
          className="text-center text-sm text-slate-500 mt-8"
        >
          QuillBot costs $9.99/month (~R185). HumaniseAI Pro costs R149/month.{' '}
          <span className="text-slate-400">Same quality. Local pricing. SA support.</span>
        </motion.p>

        {/* Money-back guarantee */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-400"
        >
          <Shield size={15} className="text-emerald-400" />
          7-day money back guarantee · No questions asked
        </motion.div>
      </div>
    </section>
  )
}
