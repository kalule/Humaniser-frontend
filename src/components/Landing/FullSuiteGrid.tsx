import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { PUBLIC_TOOLS } from '../../data/toolsCatalog'

export function FullSuiteGrid() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="tools" ref={ref} className="py-24 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-xs font-semibold mb-4">
            Five Focused Tools
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a18] mb-4">
            Everything you need to improve your writing
          </h2>
          <p className="text-[#555555] text-base max-w-xl mx-auto">
            One toolkit, five jobs done well — humanise, detect, paraphrase, check grammar,
            and summarise, all in one place.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {PUBLIC_TOOLS.map((tool) => (
            <motion.div
              key={tool.label}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4 }}
            >
              <Link
                to={tool.to}
                className="group flex flex-col h-full border border-[#e0e0da] hover:border-violet-300 rounded-2xl p-6 bg-white hover:shadow-sm transition-all"
              >
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', tool.iconBg)}>
                  <tool.icon size={20} className={tool.iconColor} />
                </div>
                <h3 className="text-base font-bold text-[#1a1a18] mb-1.5 group-hover:text-[#7c3aed] transition-colors">
                  {tool.label}
                </h3>
                <p className="text-sm text-[#555555] leading-relaxed mb-4 flex-1">
                  {tool.desc}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7c3aed] group-hover:text-[#4c1d95] transition-colors">
                  Try it free
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
