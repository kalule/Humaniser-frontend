import { Briefcase } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function CareersPage() {
  useDocumentTitle(
    'Careers — HumaniseAI',
    'HumaniseAI is a small, South African-based team. See current openings or reach out with a speculative application.',
    '/careers',
  )

  return (
    <StaticPageLayout
      icon={Briefcase}
      badge="Careers"
      title="Join a small South African team"
      subtitle="We're a lean team building AI tools for students and researchers across South Africa."
    >
      <StaticSection heading="Current openings">
        <p>
          There are no open roles right now. We post here first when that changes, so check back — or reach
          out anyway if you think you'd be a strong fit.
        </p>
      </StaticSection>

      <StaticSection heading="Speculative applications">
        <p>
          If you're excited about what we're building, email{' '}
          <a href="mailto:support@humaniseai.co.za" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            support@humaniseai.co.za
          </a>{' '}
          with a short note about what you'd want to work on. We read everything.
        </p>
      </StaticSection>
    </StaticPageLayout>
  )
}

export default CareersPage
