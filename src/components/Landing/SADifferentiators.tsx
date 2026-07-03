import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Banknote, Languages, Zap, MessageCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

const CARDS = [
  {
    icon: Banknote,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    title: 'Priced in Rands',
    description:
      'No currency conversion. No dollar-based pricing that changes with the exchange rate. R149/month, full stop.',
    badge: 'R149/mo Pro',
    badgeClass: 'bg-emerald-500/15 text-emerald-300',
  },
  {
    icon: Languages,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    title: 'South African English',
    description:
      "Writes 'colour' not 'color', 'organise' not 'organize'. Output sounds like it was written here — because it was tuned for here.",
    badge: 'colour ✓',
    badgeClass: 'bg-emerald-500/15 text-emerald-300',
  },
  {
    icon: Zap,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    title: 'Load Shedding Proof',
    description:
      'Your work auto-saves every 30 seconds. Come back after Stage 4 and your text is exactly where you left it.',
    badge: 'Auto-saves',
    badgeClass: 'bg-emerald-500/15 text-emerald-300',
  },
  {
    icon: MessageCircle,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    title: 'WhatsApp Support',
    description:
      'Support via WhatsApp — not a ticket system. South African team, South African hours.',
    badge: 'WhatsApp',
    badgeClass: 'bg-emerald-500/15 text-emerald-300',
  },
]

export function SADifferentiators() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-20 px-4 bg-[#0f172a]">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🇿🇦</span>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              Built for South Africa
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            The Only AI Writing Tool{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
              Designed for SA
            </span>
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            International competitors built for global markets. We built for yours.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className="bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.08] rounded-2xl p-6 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', card.iconBg)}>
                  <card.icon size={22} className={card.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-base font-bold text-white">{card.title}</h3>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20', card.badgeClass)}>
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{card.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
