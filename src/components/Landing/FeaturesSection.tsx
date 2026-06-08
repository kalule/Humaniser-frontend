import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Sparkles, Shield, Palette, Sliders, Zap, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'

// Each feature carries its own color identity matching the in-app sidebar
const FEATURES = [
  {
    icon: Sparkles,
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
    accentColor: 'text-indigo-300',
    topLine: 'from-transparent via-indigo-500/50 to-transparent',
    hoverBorder: 'hover:border-indigo-500/25',
    label: 'AI Humaniser',
    benefit: 'Removes AI patterns automatically',
    outcome: 'Text passes GPTZero and Turnitin',
    stat: 'Average 73-point improvement',
  },
  {
    icon: Shield,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    accentColor: 'text-emerald-300',
    topLine: 'from-transparent via-emerald-500/50 to-transparent',
    hoverBorder: 'hover:border-emerald-500/25',
    label: 'AI Detector',
    benefit: 'Sentence-by-sentence analysis',
    outcome: 'Know exactly what to fix',
    stat: 'Detects 12+ AI patterns',
  },
  {
    icon: Palette,
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-400',
    accentColor: 'text-purple-300',
    topLine: 'from-transparent via-purple-500/50 to-transparent',
    hoverBorder: 'hover:border-purple-500/25',
    label: '4 Writing Tones',
    benefit: 'Match any context automatically',
    outcome: 'Casual, professional, academic, conversational',
    stat: 'Same text, 4 different voices',
  },
  {
    icon: Sliders,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    accentColor: 'text-violet-300',
    topLine: 'from-transparent via-violet-500/50 to-transparent',
    hoverBorder: 'hover:border-violet-500/25',
    label: 'Rewrite Strength 1–10',
    benefit: 'Control how much changes',
    outcome: 'From subtle polish to full rewrite',
    stat: 'You decide the intensity',
  },
  {
    icon: Zap,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    accentColor: 'text-amber-300',
    topLine: 'from-transparent via-amber-500/50 to-transparent',
    hoverBorder: 'hover:border-amber-500/25',
    label: 'Under 3 Seconds',
    benefit: 'Real-time results',
    outcome: 'No waiting, no queues',
    stat: 'Faster than any competitor',
  },
  {
    icon: Clock,
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    accentColor: 'text-cyan-300',
    topLine: 'from-transparent via-cyan-500/50 to-transparent',
    hoverBorder: 'hover:border-cyan-500/25',
    label: 'Full History',
    benefit: 'Every humanisation saved',
    outcome: 'Go back to any previous version',
    stat: 'Unlimited history on Pro',
  },
]

export function FeaturesSection() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="features" ref={ref} className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 text-xs font-semibold mb-4 tracking-wide">
            Everything You Need
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Powerful Features, Simple Price
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Everything you need to make AI text sound authentically human, all in one place.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className={cn(
                'group relative bg-black/20 border border-white/[0.07] rounded-2xl overflow-hidden',
                'flex flex-col transition-all duration-200 hover:shadow-lg',
                f.hoverBorder,
              )}
            >
              {/* Color-coded top accent line */}
              <div className={cn('h-px bg-gradient-to-r', f.topLine)} />

              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', f.iconBg)}>
                  <f.icon size={20} className={f.iconColor} />
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1">{f.label}</p>
                  <p className="text-base font-bold text-white">{f.benefit}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{f.outcome}</p>
                </div>

                <div className="border-t border-white/[0.05] pt-3 mt-auto">
                  <p className={cn('text-xs font-semibold', f.accentColor)}>{f.stat}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
