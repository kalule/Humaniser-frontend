import { Cookie } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { DraftNotice } from '../components/layout/DraftNotice'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function CookiePolicyPage() {
  useDocumentTitle(
    'Cookie Policy — HumaniseAI',
    'How HumaniseAI uses cookies and similar technologies to keep you signed in and improve the service.',
    '/cookies',
  )

  return (
    <StaticPageLayout icon={Cookie} badge="Legal" title="Cookie Policy" subtitle="Last updated: 6 July 2026">
      <DraftNotice />

      <StaticSection heading="What cookies we use">
        <p>
          We use a small number of essential cookies to keep you signed in and remember your session. We
          don't use third-party advertising or tracking cookies.
        </p>
      </StaticSection>

      <StaticSection heading="Essential cookies">
        <p>
          These cookies are required for the platform to function — for example, authentication cookies that
          keep you logged in between pages. Blocking these will prevent core features from working.
        </p>
      </StaticSection>

      <StaticSection heading="Managing cookies">
        <p>
          Most browsers let you block or delete cookies through their settings. Since we only use essential
          cookies, blocking them may sign you out or break parts of the app.
        </p>
      </StaticSection>

      <StaticSection heading="Questions">
        <p>
          If you have questions about our cookie use, contact us at{' '}
          <a href="mailto:support@humaniseai.co.za" className="text-indigo-600 hover:text-indigo-700 transition-colors">
            support@humaniseai.co.za
          </a>
          .
        </p>
      </StaticSection>
    </StaticPageLayout>
  )
}

export default CookiePolicyPage
