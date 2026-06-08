import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ClipboardPaste, Sliders, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

const STEPS = [
  {
    number: 1,
    icon: ClipboardPaste,
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    numberBg: 'bg-indigo-600',
    title: 'Paste Your Text',
    description:
      'Copy your AI-generated content and paste it into HumaniseAI. Works with ChatGPT, Claude, Gemini — any AI output.',
  },
  {
    number: 2,
    icon: Sliders,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    numberBg: 'bg-purple-600',
    title: 'Choose Your Style',
    description:
      'Select your tone — casual, professional, or academic. Pick your rewrite strength from subtle polish to complete transformation.',
  },
  {
    number: 3,
    icon: Sparkles,
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    numberBg: 'bg-emerald-600',
    title: 'Get Human Results',
    description:
      'Your text comes back humanised with a detection score. Most texts go from under 20% to over 85% human — in under 3 seconds.',
    highlight: '18% → 91%',
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="how-it-works" ref={ref} className="py-20 px-4 bg-slate-800/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-slate-700 text-slate-400 text-xs font-semibold mb-4">
            Simple Process
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            From AI to Human in 3 Steps
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            No complicated setup. No learning curve. Paste, choose, and get your natural text.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Dashed connector line (desktop) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px border-t border-dashed border-slate-700" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="flex flex-col items-center text-center relative"
            >
              {/* Icon */}
              <div className="relative mb-5 z-10">
                <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center', step.iconBg)}>
                  <step.icon size={32} className={step.iconColor} />
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

              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">{step.description}</p>

              {step.highlight && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
                  {step.highlight} Human
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom stat */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center mt-14"
        >
          <p className="text-4xl sm:text-5xl font-bold text-emerald-400">18% → 91% Human</p>
          <p className="text-slate-500 text-xs mt-1">Average improvement based on internal testing across 500+ text samples</p>
        </motion.div>
      </div>
    </section>
  )
}
