import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'
import { APP_URL } from '../../lib/config'

export const metadata: Metadata = {
  title: 'Pricing — Affordable AI Writing Tools in ZAR',
  description:
    'HumaniseAI pricing plans in South African Rand. Free tier with 5,000 words/month. Pro from R149/month with unlimited words across all 6 tools.',
  alternates: { canonical: 'https://humaniseai.co.za/pricing' },
  openGraph: { url: 'https://humaniseai.co.za/pricing' },
}

const PLANS = [
  {
    name: 'Free',
    price: 'R0',
    period: 'forever',
    description: 'Perfect for trying out HumaniseAI.',
    highlight: false,
    cta: 'Get started free',
    href: `${APP_URL}/register`,
    features: [
      '5,000 words / month',
      'All 6 tools included',
      'Standard processing speed',
      'Basic export (copy & paste)',
    ],
  },
  {
    name: 'Pro',
    price: 'R149',
    period: 'per month',
    description: 'For students and professionals who write daily.',
    highlight: true,
    cta: 'Start Pro free for 7 days',
    href: `${APP_URL}/register?plan=pro`,
    features: [
      'Unlimited words',
      'All 6 tools included',
      'Priority processing',
      'Download as .txt / .docx',
      'Usage analytics dashboard',
      'Email support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'R250',
    period: 'per month',
    description: 'For teams, agencies, and high-volume users.',
    highlight: false,
    cta: 'Contact us',
    href: 'mailto:support@humaniseai.co.za',
    features: [
      'Everything in Pro',
      'API access',
      'Team seats (up to 5)',
      'Dedicated support',
      'Custom word limits',
      'Invoice billing',
    ],
  },
]

const FAQ = [
  {
    q: 'Do I need a credit card to sign up?',
    a: 'No. The Free tier is completely free, no card required. You only need payment details when upgrading to Pro or Enterprise.',
  },
  {
    q: 'Can I cancel my Pro subscription at any time?',
    a: 'Yes. Cancel anytime from your account settings. You keep Pro access until the end of your billing period.',
  },
  {
    q: 'Do all 6 tools count against the same word limit?',
    a: 'Yes. Your monthly word quota is shared across all tools — Humaniser, AI Detector, Paraphraser, Grammar, Plagiarism, and Summariser.',
  },
  {
    q: 'Is pricing in South African Rand?',
    a: 'Yes. All prices are in ZAR with no hidden currency conversion fees.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'HumaniseAI',
  description: 'AI text toolkit for South African students and professionals.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'ZAR', availability: 'https://schema.org/InStock' },
    { '@type': 'Offer', name: 'Pro',  price: '149', priceCurrency: 'ZAR', availability: 'https://schema.org/InStock' },
    { '@type': 'Offer', name: 'Enterprise', price: '250', priceCurrency: 'ZAR', availability: 'https://schema.org/InStock' },
  ],
}

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Simple, transparent pricing</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">All prices in South African Rand. No hidden fees. Cancel anytime.</p>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map(({ name, price, period, description, highlight, cta, href, features }) => (
              <div
                key={name}
                className={`relative rounded-2xl p-6 border flex flex-col ${
                  highlight
                    ? 'bg-gradient-to-b from-violet-500/10 to-indigo-500/10 border-violet-500/40 ring-1 ring-violet-500/30'
                    : 'bg-[#141926] border-[#1e2740]'
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold">
                    Most popular
                  </span>
                )}
                <div className="mb-5">
                  <p className="text-sm font-semibold text-slate-400 mb-1">{name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-white">{price}</span>
                    <span className="text-slate-500 text-sm mb-1">/{period}</span>
                  </div>
                  <p className="text-sm text-slate-500">{description}</p>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-opacity ${
                    highlight
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Frequently asked questions</h2>
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
