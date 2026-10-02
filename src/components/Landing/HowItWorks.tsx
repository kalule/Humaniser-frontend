import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { PenLine, Sparkles, Shield, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'

const STEPS = [
  {
    number: 1,
    icon: PenLine,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    numberBg: 'bg-blue-600',
    title: 'Paste your text',
    description:
      'Drop in a draft, an AI-generated paragraph, or a long article — whatever you\'re working on.',
  },
  {
    number: 2,
    icon: Sparkles,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    numberBg: 'bg-indigo-600',
    title: 'Pick a tool',
    description:
      'Humanise it, paraphrase it, check the grammar, summarise it, or run it through the AI detector.',
    flagship: true,
  },
  {
    number: 3,
    icon: Shield,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-700',
    numberBg: 'bg-violet-600',
    title: 'Review the result',
    description:
      'Compare the output against your original, with changes and scores explained in plain language.',
  },
  {
    number: 4,
    icon: CheckCircle2,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    numberBg: 'bg-emerald-600',
    title: 'Copy and go',
    description:
      'Export or copy your polished text — ready to send, submit, or publish.',
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="how-it-works" ref={ref} className="py-20 px-4 bg-slate-50 border-y border-[#e0e0da]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-xs font-semibold mb-4">
            How It Works
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a18] mb-4">
            From draft to done in four steps
          </h2>
          <p className="text-[#555555] text-base max-w-xl mx-auto">
            No setup, no learning curve — paste your text and get a usable result in seconds.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Dashed connector line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px border-t border-dashed border-[#d1d5db]" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={cn(
                'flex flex-col items-center text-center relative rounded-2xl p-5 transition-all',
                step.flagship
                  ? 'bg-white border border-violet-200 shadow-md shadow-violet-50'
                  : 'bg-transparent',
              )}
            >
              <div className="relative mb-5 z-10">
                <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center', step.iconBg)}>
                  <step.icon size={30} className={step.iconColor} />
                </div>
                <span
                  className={cn(
                    'absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold',
                    step.numberBg,
                  )}
                >
                  {step.number}
                </span>
              </div>

              <h3 className="text-base font-bold text-[#1a1a18] mb-2">{step.title}</h3>
              <p className="text-sm text-[#555555] leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
