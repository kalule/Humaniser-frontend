import { Building2 } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function AboutPage() {
  useDocumentTitle(
    'About HumaniseAI — Built in South Africa',
    'HumaniseAI is a South African-built AI toolkit for students and researchers, combining an AI humaniser and detector with a full academic research suite.',
    '/about',
  )

  return (
    <StaticPageLayout
      icon={Building2}
      badge="About Us"
      title="Built in South Africa, for South African students"
      subtitle="HumaniseAI started as a way to solve two problems local students and researchers kept running into: AI-flagged writing, and slow, expensive research tooling."
    >
      <StaticSection heading="Why we built this">
        <p>
          Most AI writing and detection tools are built for a US or UK market — priced in dollars, tuned for
          American English, and disconnected from the actual research workflow a student or academic goes
          through. We built HumaniseAI to close that gap: tools that speak South African English, price in
          ZAR, and cover the full journey from a research question to a finished, cited submission.
        </p>
      </StaticSection>

      <StaticSection heading="What we've built so far">
        <p>
          The platform now spans 16 tools across two pillars — Writing &amp; Editing (AI Humaniser, AI
          Detector, Paraphraser, Grammar Checker, Source Check, Summariser) and Research &amp; Study
          (Proposal Studio, Data Analyst, Document Chat, Citations, Flashcards, Lecture Notes) — backed by a
          shared workspace for organising papers, sources, and documents.
        </p>
      </StaticSection>

      <StaticSection heading="Where we're headed">
        <p>
          We're a small, South African-based team shipping quickly. If there's a tool or workflow you wish
          existed, we want to hear about it — reach out through our{' '}
          <a href="/contact" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Contact page
          </a>
          .
        </p>
      </StaticSection>
    </StaticPageLayout>
  )
}

export default AboutPage
