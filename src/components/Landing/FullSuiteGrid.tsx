import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { TOOL_CATEGORIES as CATEGORIES } from '../../data/toolsCatalog'

export function FullSuiteGrid() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-24 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-xs font-semibold mb-4">
            Full Platform Suite
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a18] mb-4">
            Everything you need to write, research, and study
          </h2>
          <p className="text-[#555555] text-base max-w-xl mx-auto">
            16 tools built for South African students and researchers — humanise and check your writing,
            then build your research from source collection to final submission.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {CATEGORIES.map((cat) => (
            <motion.div
              key={cat.id}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4 }}
              className="border border-[#e0e0da] rounded-2xl overflow-hidden bg-white"
            >
              {/* Category header */}
              <div className={cn('flex items-center gap-2 px-5 py-3 border-b border-[#e0e0da]', cat.headerBg)}>
                <cat.icon size={14} className={cat.headerColor} />
                <span className={cn('text-sm font-semibold', cat.headerColor)}>{cat.label}</span>
                <span className="ml-auto text-xs text-[#888888]">{cat.tools.length} tools</span>
              </div>

              {/* Tools */}
              <div className="divide-y divide-[#e0e0da]">
                {cat.tools.map((tool, ti) => (
                  <Link
                    key={tool.label}
                    to={tool.to}
                    className={cn(
                      'flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors group',
                      ti % 2 === 0 && cat.tools.length > 2 ? '' : '',
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tool.iconBg)}>
                      <tool.icon size={15} className={tool.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-medium text-[#1a1a18] group-hover:text-[#7c3aed] transition-colors">
                          {tool.label}
                        </span>
                        {'badge' in tool && tool.badge && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#ede9fe] text-[#5b21b6] text-[10px] font-semibold">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#888888] leading-tight">{tool.desc}</p>
                    </div>
                    <span className="text-[#d1d5db] group-hover:text-[#7c3aed] transition-colors shrink-0 mt-1">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
