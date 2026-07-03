import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'
import { APP_URL } from '../../../lib/config'

export const metadata: Metadata = {
  title: 'Summariser — Condense Documents into 5 Summary Formats',
  description:
    'HumaniseAI\'s Summariser condenses long documents into Key Points, Executive Summaries, Abstracts, TL;DRs, or Meeting Notes. Fast, accurate, and free to try.',
  alternates: { canonical: 'https://humaniseai.co.za/tools/summariser' },
  openGraph: { url: 'https://humaniseai.co.za/tools/summariser' },
}

const MODES = [
  { name: 'Key Points',        desc: 'Numbered bullet list of the most important ideas.' },
  { name: 'Executive Summary', desc: 'Concise professional overview for decision-makers.' },
  { name: 'Abstract',          desc: 'Academic-style summary for papers and dissertations.' },
  { name: 'TL;DR',             desc: 'Single-paragraph distillation of the entire document.' },
  { name: 'Meeting Notes',     desc: 'Action items and decisions extracted from transcripts.' },
]

const FAQ = [
  {
    q: 'How long does summarising take?',
    a: 'Most documents are summarised in under 5 seconds. Longer documents (5,000+ words) may take up to 15 seconds. The output length scales with the selected mode — Short, Medium, or Detailed.',
  },
  {
    q: 'Can I summarise academic papers and dissertations?',
    a: 'Yes. The Abstract mode produces a concise, scholarly summary suitable for academic work. Paste the full text of your paper and get a structured abstract in seconds.',
  },
  {
    q: 'What is the difference between Short, Medium, and Detailed output?',
    a: 'Short targets roughly 10–15% of the original word count. Medium targets 25–30%. Detailed targets 40–45%. A live word projection shows you the estimated output length before you click Summarise.',
  },
]

export default function SummariserPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(99,102,241,0.1),transparent)]" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-5">
              ≡ Summariser
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Condense Any Document<br />
              <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Into 5 Summary Formats
              </span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              From lengthy research papers to meeting transcripts — choose your summary mode and length, and get a precisely structured output in seconds.
            </p>
            <Link
              href={APP_URL}
              className="inline-block px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Try Summariser free
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-white mb-6">5 summary modes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {MODES.map(({ name, desc }) => (
              <div key={name} className="p-4 rounded-xl bg-[#141926] border border-[#1e2740]">
                <p className="font-semibold text-indigo-400 mb-1">{name}</p>
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
