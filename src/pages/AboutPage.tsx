import { Building2 } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function AboutPage() {
  useDocumentTitle(
    'About HumaniseAI — Built in South Africa',
    'HumaniseAI is a South African-built AI writing toolkit — an AI humaniser, detector, paraphraser, grammar checker, and summariser in one workspace.',
    '/about',
  )

  return (
    <StaticPageLayout
      icon={Building2}
      badge="About Us"
      title="Built in South Africa, for writers everywhere"
      subtitle="HumaniseAI started as a way to solve a problem writers kept running into: AI-flagged writing that needed to sound natural again."
    >
      <StaticSection heading="Why we built this">
        <p>
          We started HumaniseAI to build focused writing tools that do a small number of jobs well
          instead of trying to do everything. It's tuned for South African English from day one, and
          today it's used by writers everywhere — priced simply in USD.
        </p>
      </StaticSection>

      <StaticSection heading="What we've built so far">
        <p>
          HumaniseAI gives you five focused tools — an AI Humaniser, AI Detector, Paraphraser, Grammar
          Checker, and Summariser — in one clean workspace, with full history and simple USD pricing.
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
