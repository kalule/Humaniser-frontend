import { Lightbulb, Mail } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function FeedbackPage() {
  useDocumentTitle(
    'Feature Requests — HumaniseAI',
    'Suggest a feature or improvement for HumaniseAI. We read every request from our South African student and researcher community.',
    '/feedback',
  )

  return (
    <StaticPageLayout
      icon={Lightbulb}
      badge="Feature Requests"
      title="Tell us what to build next"
      subtitle="HumaniseAI is shaped by what our users actually need. If there's a tool, tone, or workflow missing, this is where to tell us."
    >
      <StaticSection heading="How it works">
        <p>
          We don't have a public voting board yet — for now, feature requests go straight to the team by
          email. Tell us what you're trying to do, and where the current tools fall short.
        </p>
      </StaticSection>

      <StaticSection heading="Send a request">
        <a
          href="mailto:support@humaniseai.co.za?subject=Feature%20Request"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors duration-150"
        >
          <Mail size={14} />
          Email a feature request
        </a>
      </StaticSection>
    </StaticPageLayout>
  )
}

export default FeedbackPage
