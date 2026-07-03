import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ArrowRight, ChevronDown,
  Layers, Brain, Zap,
  Lock, RefreshCw, ShieldCheck, Headphones,
  ScrollText, BarChart2, Upload,
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { AnnouncementBanner } from '../components/Landing/AnnouncementBanner'
import { ProposalPillar } from '../components/Landing/ProposalPillar'
import { DataAnalystPillar } from '../components/Landing/DataAnalystPillar'
import { FullSuiteGrid } from '../components/Landing/FullSuiteGrid'
import { HowItWorks } from '../components/Landing/HowItWorks'
import { SADifferentiators } from '../components/Landing/SADifferentiators'
import { Testimonials } from '../components/Landing/Testimonials'
import { PricingSection } from '../components/Landing/PricingSection'
import { FinalCTA } from '../components/Landing/FinalCTA'

// ── Stats bar ─────────────────────────────────────────────────────────────────
const STATS = [
  { icon: Layers, value: '16', label: 'Research tools' },
  { icon: Brain, value: 'Claude AI', label: 'Powered by' },
  { icon: Zap, value: 'R149/mo', label: 'Pro plan' },
  { icon: Sparkles, value: '🇿🇦 ZAR', label: 'Local pricing' },
]

// ── Hero demo panels ───────────────────────────────────────────────────────────

const HERO_PROPOSAL_CITATIONS = [
  { text: 'Bonanomi et al. (2023). Social media and student wellbeing.', journal: 'J. Educational Psychology, 115(4)' },
  { text: 'Lau (2022). Social media and academic performance in South Africa.', journal: 'Computers & Education, 180' },
  { text: 'Smith & van der Merwe (2021). Digital distraction in higher education.', journal: 'Higher Ed. Research, 40(3)' },
]

const HERO_BARS = [
  { label: 'Strongly Agree', value: 68, color: '#6366f1' },
  { label: 'Agree', value: 24, color: '#818cf8' },
  { label: 'Neutral', value: 5, color: '#334155' },
]

function ProposalHeroPanel() {
  return (
    <div className="bg-[#0d1117] rounded-xl border border-white/10 shadow-xl shadow-black/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex items-center gap-1.5">
          <ScrollText size={11} className="text-slate-400" />
          <span className="text-slate-300 text-xs font-medium">Proposal Studio</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-medium">12 sources</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">Research Proposal</p>
          <p className="text-slate-200 text-[11px] font-semibold leading-snug">
            Social Media Use and Academic Performance Among SA University Students
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">References</p>
            <span className="text-[9px] text-indigo-400 font-medium">APA 7th</span>
          </div>
          {HERO_PROPOSAL_CITATIONS.map((c, i) => (
            <div key={i} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <p className="text-[10px] text-slate-400 leading-snug">{c.text}</p>
              <p className="text-[9px] text-indigo-400/60 mt-0.5 italic">{c.journal}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DataAnalystHeroPanel() {
  return (
    <div className="bg-[#0d1117] rounded-xl border border-white/10 shadow-xl shadow-black/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart2 size={11} className="text-slate-400" />
          <span className="text-slate-300 text-xs font-medium">Data Analyst</span>
        </div>
        <span className="text-[10px] text-purple-400 font-medium">Analysis ready</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <Upload size={12} className="text-purple-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-200 font-medium">survey_responses.csv</p>
            <p className="text-[9px] text-slate-500">247 rows · 8 columns</p>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Survey Agreement</p>
          <div className="space-y-1.5">
            {HERO_BARS.map((bar, i) => (
              <div key={bar.label} className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 w-[70px] text-right shrink-0">{bar.label}</span>
                <div className="flex-1 h-3 bg-slate-800/60 rounded-sm overflow-hidden">
                  <motion.div
                    className="h-full rounded-sm"
                    style={{ backgroundColor: bar.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(bar.value / 68) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[9px] font-mono text-slate-400 w-6 shrink-0">{bar.value}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 px-2.5 py-2">
          <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 mb-0.5">Key Finding</p>
          <p className="text-[10px] text-slate-300">r = 0.71, p &lt; 0.001 — significant positive correlation</p>
        </div>
      </div>
    </div>
  )
}

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    question: 'Will my text pass AI detection tools?',
    answer:
      'HumaniseAI is designed to produce text that reads naturally and authentically human. While no tool can guarantee 100% bypass rates, our Heavy rewriting mode significantly reduces AI detection scores across tools like GPTZero, Turnitin, and Originality.ai.',
  },
  {
    question: 'What exactly counts as "AI text"?',
    answer:
      'AI text is any content generated by large language models like ChatGPT, Claude, Gemini, Copilot, or similar tools. This typically sounds formal, repetitive, or overly structured. HumaniseAI transforms it to sound more natural and human-written.',
  },
  {
    question: "Can I get a refund if I'm not satisfied?",
    answer:
      "Yes. We offer a 7-day money-back guarantee on all paid plans. If you're not satisfied within your first 7 days, contact our support team and we'll issue a full refund, no questions asked.",
  },
  {
    question: 'What are the writing tones?',
    answer:
      'We offer four tones: Casual (friendly, conversational), Professional (polished, business-appropriate), Academic (scholarly, structured), and Conversational (natural dialogue-like flow). Each is tuned for different contexts.',
  },
  {
    question: 'What is the monthly word limit?',
    answer:
      'Free plan users get 500 words per month. Pro users get 10,000 words per month. Unlimited users have no cap. Word limits reset on the 1st of every month.',
  },
  {
    question: 'Does HumaniseAI support SA English?',
    answer:
      "Yes — HumaniseAI is tuned for South African English. It writes 'colour' not 'color', 'organise' not 'organize'. Output sounds like it was written here, because it was tuned here. Afrikaans support is in development.",
  },
  {
    question: 'Can I cancel my subscription at any time?',
    answer:
      'Absolutely. Cancel at any time from your Billing page. Your plan remains active until the end of the current billing period, after which you revert to the Free tier.',
  },
  {
    question: 'How does Proposal Studio find real citations?',
    answer:
      'Proposal Studio searches live academic databases including CrossRef, Semantic Scholar, and Google Scholar. It retrieves metadata for real peer-reviewed papers and formats them in your chosen citation style (APA, Harvard, MLA, and 30+ others).',
  },
  {
    question: 'What file types does Data Analyst support?',
    answer:
      'Data Analyst supports CSV, Excel (.xlsx), and SPSS (.sav) files. R datasets (.rds, .RData) and Jamovi (.omv) files are in active development. You can analyse survey results, experiment data, and quantitative research datasets.',
  },
  {
    question: 'Is the data I upload to Data Analyst kept private?',
    answer:
      'Yes. Uploaded files are processed in a secure, isolated session and never stored permanently or used to train any AI models. Files are deleted automatically after your session ends. We are fully POPIA compliant.',
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
                AI Research Platform
              </span>
            </motion.div>

            {/*
              ⚠️ COPY REVIEW NEEDED — 3 headline options below. Currently rendering Option A.
              Option A: "From Research Question to Finished Analysis"
              Option B: "Your Complete Academic Research Platform"
              Option C: "Research. Write. Analyse. Submit."
            */}
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.5 }}
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-[#1a1a18] mb-4"
            >
              From Research Question{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
                to Finished Analysis
              </span>
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.5 }}
              className="text-[#555555] text-lg leading-relaxed"
            >
              Write proposals with real citations, analyse datasets, and polish your writing —
              everything your research needs, in one place.
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
              <ProposalHeroPanel />
              <DataAnalystHeroPanel />
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
                  Start Your Research Free
                  <ArrowRight size={16} />
                </motion.button>
              </Link>
              <button
                type="button"
                onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-medium text-[#555555] hover:text-[#1a1a18] border border-[#d1d5db] hover:border-[#7c3aed] bg-white transition-all"
              >
                See How It Works
              </button>
            </motion.div>

            {/* Pricing anchor */}
            <motion.p
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              className="text-[#888888] text-sm"
            >
              Free plan available · Pro from{' '}
              <span className="text-[#555555] font-medium">R149/month</span>
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

      {/* ── Flagship sections ── */}
      <ProposalPillar />
      <DataAnalystPillar />

      {/* ── Full suite ── */}
      <FullSuiteGrid />

      {/* ── Research workflow ── */}
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
