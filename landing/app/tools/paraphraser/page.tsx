import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'
import { APP_URL } from '../../../lib/config'

export const metadata: Metadata = {
  title: 'Paraphraser — Rewrite Text in 7 Tones | Academic, Formal & More',
  description:
    'HumaniseAI\'s Paraphraser rewrites text in Academic, Formal, Creative, Simple, Fluent, Expanded, or Shortened tone. Ideal for South African university assignments and business writing.',
  alternates: { canonical: 'https://humaniseai.co.za/tools/paraphraser' },
  openGraph: { url: 'https://humaniseai.co.za/tools/paraphraser' },
}

const TONES = [
  { name: 'Academic',  desc: 'Scholarly language with precise, formal phrasing.' },
  { name: 'Formal',    desc: 'Professional tone suitable for business documents.' },
  { name: 'Creative',  desc: 'Expressive and engaging with varied sentence structure.' },
  { name: 'Simple',    desc: 'Plain language, short sentences, no jargon.' },
  { name: 'Fluent',    desc: 'Natural reading flow with polished transitions.' },
  { name: 'Expanded',  desc: 'More detail and explanation added to thin content.' },
  { name: 'Shortened', desc: 'Condensed to core meaning, removing redundancy.' },
]

const FAQ = [
  {
    q: 'How is this different from just using a thesaurus?',
    a: 'HumaniseAI paraphrases at the sentence and paragraph level, not just word-for-word synonym replacement. It restructures sentences to fit the chosen tone while preserving the full meaning of the original text.',
  },
  {
    q: 'Is the Academic tone suitable for Unisa and UCT submissions?',
    a: 'Yes. The Academic tone is calibrated to produce scholarly, citation-friendly prose appropriate for South African universities including Unisa, UCT, Wits, and Stellenbosch.',
  },
  {
    q: 'Can I paraphrase long documents?',
    a: 'Pro users get unlimited words. The Free tier allows up to 5,000 words per month shared across all tools. Long documents are processed in full without chunking or truncation.',
  },
]

export default function ParaphraserPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-5">
              ↻ Paraphraser
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Rewrite in Any Tone —<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                7 Styles to Choose From
              </span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              From Academic dissertations to casual emails — choose your tone, paste your text, and get a rewritten version that reads exactly the way you need it to.
            </p>
            <Link
              href={APP_URL}
              className="inline-block px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Try Paraphraser free
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-white mb-6">7 writing tones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {TONES.map(({ name, desc }) => (
              <div key={name} className="p-4 rounded-xl bg-[#141926] border border-[#1e2740]">
                <p className="font-semibold text-emerald-400 mb-1">{name}</p>
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
