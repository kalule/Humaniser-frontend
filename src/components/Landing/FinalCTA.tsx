import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export function FinalCTA() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-24 px-4 relative overflow-hidden">

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-2xl mx-auto"
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-6">
          <Sparkles size={26} className="text-white" />
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
          Start humanising for free today
        </h2>

        <p className="text-slate-400 text-base leading-relaxed mb-8">
          Join writers across South Africa who use HumaniseAI to make their content sound
          authentic, natural, and genuinely human.
        </p>

        <Link to="/register">
          <button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-indigo-900/40">
            Create Free Account
            <ArrowRight size={18} />
          </button>
        </Link>

        <p className="mt-4 text-sm text-slate-500">
          No credit card · Cancel anytime · SA support via WhatsApp
        </p>
      </motion.div>
    </section>
  )
}
