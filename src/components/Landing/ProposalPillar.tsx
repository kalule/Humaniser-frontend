import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ScrollText, ArrowRight, Check, Quote } from 'lucide-react'

const MOCK_CITATIONS = [
  {
    id: 1,
    text: 'Bonanomi, A., Ongari, B., & Suttora, C. (2023). Social media engagement and student wellbeing: A systematic review.',
    journal: 'Journal of Educational Psychology, 115(4), 478–492.',
    source: 'Google Scholar',
  },
  {
    id: 2,
    text: 'Lau, W. W. F. (2022). Effects of social media use on academic performance in South African universities.',
    journal: 'Computers & Education, 180, 104444.',
    source: 'Semantic Scholar',
  },
  {
    id: 3,
    text: 'Smith, A. B., & van der Merwe, C. (2021). Digital distraction in higher education: A mixed-methods study.',
    journal: 'Higher Education Research & Development, 40(3), 615–629.',
    source: 'CrossRef',
  },
]

const FEATURES = [
  'Real citations pulled from live academic databases',
  'APA, Harvard, MLA, and 30+ citation styles',
  'Literature review auto-generated with sources',
  'Full proposal: introduction, methodology, timeline',
]

export function ProposalPillar() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-24 px-4 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <ScrollText size={11} />
                Flagship Feature
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold">
                New
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a18] leading-tight mb-4">
              From research question to{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                fully cited proposal
              </span>
            </h2>

            <p className="text-[#555555] text-lg leading-relaxed mb-6">
              Proposal Studio pulls real citations from live academic databases and builds a structured research proposal around them — introduction, methodology, literature review, and formatted references — in minutes.
            </p>

            <ul className="space-y-3 mb-8">
              {FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 border border-blue-200 shrink-0 mt-0.5">
                    <Check size={11} className="text-blue-700" />
                  </span>
                  <span className="text-sm text-[#1a1a18] leading-relaxed">{feat}</span>
                </li>
              ))}
            </ul>

            <Link to="/app/proposal-studio">
              <button className="inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#4c1d95] text-white px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-md shadow-violet-200">
                Try Proposal Studio Free
                <ArrowRight size={16} />
              </button>
            </Link>
            <p className="text-[#888888] text-sm mt-2">No credit card required</p>
          </motion.div>

          {/* Proposal Studio product mockup */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex justify-center"
          >
            <div className="w-full max-w-md bg-[#0d1117] rounded-2xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
              {/* Chrome bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex items-center gap-1.5">
                  <ScrollText size={12} className="text-slate-400" />
                  <span className="text-slate-300 text-sm font-medium">Proposal Studio</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  12 sources found
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Research Proposal</p>
                  <p className="text-slate-100 font-semibold text-sm leading-snug">
                    The Impact of Social Media Use on Academic Performance Among University Students in South Africa
                  </p>
                </div>

                <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">Abstract</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    This study investigates the relationship between social media engagement and academic performance among undergraduate students. Drawing on a mixed-methods approach, data was collected from 247 participants across three South African universities...
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">References</p>
                    <span className="text-[10px] text-indigo-400 font-semibold">APA 7th Ed.</span>
                  </div>
                  <div className="space-y-2">
                    {MOCK_CITATIONS.map((cite) => (
                      <div key={cite.id} className="flex gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <Quote size={9} className="text-indigo-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 leading-snug">{cite.text}</p>
                          <p className="text-[9px] text-indigo-400/70 mt-0.5 italic">{cite.journal}</p>
                          <span className="text-[9px] text-slate-600 font-mono">{cite.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
