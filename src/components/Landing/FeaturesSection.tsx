import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { cn } from '../../lib/utils'
import { PUBLIC_TOOLS } from '../../data/toolsCatalog'

const STEP_COPY: Record<string, { verb: string; outcome: string }> = {
  'AI Humaniser': { verb: 'Humanise', outcome: 'Make AI-written text sound like you wrote it' },
  'AI Detector': { verb: 'Detect', outcome: 'Check whether text reads as AI-generated' },
  'Paraphraser': { verb: 'Paraphrase', outcome: 'Rewrite it clearly, in different words' },
  'Grammar Checker': { verb: 'Check Grammar', outcome: 'Polish spelling, punctuation and clarity' },
  'Summariser': { verb: 'Summarise', outcome: 'Simplify long content into key points' },
}

export function FeaturesSection() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="features" ref={ref} className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-xs font-semibold mb-4 tracking-wide">
            A Focused Toolkit
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a18] mb-4">
            Five tools, one clear job each
          </h2>
          <p className="text-[#555555] text-base max-w-xl mx-auto">
            No bloated feature list to learn — just the tools you actually need to take writing
            from rough draft to polished, natural-sounding final copy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {PUBLIC_TOOLS.map((tool, i) => {
            const copy = STEP_COPY[tool.label]
            return (
              <motion.div
                key={tool.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                className="group relative bg-white border border-[#e0e0da] hover:border-violet-200 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-md"
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', tool.iconBg)}>
                  <tool.icon size={18} className={tool.iconColor} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1a1a18]">{copy?.verb ?? tool.label}</p>
                  <p className="text-xs text-[#555555] mt-1 leading-snug">{copy?.outcome ?? tool.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
