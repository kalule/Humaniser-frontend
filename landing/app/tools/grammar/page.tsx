import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'
import { APP_URL } from '../../../lib/config'

export const metadata: Metadata = {
  title: 'Grammar Checker — 8-Category Deep Grammar Audit',
  description:
    'HumaniseAI\'s Grammar Checker audits spelling, grammar, punctuation, style, clarity, conciseness, consistency, and tone. Ideal for academic and professional writing in South Africa.',
  alternates: { canonical: 'https://humaniseai.co.za/tools/grammar' },
  openGraph: { url: 'https://humaniseai.co.za/tools/grammar' },
}

const CATEGORIES = [
  { name: 'Spelling',     color: 'text-red-400',    desc: 'Typos, misspellings, and incorrect word forms.' },
  { name: 'Grammar',      color: 'text-red-400',    desc: 'Subject-verb agreement, tense, and sentence structure.' },
  { name: 'Punctuation',  color: 'text-amber-400',  desc: 'Commas, apostrophes, hyphens, and end marks.' },
  { name: 'Style',        color: 'text-blue-400',   desc: 'Passive voice, nominalisations, and readability.' },
  { name: 'Clarity',      color: 'text-blue-400',   desc: 'Vague language, ambiguity, and complex phrasing.' },
  { name: 'Conciseness',  color: 'text-purple-400', desc: 'Wordy phrases, redundancy, and filler words.' },
  { name: 'Consistency',  color: 'text-amber-400',  desc: 'Inconsistent spelling, hyphenation, and capitalisation.' },
  { name: 'Tone',         color: 'text-purple-400', desc: 'Formal vs casual signals for your chosen context.' },
]

const FAQ = [
  {
    q: 'How is this different from Grammarly?',
    a: 'HumaniseAI\'s Grammar Checker is context-aware across 5 writing contexts (General, Academic, Business, Creative, Casual). In Academic mode, passive voice is acceptable and contractions are flagged. In Creative mode, only definite errors are flagged. No one-size-fits-all rules.',
  },
  {
    q: 'Can it check academic writing for South African universities?',
    a: 'Yes. Switch to Academic context and the checker applies scholarly writing rules — flagging contractions, informal phrasing, and ambiguous sentence structures common in student writing.',
  },
  {
    q: 'Does it suggest rewrites or just flag errors?',
    a: 'Both. Every suggestion includes a replacement, alternative options, an explanation of the issue, and a corrected version of the full sentence for context.',
  },
]

export default function GrammarPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(245,158,11,0.1),transparent)]" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-5">
              ✓ Grammar Checker
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Grammar Checking Across<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                8 Error Categories
              </span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              Beyond spelling and grammar — audit your writing for style, clarity, conciseness, consistency, and tone. Context-aware rules that adapt to academic, business, creative, or casual writing.
            </p>
            <Link
              href={APP_URL}
              className="inline-block px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Try Grammar Checker free
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-white mb-6">8 error categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
            {CATEGORIES.map(({ name, color, desc }) => (
              <div key={name} className="flex items-start gap-3 p-4 rounded-xl bg-[#141926] border border-[#1e2740]">
                <span className={`font-bold text-sm mt-0.5 shrink-0 ${color}`}>{name}</span>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-white mb-6">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="p-5 rounded-xl bg-[#141926] border border-[#1e2740]">
                <p className="font-semibold text-white mb-2">{q}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
