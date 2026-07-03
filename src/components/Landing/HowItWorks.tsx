import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Library, ScrollText, Sparkles, Shield } from 'lucide-react'
import { cn } from '../../lib/utils'

const STEPS = [
  {
    number: 1,
    icon: Library,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    numberBg: 'bg-blue-600',
    title: 'Research & Collect',
    description:
      'Find your sources and build your Library. Search for papers, save web articles, and chat with your PDFs to extract key arguments.',
    tools: ['My Library', 'Web Library', 'Document Chat'],
  },
  {
    number: 2,
    icon: ScrollText,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    numberBg: 'bg-indigo-600',
    title: 'Propose & Analyse',
    description:
      'Proposal Studio builds a cited proposal from your sources. Data Analyst processes your dataset and produces research-ready charts and findings.',
    tools: ['Proposal Studio', 'Data Analyst'],
    flagship: true,
  },
  {
    number: 3,
    icon: Sparkles,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-700',
    numberBg: 'bg-violet-600',
    title: 'Write & Polish',
    description:
      'Draft your full document in Doc Writer, make AI content sound natural with the AI Humaniser, then run a final grammar check.',
    tools: ['Doc Writer', 'AI Humaniser', 'Grammar'],
  },
  {
    number: 4,
    icon: Shield,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    numberBg: 'bg-emerald-600',
    title: 'Verify & Submit',
    description:
      'Run AI detection sentence-by-sentence, check for plagiarism, and generate your final reference list in any citation style.',
    tools: ['AI Detector', 'Source Check', 'Citations'],
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
            Research Workflow
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a18] mb-4">
            Your full research journey, in one place
          </h2>
          <p className="text-[#555555] text-base max-w-xl mx-auto">
            Every step of the academic process — from source collection to final submission — covered by one platform.
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
              {step.flagship && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#7c3aed] text-white text-[10px] font-semibold whitespace-nowrap">
                  Flagship
                </span>
              )}

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
              <p className="text-sm text-[#555555] leading-relaxed mb-3">{step.description}</p>

              <div className="flex flex-wrap justify-center gap-1 mt-auto">
                {step.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-block px-2 py-0.5 rounded-full bg-[#f1f5f9] border border-[#e0e0da] text-[10px] text-[#555555] font-medium"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
