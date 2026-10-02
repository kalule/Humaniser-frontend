import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, ShieldCheck, Flag } from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PUBLIC_TOOLS, PUBLIC_TOOL_COUNT } from '../data/toolsCatalog'
import { cn } from '../lib/utils'

const SITE_URL = 'https://humaniseai.co.za'

const TRUST_ROW = [
  { icon: Flag, label: 'Built in South Africa 🇿🇦' },
  { icon: ShieldCheck, label: 'POPIA & GDPR compliant' },
  { icon: Sparkles, label: 'Powered by Claude AI' },
]

export default function FeaturesPage() {
  useDocumentTitle(
    'AI Humaniser, Detector, Paraphraser, Grammar Checker & Summariser | HumaniseAI',
    `Five focused AI writing tools in one place: humanise AI text, detect AI-generated content, paraphrase, check grammar, and summarise long text. Free plan available.`,
    '/features',
  )

  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'HumaniseAI Writing Tools',
      description: `${PUBLIC_TOOL_COUNT} AI writing tools: humanise, detect, paraphrase, check grammar, and summarise text.`,
      itemListElement: PUBLIC_TOOLS.map((tool, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: tool.label,
        description: tool.desc,
        url: `${SITE_URL}${tool.to}`,
      })),
    })
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <div className="border-b border-[#e0e0da] bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-medium mb-5">
                <Sparkles size={13} />
                {PUBLIC_TOOL_COUNT} Focused AI Writing Tools
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-pri mb-3">
                Every Tool You Need to Write Better
              </h1>
              <p className="text-text-sec text-base max-w-2xl mx-auto mb-8">
                Humanise, detect, paraphrase, check grammar, and summarise — five focused tools,
                one clean workspace. Built in South Africa, used by writers everywhere.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                {TRUST_ROW.map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-xs text-[#888888]">
                    <Icon size={13} />
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Tools grid */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PUBLIC_TOOLS.map((tool, i) => (
              <motion.div
                key={tool.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <Link
                  to={tool.to}
                  className="group flex flex-col h-full rounded-2xl border border-[#e0e0da] bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mb-3', tool.iconBg)}>
                    <tool.icon size={16} className={tool.iconColor} />
                  </div>
                  <h3 className="text-sm font-semibold text-text-pri mb-1.5 group-hover:text-[#7c3aed] transition-colors">
                    {tool.label}
                  </h3>
                  <p className="text-xs text-text-sec leading-relaxed mb-4 flex-1">
                    {tool.longDesc}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 group-hover:text-indigo-700 transition-colors">
                    Try it free
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="border-t border-[#e0e0da] bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-text-pri mb-3">
              Ready to try all {PUBLIC_TOOL_COUNT} tools?
            </h2>
            <p className="text-text-sec text-sm mb-6">
              Start free — no credit card required.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors duration-150"
            >
              Get Started Free
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
