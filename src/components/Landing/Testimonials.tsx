import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../../lib/utils'

const TESTIMONIALS = [
  {
    stars: 5,
    quote:
      "I was spending 30 minutes cleaning up every piece of ChatGPT content. Now it takes 30 seconds. The tone options are exactly what I needed.",
    initials: 'TM',
    name: 'Thabo M.',
    role: 'Marketing Manager, Joburg',
    avatarBg: 'from-indigo-500 to-indigo-700',
  },
  {
    stars: 5,
    quote:
      "Used it for my research report. Went from being flagged as 89% AI to passing Turnitin. Genuinely changed how I write now.",
    initials: 'SM',
    name: 'Sarah van der Merwe',
    role: 'UCT Student, Cape Town',
    avatarBg: 'from-purple-500 to-purple-700',
  },
  {
    stars: 5,
    quote:
      "The SA English setting is the reason I use this over QuillBot. It actually writes like we write here — not American English.",
    initials: 'KB',
    name: 'Kagiso B.',
    role: 'Content Writer, Pretoria',
    avatarBg: 'from-indigo-600 to-purple-600',
  },
  {
    stars: 4,
    quote:
      "We use it for job adverts and company communications. The professional tone is spot on. Our team loves it.",
    initials: 'MO',
    name: 'Michelle October',
    role: 'HR Manager, Durban',
    avatarBg: 'from-violet-600 to-indigo-600',
  },
  {
    stars: 5,
    quote:
      "Agency of 12 people, we process probably 50,000 words a month through this. The Business plan is excellent value.",
    initials: 'SD',
    name: 'Sipho Dlamini',
    role: 'Digital Agency, Sandton',
    avatarBg: 'from-indigo-500 to-purple-600',
  },
  {
    stars: 5,
    quote:
      "The detector + humaniser combo is what sold me. I check before AND after. My clients never question the content now.",
    initials: 'AB',
    name: 'Anri Botha',
    role: 'Freelance Copywriter',
    avatarBg: 'from-purple-500 to-indigo-600',
  },
]

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < count ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
        />
      ))}
    </div>
  )
}

export function Testimonials() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-slate-700 text-slate-400 text-xs font-semibold mb-4">
            Loved by Writers
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Trusted by writers across South Africa
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Students, marketers, and content creators rely on HumaniseAI daily.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <motion.article
              key={t.name}
              role="article"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg"
            >
              <StarRow count={t.stars} />
              <p className="text-base text-slate-400 leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0 select-none',
                    t.avatarBg,
                  )}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.role}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
