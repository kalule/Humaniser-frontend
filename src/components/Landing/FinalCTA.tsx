import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export function FinalCTA() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-24 px-4 relative overflow-hidden bg-slate-50 border-y border-[#e0e0da]">
      {/* Ambient bloom */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-100/50 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-2xl mx-auto"
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7c3aed] mb-6">
          <Sparkles size={26} className="text-white" />
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1a1a18] mb-4 leading-tight">
          Start writing better today
        </h2>

        <p className="text-[#555555] text-base leading-relaxed mb-8">
          Join writers across South Africa who use HumaniseAI to make their writing sound
          more natural, clear, and polished.
        </p>

        <Link to="/register">
          <button className="inline-flex items-center gap-2 bg-[#7c3aed] hover:bg-[#4c1d95] text-white px-10 py-4 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-violet-200">
            Try Humaniser Free
            <ArrowRight size={18} />
          </button>
        </Link>

        <p className="mt-4 text-sm text-[#888888]">
          No credit card · Cancel anytime · SA support via WhatsApp
        </p>
      </motion.div>
    </section>
  )
}
