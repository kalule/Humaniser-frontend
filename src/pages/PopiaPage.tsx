import { ShieldCheck } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { DraftNotice } from '../components/layout/DraftNotice'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function PopiaPage() {
  useDocumentTitle(
    'POPIA Compliance — HumaniseAI',
    'How HumaniseAI handles personal information in line with South Africa\'s Protection of Personal Information Act (POPIA).',
    '/popia',
  )

  return (
    <StaticPageLayout
      icon={ShieldCheck}
      badge="Legal"
      title="POPIA Compliance"
      subtitle="Last updated: 6 July 2026"
    >
      <DraftNotice />

      <StaticSection heading="Our commitment">
        <p>
          HumaniseAI is built and operated in South Africa, and we handle personal information in line with
          the Protection of Personal Information Act (POPIA). This page explains what that means in
          practice.
        </p>
      </StaticSection>

      <StaticSection heading="Lawful processing">
        <p>
          We only process personal information for the purpose you provided it — running your account,
          delivering tool output, and providing support. We don't sell personal information to third
          parties.
        </p>
      </StaticSection>

      <StaticSection heading="Uploaded content">
        <p>
          Documents and datasets you upload (for Data Analyst, Document Chat, and similar tools) are
          processed in an isolated session and deleted automatically once that session ends. They are not
          used to train AI models.
        </p>
      </StaticSection>

      <StaticSection heading="Security measures">
        <p>
          Data in transit is encrypted (SSL). Access to production systems is restricted to the team members
          who need it to operate the service.
        </p>
      </StaticSection>

      <StaticSection heading="Your rights under POPIA">
        <p>
          You have the right to access, correct, or request deletion of your personal information, and to
          object to certain processing. To exercise any of these rights, contact our Information Officer at{' '}
          <a href="mailto:support@humaniseai.co.za" className="text-indigo-600 hover:text-indigo-700 transition-colors">
            support@humaniseai.co.za
          </a>
          .
        </p>
      </StaticSection>
    </StaticPageLayout>
  )
}

export default PopiaPage
