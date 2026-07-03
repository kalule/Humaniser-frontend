import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { APP_URL } from '../lib/config'

export const metadata: Metadata = {
  title: 'HumaniseAI — Make AI Text Sound Human | Free AI Humaniser South Africa',
  description:
    "South Africa's #1 AI text toolkit. Humanise AI writing, detect AI content, paraphrase, check grammar, scan plagiarism, and summarise. Free tier available.",
  alternates: { canonical: 'https://humaniseai.co.za' },
  openGraph: {
    title: 'HumaniseAI — Make AI Text Sound Human',
    description: "South Africa's elite 6-tool AI text workspace. Free tier, unlimited words on Pro.",
    url: 'https://humaniseai.co.za',
  },
}

/*
 * Light-theme color reference (platform tokens from src/index.css):
 *   Page bg      #f5f5f3   (--surface-page)
 *   Card         #ffffff   (--surface-card)
 *   Section alt  #f1f5f9   (--surface-section)
 *   Text primary #1a1a18   (--text-primary)
 *   Text sec     #555555   (--text-secondary)
 *   Text muted   #888888   (--text-muted)
 *   Brand purple #7c3aed   (--color-purple)
 *   Purple tint  #ede9fe   (--color-purple-tint)
 *   Purple dark  #5b21b6   (--color-purple-text)
 *   Green text   #065f46   (--color-green-text)
 *   Green tint   #d1fae5   (--color-green-tint)
 *   Red text     #991b1b   (--color-red-text)
 *   Red tint     #fee2e2   (--color-red-tint)
 *   Border h     #e0e0da   (--border-hairline)
 *   Border s     #d1d5db   (--border-strong)
 */

const TOOLS = [
  {
    href: '/tools/humaniser',
    chipBg: 'bg-violet-100',
    chipText: 'text-violet-700',
    icon: '✦',
    title: 'AI Humaniser',
    desc: 'Transform robotic AI output into natural, undetectable human prose. Preserve your original meaning while bypassing AI detectors.',
  },
  {
    href: '/tools/ai-detector',
    chipBg: 'bg-blue-100',
    chipText: 'text-blue-700',
    icon: '⬡',
    title: 'AI Detector',
    desc: 'Forensic-grade detection with sentence-level heatmaps. Identify AI-generated content with per-sentence confidence scores.',
  },
  {
    href: '/tools/paraphraser',
    chipBg: 'bg-emerald-100',
    chipText: 'text-emerald-700',
    icon: '↻',
    title: 'Paraphraser',
    desc: 'Rewrite text in 7 distinct tones — Academic, Formal, Creative, Simple, Fluent, Expanded, or Shortened — with full context preservation.',
  },
  {
    href: '/tools/grammar',
    chipBg: 'bg-amber-100',
    chipText: 'text-amber-700',
    icon: '✓',
    title: 'Grammar Checker',
    desc: 'Deep contextual grammar auditing across 8 error categories including style, clarity, conciseness, consistency, and tone.',
  },
  {
    href: '/tools/plagiarism',
    chipBg: 'bg-rose-100',
    chipText: 'text-rose-700',
    icon: '◎',
    title: 'Plagiarism Checker',
    desc: 'Cross-reference your text against billions of web pages and academic sources. Inline highlights show exactly what matches.',
  },
  {
    href: '/tools/summariser',
    chipBg: 'bg-indigo-100',
    chipText: 'text-indigo-700',
    icon: '≡',
    title: 'Summariser',
    desc: 'Condense long documents into Key Points, Executive Summaries, Abstracts, TL;DRs, or Meeting Notes in seconds.',
  },
]

const STATS = [
  { value: '6',    label: 'Integrated tools'    },
  { value: '50k+', label: 'Documents processed' },
  { value: '4.9★', label: 'Average rating'      },
  { value: 'ZAR',  label: 'Local pricing'       },
]

const STEPS = [
  {
    step: '01',
    icon: '📋',
    title: 'Paste your text',
    desc: 'Drop in any AI-generated content — essays, reports, emails, any length.',
    accent: 'violet' as const,
  },
  {
    step: '02',
    icon: '✨',
    title: 'Click Humanise',
    desc: 'Our model rewrites your text to sound natural and bypass AI detectors.',
    accent: 'violet' as const,
  },
  {
    step: '03',
    icon: '✅',
    title: 'Use your text',
    desc: 'Copy, download, or send directly to your document. Done in seconds.',
    accent: 'emerald' as const,
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'HumaniseAI',
  url: 'https://humaniseai.co.za',
  operatingSystem: 'All',
  applicationCategory: 'BusinessApplication',
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '1240' },
  offers: { '@type': 'AggregateOffer', priceCurrency: 'ZAR', lowPrice: '0', highPrice: '250', offerCount: '3' },
  description: 'An elite 6-tool AI text workspace: AI Humaniser, Forensic Detector, Contextual Paraphraser, Grammar Auditor, Plagiarism Scanner, and Hierarchical Summariser.',
  featureList: ['AI Humaniser', 'AI Detector', 'Paraphraser', 'Grammar Checker', 'Plagiarism Checker', 'Summariser'],
  inLanguage: 'en-ZA',
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main className="flex-1">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        {/* Light page bg (#f5f5f3) with soft purple bloom orbs matching login page */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-purple-100/70 blur-[130px]" />
            <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-indigo-100/50 blur-[110px]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-sm font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-[#7c3aed] animate-pulse" />
              South Africa&apos;s #1 AI Text Toolkit
            </div>

            {/* Headline — primary on light (#1a1a18); gradient preserved on accent word */}
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold text-[#1a1a18] leading-[1.04] tracking-tight mb-7">
              Make AI Text Sound<br />
              <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Genuinely Human
              </span>
            </h1>

            {/* Subtitle — secondary text (#555555) */}
            <p className="text-xl sm:text-2xl text-[#555555] leading-relaxed max-w-3xl mx-auto mb-10">
              One premium workspace with 6 powerful text tools — humanise, detect, paraphrase, grammar-check, plagiarism-scan, and summarise. Built for South African students, professionals, and creators.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
              {/* Primary — solid brand purple (same as login "Sign in" button) */}
              <Link
                href={`${APP_URL}/register`}
                className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-[#7c3aed] text-white font-semibold text-lg hover:bg-[#4c1d95] transition-colors shadow-md shadow-violet-200"
              >
                Start free — no card needed
              </Link>
              {/* Secondary — outlined, dark text on light bg */}
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-10 py-4 rounded-2xl border border-[#d1d5db] text-[#555555] font-semibold text-lg hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors bg-white"
              >
                See pricing
              </Link>
            </div>
            <p className="text-sm text-[#888888]">Free tier includes 5,000 words/month across all tools.</p>
          </div>

          {/* ── Product mockup: Humaniser before/after ──────────────────────
              Intentionally kept dark — floating product window on light page,
              Stripe/Vercel pattern. Drop shadow creates depth on white bg.     */}
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
            <div className="relative rounded-2xl overflow-hidden border border-[#d1d5db] shadow-[0_32px_80px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
              {/* Window chrome — dark */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1e2740] bg-[#080c16]">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                <span className="ml-4 text-xs text-slate-500 font-mono">humaniseai.co.za — Humaniser</span>
              </div>

              {/* Panel header row — dark */}
              <div className="flex items-center border-b border-[#1e2740] bg-[#0d1220]">
                <div className="flex-1 flex items-center justify-between px-8 py-4 border-r border-[#1e2740]">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">AI Text (Input)</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-red-500/15 text-red-400 font-semibold border border-red-500/20">18% Human</span>
                </div>
                <div className="flex-1 flex items-center justify-between px-8 py-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Human Text (Output)</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20">91% Human</span>
                </div>
              </div>

              {/* Before / After text — dark */}
              <div className="grid grid-cols-2 divide-x divide-[#1e2740] bg-[#0b0f1a]">
                <div className="p-8">
                  <p className="text-base text-slate-500 leading-8">
                    Furthermore, it is imperative to underscore that the utilization of advanced natural language processing algorithms facilitates the generation of contextually relevant textual outputs that align with specified parameters and objectives. The aforementioned system demonstrates considerable efficacy in processing linguistic data inputs.
                  </p>
                </div>
                <div className="p-8">
                  <p className="text-base text-slate-200 leading-8">
                    Advanced AI helps create text that actually makes sense in context and meets your goals — without the corporate jargon that makes it obvious a machine wrote it. The system works surprisingly well at handling real-world language data.
                  </p>
                </div>
              </div>

              {/* Action bar — dark */}
              <div className="flex items-center justify-between px-8 py-4 border-t border-[#1e2740] bg-[#080c16]">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-600">Intensity</span>
                  <div className="flex gap-1.5">
                    {['Light', 'Standard', 'Strong'].map((v, i) => (
                      <span
                        key={v}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium ${i === 1 ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30' : 'text-slate-600'}`}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600">287 words</span>
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold">
                    <span>✨</span> Humanise
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ────────────────────────────────────────────────────── */}
        {/* Slightly darker surface than page (#f1f5f9) to create visual tier */}
        <section className="border-y border-[#e0e0da] bg-[#f1f5f9]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <p className="text-4xl font-bold text-[#1a1a18] mb-1.5">{value}</p>
                <p className="text-base text-[#888888]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3 STEPS ──────────────────────────────────────────────────────── */}
        <section className="relative py-28 sm:py-36 overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center mb-20">
              <h2 className="text-4xl sm:text-5xl font-bold text-[#1a1a18] mb-5">
                From AI to Human in 3 Steps
              </h2>
              <p className="text-lg sm:text-xl text-[#555555] max-w-2xl mx-auto">
                No configuration. No learning curve. Paste, click, done.
              </p>
            </div>

            {/* Step cards */}
            <div className="flex flex-col md:flex-row items-start justify-center gap-6 md:gap-0 mb-20">
              {STEPS.map(({ step, icon, title, desc, accent }, idx) => (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center text-center flex-1 max-w-sm px-6">
                    {/* Icon chip — white card with tinted border */}
                    <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-5xl mb-7 bg-white border shadow-sm ${accent === 'emerald' ? 'border-emerald-200 shadow-emerald-100' : 'border-violet-200 shadow-violet-100'}`}>
                      {icon}
                    </div>
                    <div className={`text-sm font-bold uppercase tracking-widest mb-3 ${accent === 'emerald' ? 'text-emerald-700' : 'text-[#7c3aed]'}`}>
                      Step {step}
                    </div>
                    <h3 className="text-2xl font-bold text-[#1a1a18] mb-3">{title}</h3>
                    <p className="text-base text-[#555555] leading-relaxed">{desc}</p>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className="hidden md:flex items-center justify-center shrink-0 px-4 mt-12">
                      <svg className="w-8 h-8 text-[#d1d5db]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* THE BIG STAT — white card, subtle violet border, strong shadow */}
            <div className="mx-auto max-w-3xl">
              <div className="bg-white rounded-3xl border border-[#e0e0da] shadow-xl p-12 text-center">
                <p className="text-sm font-semibold text-[#888888] uppercase tracking-widest mb-8">
                  Average result across 50,000+ documents
                </p>
                <div className="flex items-center justify-center gap-10 sm:gap-16 mb-8">
                  <div>
                    {/* Red stat — #991b1b (--color-red-text) on white: 8.0:1, passes AAA */}
                    <div className="text-6xl sm:text-7xl font-black text-[#991b1b] leading-none mb-3">18%</div>
                    <p className="text-sm text-[#888888] font-medium">Human score before</p>
                  </div>
                  <div className="text-4xl text-[#d1d5db] font-thin">→</div>
                  <div>
                    {/* Green stat — #065f46 (--color-green-text) on white: 9.1:1, passes AAA */}
                    <div className="text-6xl sm:text-7xl font-black text-[#065f46] leading-none mb-3">91%</div>
                    <p className="text-sm text-[#888888] font-medium">Human score after</p>
                  </div>
                </div>
                <p className="text-base text-[#555555]">
                  Verified against GPTZero, Turnitin, Copyleaks, and Originality.ai
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ── AI DETECTOR DEMO ─────────────────────────────────────────────── */}
        {/*
         *  DARK ANCHOR SECTION: the product mockup panel intentionally stays dark
         *  (browser-chrome style floating window). Text content around it is light-theme.
         *  Pattern: Stripe/Vercel floating dark UI on white marketing page.
         */}
        <section className="relative py-28 sm:py-36 overflow-hidden border-t border-[#e0e0da]">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-center">

              {/* Text column — light theme */}
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold mb-7">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Forensic AI Detection
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold text-[#1a1a18] mb-6 leading-[1.1]">
                  Know exactly how human your text sounds
                </h2>
                <p className="text-lg text-[#555555] leading-relaxed mb-10">
                  Sentence-level heatmaps show you precisely which phrases read as AI-written. Not just a total score — a forensic breakdown with per-sentence confidence you can actually act on.
                </p>
                <ul className="space-y-4 mb-10">
                  {[
                    'Sentence-by-sentence confidence scores',
                    'Color-coded AI probability heatmap',
                    'Instant 0–100% human score',
                    'Works on essays, articles, emails, and reports',
                  ].map(f => (
                    <li key={f} className="flex items-start gap-3 text-[#1a1a18] text-base">
                      {/* Checkmark chip — green tint (#d1fae5) with green text (#065f46) */}
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-[#d1fae5] border border-emerald-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#065f46] text-xs font-bold">✓</span>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`${APP_URL}/register`}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#7c3aed] text-white font-semibold text-base hover:bg-[#4c1d95] transition-colors"
                >
                  Try AI Detector free →
                </Link>
              </div>

              {/* Demo mockup — STAYS DARK (intentional accent per spec) */}
              <div className="relative">
                {/* Drop shadow creates floating effect on light page */}
                <div className="relative rounded-2xl overflow-hidden border border-[#d1d5db] shadow-[0_24px_64px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.06)]">

                  {/* Window chrome — dark */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2740] bg-[#080c16]">
                    <span className="text-sm font-semibold text-white">AI Detector</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                      <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                      <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                    </div>
                  </div>

                  {/* Content — dark */}
                  <div className="p-7 bg-[#0b0f1a]">
                    {/* Score ring */}
                    <div className="flex items-center gap-5 mb-7 p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <div className="w-20 h-20 rounded-full border-[3px] border-emerald-500 flex items-center justify-center shrink-0">
                        <span className="text-2xl font-black text-emerald-400">91%</span>
                      </div>
                      <div>
                        <p className="text-base font-bold text-emerald-400 mb-1">Mostly Human</p>
                        <p className="text-sm text-slate-500">Score: 91/100 — low AI probability detected</p>
                      </div>
                    </div>

                    {/* Sentence heatmap */}
                    <div className="text-[15px] leading-[2.2] text-slate-300 mb-6">
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200">
                        Advanced AI helps create text that actually makes sense in context
                      </span>
                      {' '}
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200">
                        and meets your goals without the jargon.
                      </span>
                      {' '}
                      <span className="px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-200">
                        It is important to note that utilization of such systems may facilitate enhanced productivity outcomes.
                      </span>
                      {' '}
                      <span className="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-200">
                        Furthermore, it is imperative to underscore that the utilization of advanced NLP algorithms facilitates contextually relevant textual outputs.
                      </span>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-5 pt-5 border-t border-[#1e2740]">
                      <span className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="w-3.5 h-3.5 rounded bg-emerald-500/40" />Human
                      </span>
                      <span className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="w-3.5 h-3.5 rounded bg-yellow-500/40" />Uncertain
                      </span>
                      <span className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="w-3.5 h-3.5 rounded bg-red-500/40" />AI
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── FEATURE GRID ─────────────────────────────────────────────────── */}
        {/* Slightly differentiated section surface (#f1f5f9) */}
        <section className="relative py-28 sm:py-36 border-t border-[#e0e0da] bg-[#f1f5f9]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-[#1a1a18] mb-5">
                Everything you need in one workspace
              </h2>
              <p className="text-lg text-[#555555] max-w-2xl mx-auto">
                Six battle-tested tools, one unified dashboard. Switch between tools instantly without losing your work.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {TOOLS.map(({ href, chipBg, chipText, icon, title, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="group block p-8 rounded-2xl bg-white border border-[#e0e0da] shadow-sm hover:shadow-md hover:border-[#d1d5db] transition-all duration-200"
                >
                  {/* Icon chip — soft tinted background, matching icon color */}
                  <div className={`w-14 h-14 rounded-xl ${chipBg} ${chipText} flex items-center justify-center text-3xl font-black mb-5`}>
                    {icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#1a1a18] mb-3 group-hover:text-[#7c3aed] transition-colors">{title}</h3>
                  <p className="text-base text-[#555555] leading-relaxed">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── SOUTH AFRICA ─────────────────────────────────────────────────── */}
        <section className="border-t border-[#e0e0da]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
            <div className="text-5xl mb-6">🇿🇦</div>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#1a1a18] mb-6">Built for South Africa</h2>
            <p className="text-lg sm:text-xl text-[#555555] leading-relaxed max-w-2xl mx-auto mb-12">
              Priced in ZAR. Optimised for Unisa, UCT, Wits, Stellenbosch, and NWU academic guidelines. Lightning-fast with Johannesburg and Cape Town edge nodes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left max-w-4xl mx-auto">
              {[
                { title: 'ZAR Pricing',    desc: 'No dollar conversion surprises. Pay in Rand, see your costs upfront.' },
                { title: 'Local CDN',      desc: 'Sub-50ms TTFB from Johannesburg. No international latency.' },
                { title: 'Academic Ready', desc: 'Calibrated for South African university submission standards.' },
              ].map(({ title, desc }) => (
                <div key={title} className="p-7 rounded-2xl bg-white border border-[#e0e0da] shadow-sm">
                  <p className="text-lg font-bold text-[#1a1a18] mb-2">{title}</p>
                  <p className="text-base text-[#555555] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        {/* Soft purple tint section — distinguishes it from plain white, drives conversion */}
        <section className="relative py-28 sm:py-36 overflow-hidden border-t border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-violet-200/30 blur-[80px]" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl sm:text-5xl font-bold text-[#1a1a18] mb-6">
              Ready to humanise your writing?
            </h2>
            <p className="text-lg sm:text-xl text-[#555555] mb-10 leading-relaxed">
              Join thousands of South African students and professionals using HumaniseAI to write with confidence.
            </p>
            <Link
              href={`${APP_URL}/register`}
              className="inline-block px-12 py-5 rounded-2xl bg-[#7c3aed] text-white font-bold text-xl hover:bg-[#4c1d95] transition-colors shadow-lg shadow-violet-200"
            >
              Get started free
            </Link>
            <p className="mt-5 text-sm text-[#888888]">Free tier — no credit card required.</p>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
