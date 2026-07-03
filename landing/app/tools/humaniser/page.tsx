import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'
import { APP_URL } from '../../../lib/config'

export const metadata: Metadata = {
  title: 'AI Humaniser — Make AI Text Undetectable & Natural',
  description:
    'HumaniseAI\'s AI Humaniser rewrites AI-generated text to sound natural and human. Bypass Turnitin, GPTZero, and Copyleaks. Trusted by South African students and professionals.',
  alternates: { canonical: 'https://humaniseai.co.za/tools/humaniser' },
  openGraph: { url: 'https://humaniseai.co.za/tools/humaniser' },
}

const FAQ = [
  {
    q: 'How does the AI Humaniser work?',
    a: 'HumaniseAI\'s Humaniser rewrites AI-generated content by altering token probability patterns, sentence burstiness, and lexical diversity — the exact signals AI detectors look for. The result reads naturally and passes major AI detectors including Turnitin and GPTZero.',
  },
  {
    q: 'Will humanised text pass Turnitin AI detection in South Africa?',
    a: 'HumaniseAI is specifically calibrated for tools used at South African universities. Our L1/L2 processing pipeline rewrites content at the semantic level, not just surface synonyms, achieving consistently high human-score results.',
  },
  {
    q: 'Does humanising change my original meaning?',
    a: 'No. The Humaniser preserves your original ideas, arguments, and structure. It only rewrites the phrasing and syntax to sound more natural — your content remains factually intact.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'HumaniseAI — AI Humaniser',
  url: 'https://humaniseai.co.za/tools/humaniser',
  description: 'AI text humaniser that rewrites AI-generated content to sound natural and bypass AI detectors.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'ZAR' },
}

export default function HumaniserPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(139,92,246,0.15),transparent)]" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-5">
              ✦ AI Humaniser
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
              Make AI Text Sound<br />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                Genuinely Human
              </span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              Transform robotic AI output into natural, flowing prose. Alter log-likelihood token distributions, sentence burstiness, and lexical variety — the exact signals AI detectors flag. Used by thousands of South African students and professionals to clear Turnitin, GPTZero, and Copyleaks.
            </p>
            <Link
              href={APP_URL}
              className="inline-block px-8 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20"
            >
              Try AI Humaniser free
            </Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-16">
            {[
              { title: 'Preserve meaning', desc: 'Your ideas, facts, and arguments stay 100% intact. Only phrasing is rewritten.' },
              { title: 'Bypass detectors', desc: 'Calibrated against Turnitin AI, GPTZero, Copyleaks, and Winston AI.' },
              { title: 'Instant results', desc: 'Average processing time under 3 seconds for documents up to 2,000 words.' },
            ].map(({ title, desc }) => (
              <div key={title} className="p-5 rounded-xl bg-[#141926] border border-[#1e2740]">
                <p className="font-semibold text-white mb-2">{title}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="prose prose-invert max-w-none mb-16">
            <h2 className="text-2xl font-bold text-white mb-4">Why AI text needs humanising</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              AI language models generate text with characteristic statistical signatures — uniform perplexity, low burstiness, and predictable token sequences. These patterns are trivially detectable by modern AI detectors. HumaniseAI&apos;s Humaniser dismantles these signatures by restructuring sentences, varying word choice at the semantic level, and introducing the natural rhythm of human writing.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Unlike simple synonym-swapping tools, HumaniseAI understands context. It never changes the meaning of your content — it only changes how that meaning is expressed, producing output that reads naturally to both humans and detectors.
            </p>
          </div>

          {/* FAQ */}
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
