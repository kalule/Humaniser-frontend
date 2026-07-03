import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, ArrowRight, Check, Upload } from 'lucide-react'

const SURVEY_BARS = [
  { label: 'Strongly Agree', value: 68, color: '#6366f1' },
  { label: 'Agree', value: 24, color: '#818cf8' },
  { label: 'Neutral', value: 5, color: '#334155' },
  { label: 'Disagree', value: 3, color: '#1e293b' },
]

const FEATURES = [
  'Upload CSV, Excel, SPSS (.sav), and R datasets',
  'Ask questions in plain English — no SQL or code',
  'Auto-generate charts, frequency tables, and correlations',
  'Export APA-ready summaries and findings',
]

function BarChart({ visible }: { visible: boolean }) {
  const max = Math.max(...SURVEY_BARS.map((b) => b.value))
  return (
    <div className="space-y-2">
      {SURVEY_BARS.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 w-[88px] text-right shrink-0">{bar.label}</span>
          <div className="flex-1 h-4 rounded-sm bg-slate-800/60 overflow-hidden">
            <motion.div
              className="h-full rounded-sm"
              style={{ backgroundColor: bar.color }}
              initial={{ width: 0 }}
              animate={{ width: visible ? `${(bar.value / max) * 100}%` : 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[9px] font-mono text-slate-400 w-7 shrink-0">{bar.value}%</span>
        </div>
      ))}
    </div>
  )
}

export function DataAnalystPillar() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-24 px-4 bg-slate-50 border-y border-[#e0e0da] overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Data Analyst product mockup */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex justify-center order-2 lg:order-1"
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
                  <BarChart2 size={12} className="text-slate-400" />
                  <span className="text-slate-300 text-sm font-medium">Data Analyst</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Analysis ready
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                    <Upload size={14} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-200">survey_responses.csv</p>
                    <p className="text-[10px] text-slate-500">247 rows · 8 columns · Uploaded just now</p>
                  </div>
                </div>

                <div className="rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20 px-3 py-2.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 mb-1">Research Question</p>
                  <p className="text-[11px] text-slate-300">Does social media use correlate with lower academic grades?</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Survey Agreement (%)</p>
                    <span className="text-[10px] text-slate-600">n=247</span>
                  </div>
                  <BarChart visible={isInView} />
                </div>

                <div className="rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-1">Key Finding</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Statistically significant positive correlation (r = 0.71, p &lt; 0.001) — 68% strongly agree
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="order-1 lg:order-2"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold">
                <BarChart2 size={11} />
                Flagship Feature
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold">
                New
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a18] leading-tight mb-4">
              Upload your data.{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
                Get research-ready analysis.
              </span>
            </h2>

            <p className="text-[#555555] text-lg leading-relaxed mb-6">
              Data Analyst lets you upload your dataset and ask questions in plain English. It generates charts, frequency tables, correlations, and regression summaries — all formatted for your research report.
            </p>

            <ul className="space-y-3 mb-8">
              {FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 border border-purple-200 shrink-0 mt-0.5">
                    <Check size={11} className="text-purple-700" />
                  </span>
                  <span className="text-sm text-[#1a1a18] leading-relaxed">{feat}</span>
                </li>
              ))}
            </ul>

            <Link to="/app/analyst">
              <button className="inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#4c1d95] text-white px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-md shadow-violet-200">
                Try Data Analyst Free
                <ArrowRight size={16} />
              </button>
            </Link>
            <p className="text-[#888888] text-sm mt-2">No credit card required</p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
