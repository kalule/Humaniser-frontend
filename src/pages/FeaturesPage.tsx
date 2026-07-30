import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Globe2, ShieldCheck, Flag } from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { TOOL_CATEGORIES, TOOL_COUNT } from '../data/toolsCatalog'
import { cn } from '../lib/utils'

const SITE_URL = 'https://humaniseai.co.za'

const TRUST_ROW = [
  { icon: Flag, label: 'Built in South Africa 🇿🇦' },
  { icon: Globe2, label: 'Used by researchers worldwide' },
  { icon: ShieldCheck, label: 'POPIA & GDPR compliant' },
  { icon: Sparkles, label: 'Powered by Claude AI' },
]

export default function FeaturesPage() {
  useDocumentTitle(
    `All ${TOOL_COUNT} AI Tools — Humaniser, Detector, Proposal Studio & More | HumaniseAI`,
    `Explore every HumaniseAI tool. Built first for South African students and researchers with local ZAR pricing and POPIA compliance — now used by writers and researchers worldwide. AI Humaniser, AI Detector, Proposal Studio, Data Analyst, Citations, and ${TOOL_COUNT - 5} more, all in one workspace.`,
    '/features',
  )

  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'HumaniseAI Tools',
      description: `${TOOL_COUNT} AI writing and research tools for South African and global students and researchers.`,
      itemListElement: TOOL_CATEGORIES.flatMap((cat) => cat.tools).map((tool, i) => ({
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
                {TOOL_COUNT} AI & Research Tools
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-pri mb-3">
                Every AI Writing &amp; Research Tool, in One Workspace
              </h1>
              <p className="text-text-sec text-base max-w-2xl mx-auto mb-8">
                Built first for South African students and researchers — local ZAR pricing, POPIA-compliant,
                and used every day for essays, theses, and dissertations. Now trusted by writers and
                researchers around the world.
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

        {/* Category quick-nav */}
        <div className="border-b border-[#e0e0da] bg-white sticky top-16 z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-center gap-2">
            {TOOL_CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e0e0da] text-xs font-medium text-text-sec hover:text-text-pri hover:border-[#d1d5db] hover:bg-[#f5f5f3] transition-colors"
              >
                <cat.icon size={12} className={cat.headerColor} />
                {cat.label}
                <span className="text-[#b0b0a8]">{cat.tools.length}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-16">
          {TOOL_CATEGORIES.map((cat) => (
            <section key={cat.id} id={cat.id} className="scroll-mt-32">
              <div className="flex items-start gap-3 mb-6">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cat.headerBg)}>
                  <cat.icon size={17} className={cat.headerColor} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-pri">{cat.label}</h2>
                  <p className="text-sm text-text-sec">{cat.blurb}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.tools.map((tool, i) => (
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
                      <div className="flex items-center gap-2 mb-3">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tool.iconBg)}>
                          <tool.icon size={16} className={tool.iconColor} />
                        </div>
                        {tool.badge && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#ede9fe] text-[#5b21b6] text-[10px] font-semibold">
                            {tool.badge}
                          </span>
                        )}
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
            </section>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="border-t border-[#e0e0da] bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-text-pri mb-3">
              Ready to try all {TOOL_COUNT} tools?
            </h2>
            <p className="text-text-sec text-sm mb-6">
              Start free — no credit card required. Local pricing for South African students,
              open to researchers and writers everywhere.
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
