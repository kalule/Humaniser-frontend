import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ArrowRight, ChevronDown,
  Layers, Brain, Zap,
  Lock, RefreshCw, ShieldCheck, Headphones,
  Shield,
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { AnnouncementBanner } from '../components/Landing/AnnouncementBanner'
import { FullSuiteGrid } from '../components/Landing/FullSuiteGrid'
import { FeaturesSection } from '../components/Landing/FeaturesSection'
import { HowItWorks } from '../components/Landing/HowItWorks'
import { SADifferentiators } from '../components/Landing/SADifferentiators'
import { Testimonials } from '../components/Landing/Testimonials'
import { PricingSection } from '../components/Landing/PricingSection'
import { FinalCTA } from '../components/Landing/FinalCTA'

// ── Stats bar ─────────────────────────────────────────────────────────────────
const STATS = [
  { icon: Layers, value: '5', label: 'AI writing tools' },
  { icon: Brain, value: 'Claude AI', label: 'Powered by' },
  { icon: Zap, value: '$10/mo', label: 'Starter plan' },
  { icon: Sparkles, value: '🌍 USD', label: 'Global pricing' },
]

// ── Hero demo panels ───────────────────────────────────────────────────────────

function HumaniserHeroPanel() {
  return (
    <div className="bg-[#0d1117] rounded-xl border border-white/10 shadow-xl shadow-black/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-slate-400" />
          <span className="text-slate-300 text-xs font-medium">AI Humaniser</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-medium">Natural tone</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">Before</p>
          <p className="text-slate-500 text-[11px] leading-snug italic">
            "It is imperative to note that the utilisation of this approach facilitates..."
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20">
          <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 mb-1">After</p>
          <p className="text-slate-200 text-[11px] leading-snug">
            "Worth noting — this approach makes it much easier to..."
          </p>
        </div>
      </div>
    </div>
  )
}

function DetectorHeroPanel() {
  return (
    <div className="bg-[#0d1117] rounded-xl border border-white/10 shadow-xl shadow-black/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex items-center gap-1.5">
          <Shield size={11} className="text-slate-400" />
          <span className="text-slate-300 text-xs font-medium">AI Detector</span>
        </div>
        <span className="text-[10px] text-purple-400 font-medium">Scan complete</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#a78bfa" strokeWidth="3" strokeDasharray="62 100" strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-200">62%</span>
          </div>
          <div>
            <p className="text-[10px] text-slate-200 font-medium">Likely AI-generated</p>
            <p className="text-[9px] text-slate-500">Probabilistic estimate, not a guarantee</p>
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-2">
          <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">Flagged pattern</p>
          <p className="text-[10px] text-slate-300">Repetitive sentence structure, low burstiness</p>
        </div>
      </div>
    </div>
  )
}

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    question: 'What is an AI humanizer?',
    answer:
      'An AI humanizer (or humaniser) rewrites AI-generated text so it reads more naturally, with the rhythm, tone, and phrasing of human writing — while keeping your original meaning intact.',
  },
  {
    question: 'Will my text pass AI detection tools?',
    answer:
      'HumaniseAI is designed to produce text that reads naturally and authentically human. No tool can guarantee 100% bypass rates, but our Heavy rewriting mode significantly reduces AI detection scores across common detectors.',
  },
  {
    question: 'Can an AI detector be completely accurate?',
    answer:
      'No — AI detection is probabilistic, not definitive. Our AI Detector gives you a clear human/AI likelihood score and highlights flagged patterns, but no detector, including ours, can guarantee a certain result.',
  },
  {
    question: 'What is a paraphrasing tool?',
    answer:
      'A paraphrasing tool rewrites sentences and paragraphs in different words while preserving the original meaning — useful for improving clarity, avoiding repetition, or adjusting tone.',
  },
  {
    question: 'What does the Grammar Checker do?',
    answer:
      'It scans your writing for grammar, spelling, punctuation, and clarity issues, and suggests fixes so your final text reads clean and polished.',
  },
  {
    question: 'What is an AI summariser?',
    answer:
      'An AI summariser (or summarizer) condenses long text — articles, reports, documents — into a shorter summary that keeps the key ideas, so you can grasp the content quickly.',
  },
  {
    question: "Can I get a refund if I'm not satisfied?",
    answer:
      "Yes. We offer a 7-day money-back guarantee on all paid plans. If you're not satisfied within your first 7 days, contact our support team and we'll issue a full refund, no questions asked.",
  },
  {
    question: 'What is the monthly word limit?',
    answer:
      'Free plan users get 500 words per month. Pro users get 10,000 words per month. Unlimited users have no cap. Word limits reset on the 1st of every month.',
  },
  {
    question: 'Does HumaniseAI support SA English?',
    answer:
      "Yes — HumaniseAI is tuned for South African English. It writes 'colour' not 'color', 'organise' not 'organize'. Output sounds like it was written here, because it was tuned here.",
  },
  {
    question: 'Can I cancel my subscription at any time?',
    answer:
      'Absolutely. Cancel at any time from your Billing page. Your plan remains active until the end of the current billing period, after which you revert to the Free tier.',
  },
]

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#e0e0da] rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#f1f5f9] transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-[#1a1a18] pr-4">{question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-[#888888]"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-[#555555] leading-relaxed border-t border-[#e0e0da] pt-3">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main landing page ─────────────────────────────────────────────────────────
export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Scroll to an on-page section when arriving via a hash link (e.g. navbar
  // "How it Works" from a page other than "/", which routes to "/#how-it-works").
  useEffect(() => {
    if (!location.hash) return
    const hash = location.hash
    const timer = setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timer)
  }, [location.hash])

  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    })
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  return (
    <div className="bg-white min-h-screen">
      <AnnouncementBanner />
      <Navbar />

      {/* ── Hero ── */}
      <div
        ref={heroRef}
        className="relative min-h-screen flex items-center overflow-hidden bg-white"
      >
        {/* Bloom orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-purple-100/70 blur-[130px]" />
          <div className="absolute -top-32 right-0 w-[400px] h-[400px] rounded-full bg-indigo-100/50 blur-[110px]" />
        </div>

        {/* Dot grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            opacity: 0.35,
          }}
        />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center gap-8">

          {/* Headline block */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="text-center max-w-3xl"
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-sm font-medium mb-4">
                <Sparkles size={14} />
                AI Writing Tools
              </span>
            </motion.div>

            <motion.h1
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.5 }}
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-[#1a1a18] mb-4"
            >
              Write Better.{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
                Sound More Human.
              </span>
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.5 }}
              className="text-[#555555] text-lg leading-relaxed"
            >
              Humaniser gives you five focused AI writing tools to make your writing more natural,
              clear, and polished — humanise, detect, paraphrase, check grammar, and summarise.
            </motion.p>
          </motion.div>

          {/* Dual hero demo panels */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="w-full relative"
          >
            <div
              className="absolute -inset-12 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(99,102,241,0.1) 0%, transparent 70%)',
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              <HumaniserHeroPanel />
              <DetectorHeroPanel />
            </div>
          </motion.div>

          {/* Stats + CTAs + trust */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}
            className="flex flex-col items-center gap-4 text-center w-full"
          >
            {/* Stats bar */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4 }}
            >
              <div
                className="inline-flex flex-wrap justify-center sm:flex-nowrap items-center gap-6 sm:gap-8 bg-white border border-[#e0e0da] rounded-2xl px-6 py-3 shadow-sm"
                role="list"
              >
                {STATS.map(({ icon: Icon, value, label }, i) => (
                  <div key={label} className="flex items-center gap-2 text-sm" role="listitem">
                    {i > 0 && <div className="hidden sm:block w-px h-4 bg-[#e0e0da]" />}
                    <div className="w-7 h-7 rounded-lg bg-[#ede9fe] flex items-center justify-center">
                      <Icon size={14} className="text-[#7c3aed]" />
                    </div>
                    <span className="font-bold text-[#1a1a18]">{value}</span>
                    <span className="text-[#888888] hidden sm:inline">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link to="/register">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold bg-[#7c3aed] hover:bg-[#4c1d95] text-white transition-colors shadow-lg shadow-violet-200"
                >
                  Start Writing Free
                  <ArrowRight size={16} />
                </motion.button>
              </Link>
              <Link
                to="/features"
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-medium text-[#555555] hover:text-[#1a1a18] border border-[#d1d5db] hover:border-[#7c3aed] bg-white transition-all"
              >
                Explore All Tools
              </Link>
            </motion.div>

            {/* Pricing anchor */}
            <motion.p
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              className="text-[#888888] text-sm"
            >
              Free plan available · Starter from{' '}
              <span className="text-[#555555] font-medium">$10/month</span>
              {' '}· No credit card required
            </motion.p>

            {/* Trust bar */}
            <motion.div
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2"
              aria-label="Trust signals"
            >
              {[
                { icon: Lock, label: 'SSL Encrypted' },
                { icon: RefreshCw, label: '7-Day Money-Back' },
                { icon: ShieldCheck, label: 'POPIA Compliant' },
                { icon: Headphones, label: '🇿🇦 Local Support' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-xs text-[#888888]">
                  <Icon size={12} />
                  {label}
                </span>
              ))}
            </motion.div>
          </motion.div>

        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[#888888]"
          aria-hidden="true"
        >
          <span className="text-xs">Scroll to explore</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ChevronDown size={16} />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Five core services ── */}
      <FullSuiteGrid />

      {/* ── Why they work together ── */}
      <FeaturesSection />

      {/* ── How it works ── */}
      <HowItWorks />

      {/* ── SA differentiators ── */}
      <SADifferentiators />

      {/* ── Social proof ── */}
      <Testimonials />

      {/* ── Pricing ── */}
      <PricingSection />

      {/* ── FAQ ── */}
      <section className="py-20 px-4 bg-white border-y border-[#e0e0da]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-xs font-semibold mb-4 tracking-wide">
              FAQ
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a18]">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      <FinalCTA />
      <Footer />
    </div>
  )
}

export default LandingPage
