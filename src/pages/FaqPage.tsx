import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle, Sparkles, Shield, CreditCard, Settings } from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { cn } from '../lib/utils'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

// ── Data ──────────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string
  a: string
}

interface FaqCategory {
  label: string
  icon: React.ElementType
  color: string
  items: FaqItem[]
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    label: 'General',
    icon: HelpCircle,
    color: 'text-slate-500',
    items: [
      {
        q: 'How does the Humaniser work?',
        a: 'HumaniseAI uses Claude — Anthropic\'s most advanced AI — to rewrite your text so it reads like natural human writing. It analyses your sentence structure, vocabulary, rhythm, and tone, then rewrites the content while preserving your original meaning. The result bypasses AI detectors because it genuinely rewrites the text, not just swaps a few synonyms.',
      },
      {
        q: 'How long does humanisation take?',
        a: 'Under 15 seconds for most documents. HumaniseAI is built for speed — regardless of text length or rewrite level, your result is ready quickly.',
      },
      {
        q: 'Does it work for essays, articles, emails, or just short text?',
        a: 'HumaniseAI works across all formats — essays, research papers, blog posts, emails, professional reports, and social content. The Free plan supports up to 500 words per submission. Pro and Unlimited plans support longer documents up to your monthly word limit.',
      },
      {
        q: 'Does it preserve my formatting (headings, bullet points, etc.)?',
        a: 'Basic paragraph structure is preserved. For the best results, humanise plain text and re-apply your formatting afterwards. Markdown symbols (like **bold** or # headings) can sometimes interfere with the rewrite quality.',
      },
      {
        q: 'What languages does the Humaniser support?',
        a: 'English is the primary supported language and delivers the best results. Other languages may work with reduced accuracy. Full multilingual support is on our roadmap.',
      },
    ],
  },
  {
    label: 'Humaniser',
    icon: Sparkles,
    color: 'text-indigo-600',
    items: [
      {
        q: 'What do the rewrite levels mean?',
        a: 'Levels 1–10 control how aggressively your text is rewritten. Low levels (1–3, "Light Touch") make minimal changes and preserve most of your original phrasing. Mid levels (4–6, "Medium Rewrite") restructure sentences and vary vocabulary. High levels (7–10, "Heavy Rewrite") aggressively rework structure, rhythm, and word choice for maximum humanisation.',
      },
      {
        q: 'Which rewrite level should I start with?',
        a: 'Start at level 6 or 7. If the result is still flagged as AI, increase to 8–10. If the rewrite is altering your meaning too much or feels unnatural, step down to 4–5. Most users find level 7 gives the best balance between humanisation and meaning preservation.',
      },
      {
        q: 'What tone should I choose?',
        a: 'Choose the tone that matches your intended context. Academic is best for essays and research papers — it keeps technical vocabulary intact. Professional suits business writing and reports. Casual works well for blog posts, emails, and social content. Conversational is ideal for anything that needs to feel personal and engaging.',
      },
      {
        q: 'I humanised my text, but it\'s still being detected as AI. Why?',
        a: 'A few reasons this can happen: (1) You\'re using a low rewrite level — try increasing to level 8 or above. (2) The source text was written with heavy AI markers (lots of "Furthermore", "Moreover", transition words, parallel lists) — these are harder to humanise. (3) Different AI detectors use different models and no tool guarantees 100% bypass across all of them. (4) Try re-humanising the output once more using the Re-humanise button.',
      },
      {
        q: 'The output is hard to read, has mistakes, or feels unnatural. How do I fix it?',
        a: 'Try lowering the rewrite level — a level 4–5 Heavy rewrite preserves more of your original meaning. Also check that your source text is clean plain text with no markdown, code blocks, or special characters. Switching to Academic tone can help with technical writing where accuracy matters most.',
      },
      {
        q: 'What AI model should I use to generate my source text?',
        a: 'Any major model works — ChatGPT, Claude, Gemini, Copilot. For best humanisation results, avoid prompting the AI to "be formal", "use transition words", or "write academically". Those instructions produce text with the strongest AI fingerprints, which is harder to humanise. Let the AI write naturally, then humanise the output.',
      },
      {
        q: 'Can I fine-tune individual sentences?',
        a: 'Sentence-level editing is not available yet — HumaniseAI currently humanises the whole document at once. Fine-grained sentence control is planned for a future release.',
      },
      {
        q: 'Why am I seeing a markdown warning?',
        a: 'Your input contains markdown formatting (like **bold**, # headings, or - bullet lists). The Humaniser is optimised for plain text. Remove markdown symbols before humanising and re-apply your formatting to the output for the best result.',
      },
    ],
  },
  {
    label: 'AI Detector',
    icon: Shield,
    color: 'text-emerald-600',
    items: [
      {
        q: 'How does the AI Detector work?',
        a: 'HumaniseAI uses a multi-layer ensemble approach: a statistical layer that measures sentence burstiness, vocabulary richness, and lexical density; a stylometric layer that analyses transition word usage, passive voice, and personal voice; a semantic layer that detects AI bigram patterns; and a Claude AI layer that performs a deep contextual analysis. Scores from all four layers are combined into a single human/AI probability.',
      },
      {
        q: 'What\'s the difference between Standard and Fast mode?',
        a: 'Standard mode runs all four detection layers including the deep semantic analysis, giving you the most accurate result. Fast mode skips the semantic layer for a quicker scan — useful when you need a quick check and don\'t need the full breakdown.',
      },
      {
        q: 'My content is still getting detected. What should I do?',
        a: 'Try these steps in order: (1) Increase the rewrite level to 8–10. (2) Re-humanise the already-humanised output a second time. (3) Add some personal examples, specific details, or a named source to your text before humanising — AI detectors flag abstract generalisations heavily. (4) Switch to a different tone. (5) If a specific sentence is flagged, try manually rephrasing it.',
      },
    ],
  },
  {
    label: 'Plans & Limits',
    icon: CreditCard,
    color: 'text-amber-600',
    items: [
      {
        q: 'What are the word limits on each plan?',
        a: 'Free: 500 words per month — enough to try the tool on shorter texts. Pro: 50,000 words per month — suited for students, writers, and regular users. Unlimited: no word cap — for power users and professionals who need unrestricted access.',
      },
      {
        q: 'Do re-humanisations and detector scans count against my word limit?',
        a: 'Yes — every humanisation, re-humanisation, and AI detector scan consumes words from your monthly limit based on the word count of the text submitted.',
      },
      {
        q: 'Can I create a new free account to get more usage?',
        a: 'No — creating multiple accounts to bypass plan limits violates our Terms of Service and may result in a permanent ban. If you need more words, upgrading to Pro or Unlimited is the right path.',
      },
      {
        q: 'What happens if I hit my word limit mid-document?',
        a: 'Your submission will be blocked when it would push you over your limit. You\'ll see a notification with your current usage and a prompt to upgrade. Your limit resets on the first day of each billing cycle.',
      },
    ],
  },
]

// ── Accordion item ────────────────────────────────────────────────────────────

function AccordionItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="border border-[#e0e0da] rounded-xl overflow-hidden bg-white"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150',
          open ? 'bg-[#f5f5f3]' : 'hover:bg-[#f5f5f3]',
        )}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-text-pri leading-snug">{item.q}</span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-text-sec transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 bg-[#f8fafc] border-t border-[#e0e0da]">
              <p className="text-sm text-text-sec leading-relaxed">{item.a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({ category }: { category: FaqCategory }) {
  const Icon = category.icon

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <Icon size={18} className={category.color} />
        <h2 className="text-base font-semibold text-text-pri">{category.label}</h2>
      </div>
      <div className="space-y-2">
        {category.items.map((item, i) => (
          <AccordionItem key={item.q} item={item} index={i} />
        ))}
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FaqPage() {
  useDocumentTitle(
    'FAQ — AI Humaniser, Detector, Paraphraser & More | HumaniseAI',
    'Answers to common questions about humanising AI text, AI detection, paraphrasing, grammar checking, summarising, pricing, and word limits on HumaniseAI.',
    '/faq',
  )
  const [filter, setFilter] = useState('')

  const filtered = filter.trim()
    ? FAQ_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(filter.toLowerCase()) ||
            item.a.toLowerCase().includes(filter.toLowerCase()),
        ),
      })).filter((cat) => cat.items.length > 0)
    : FAQ_CATEGORIES

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <div className="border-b border-[#e0e0da] bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-medium mb-5">
                <HelpCircle size={13} />
                Help Centre
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-pri mb-3">
                Frequently Asked Questions
              </h1>
              <p className="text-text-sec text-base mb-8">
                Common questions about humanising text and AI detection.
              </p>

              {/* Search */}
              <div className="relative max-w-md mx-auto">
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full bg-white border border-[#e0e0da] rounded-xl px-4 py-3 text-sm text-text-pri placeholder-[#888888] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* FAQ content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-text-sec text-sm">No results for "{filter}"</p>
              <button
                type="button"
                onClick={() => setFilter('')}
                className="mt-3 text-indigo-600 text-sm hover:text-indigo-700 transition-colors"
              >
                Clear search
              </button>
            </motion.div>
          ) : (
            filtered.map((cat) => <CategorySection key={cat.label} category={cat} />)
          )}

          {/* Still stuck */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="rounded-2xl border border-[#e0e0da] bg-[#f8fafc] p-6 text-center"
          >
            <Settings size={22} className="text-[#888888] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-text-pri mb-1">Still have a question?</h3>
            <p className="text-text-sec text-xs mb-4">
              Our support team is available on WhatsApp or email — we typically respond within a few hours.
            </p>
            <a
              href="https://wa.me/27000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors duration-150"
            >
              Contact Support
            </a>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
