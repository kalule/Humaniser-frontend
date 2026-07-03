import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'
import { APP_URL } from '../../../lib/config'

export const metadata: Metadata = {
  title: 'Plagiarism Checker — Inline Source Matching & Originality Score',
  description:
    'HumaniseAI\'s Plagiarism Checker scans billions of sources and highlights matching text inline. Get an originality score and full source list. Trusted by South African students.',
  alternates: { canonical: 'https://humaniseai.co.za/tools/plagiarism' },
  openGraph: { url: 'https://humaniseai.co.za/tools/plagiarism' },
}

const FAQ = [
  {
    q: 'How does the inline highlight work?',
    a: 'After scanning, exact copies are highlighted in red, paraphrased matches in amber, and structural similarities in purple — directly within your original text. You can see at a glance which sentences match which sources.',
  },
  {
    q: 'What sources does it check against?',
    a: 'HumaniseAI checks against billions of web pages, academic journals, news articles, and publicly available documents. The source list shows the URL, matched percentage, and match type for every flagged source.',
  },
  {
    q: 'Is this suitable for checking university assignments in South Africa?',
    a: 'Yes. The checker is calibrated for academic integrity use cases. It distinguishes exact copies from paraphrased content, helping students understand which sections need citation or rewriting before submission.',
  },
]

export default function PlagiarismPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(244,63,94,0.1),transparent)]" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-5">
              ◎ Plagiarism Checker
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Know Exactly What Matches —<br />
              <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
                Source by Source
              </span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              Not just a percentage. HumaniseAI shows you the exact sentences that match external sources, colour-coded by match type, with a full ranked source list and originality score.
            </p>
            <Link
              href={APP_URL}
              className="inline-block px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Try Plagiarism Checker free
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-16">
            {[
              { title: 'Inline highlights', desc: 'Exact, paraphrased, and structural matches colour-coded directly in your text.' },
              { title: 'Originality score', desc: 'A single percentage showing how much of your text is original.' },
              { title: 'Full source list',  desc: 'Every matched source ranked by similarity with URL and match type.' },
            ].map(({ title, desc }) => (
              <div key={title} className="p-5 rounded-xl bg-[#141926] border border-[#1e2740]">
                <p className="font-semibold text-white mb-2">{title}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
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
