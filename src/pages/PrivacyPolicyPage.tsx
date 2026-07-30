import { Lock } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { DraftNotice } from '../components/layout/DraftNotice'
import { LegalPlaceholder as P } from '../components/layout/LegalPlaceholder'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { LEGAL_LAST_UPDATED } from '../constants/legal'

const linkClass = 'text-indigo-600 hover:text-indigo-700 transition-colors'

export function PrivacyPolicyPage() {
  useDocumentTitle(
    'Privacy Policy — HumaniseAI',
    'How HumaniseAI collects, uses, and protects your data under POPIA and GDPR, across every tool in the platform.',
    '/privacy',
  )

  return (
    <StaticPageLayout icon={Lock} badge="Legal" title="Privacy Policy" subtitle={`Last updated: ${LEGAL_LAST_UPDATED}`}>
      <DraftNotice />

      <p className="text-sm text-text-sec leading-relaxed mb-8">
        This Privacy Policy explains how <P>full registered company name</P> ("HumaniseAI," "we," "us," or
        "our"), a company registered in South Africa (registration number <P>company registration number</P>),
        collects, uses, and protects personal information across all HumaniseAI Services — including My
        Library, Proposal Studio, AI Thesis, Systematic Review, Document Reviewer, Humaniser, AI Detector,
        Paraphraser, Grammar, Plagiarism Check, Summariser, Web Library, Document Chat, Citations, Lecture
        Notes, Flashcards, Data Analyst, and Workbench (collectively, the "Services"). This policy is written
        to comply with South Africa's Protection of Personal Information Act (POPIA) and, for users in the
        European Union and United Kingdom, the General Data Protection Regulation (GDPR) and UK GDPR.
      </p>

      <StaticSection heading="Who we are">
        <p>
          HumaniseAI is operated by <P>full registered company name</P>, with its registered address at{' '}
          <P>registered physical address</P>. For privacy-related inquiries, contact us at{' '}
          <a href="mailto:support@humaniseai.co.za" className={linkClass}>support@humaniseai.co.za</a>.
        </p>
        <p>
          Under POPIA, we act as the <strong className="text-text-pri">Responsible Party</strong> for
          personal information processed through the Services. Under GDPR, we act as the{' '}
          <strong className="text-text-pri">Data Controller</strong> for the same information.
        </p>
        <p>
          <P>
            GDPR Article 27 / UK GDPR may require appointing an EU and/or UK representative if we process
            personal data of EU/UK individuals at scale, or special category data. Confirm with legal counsel
            whether this applies given current EU/UK user volume, and if so, add representative contact
            details here.
          </P>
        </p>
      </StaticSection>

      <StaticSection heading="Information we collect">
        <p>
          <strong className="text-text-pri">Account information:</strong> name, email address,
          institution/university (if provided), password (hashed), and billing details when you subscribe to
          a paid plan.
        </p>
        <p>
          <strong className="text-text-pri">Content you submit:</strong> documents, essays, proposals,
          datasets, and other text or files you upload or generate through the Services — for example, a
          draft submitted to Humaniser, a dataset uploaded to Data Analyst, or a proposal built in Proposal
          Studio ("User Content").
        </p>
        <p>
          <strong className="text-text-pri">Usage data:</strong> log data, IP address, browser/device
          information, pages visited, and feature usage, collected automatically to operate, secure, and
          improve the Services.
        </p>
        <p>
          <strong className="text-text-pri">Payment information:</strong> processed by our third-party
          payment provider(s) (<P>name of payment processor(s) once selected</P>). We do not store full card
          numbers on our own servers.
        </p>
        <p>
          <strong className="text-text-pri">Communications:</strong> support requests, feedback, and
          correspondence with us.
        </p>
      </StaticSection>

      <StaticSection heading="How we use your information">
        <p>We process personal information to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Provide, operate, and maintain the Services, including running your documents through the relevant AI pipeline (humanisation, detection, paraphrasing, proposal generation, statistical analysis, and similar)</li>
          <li>Process payments and manage your subscription</li>
          <li>Communicate with you about your account, changes to the Services, or support requests</li>
          <li>Improve and develop the Services, including understanding which features are used and how</li>
          <li>Detect, prevent, and address technical issues, fraud, or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
      </StaticSection>

      <StaticSection heading="Legal basis for processing (GDPR)">
        <p>For users in the EU/UK, we rely on the following legal bases:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-text-pri">Contract</strong> — processing necessary to provide the Services you've subscribed to</li>
          <li><strong className="text-text-pri">Consent</strong> — for optional communications (e.g. marketing emails) and non-essential cookies</li>
          <li><strong className="text-text-pri">Legitimate interests</strong> — for service improvement, security, and fraud prevention, balanced against your rights</li>
          <li><strong className="text-text-pri">Legal obligation</strong> — where processing is required by law (e.g. tax/accounting records)</li>
        </ul>
      </StaticSection>

      <StaticSection heading="How AI processing works with your content">
        <p>This section applies specifically to how your User Content is handled by the AI systems underlying the Services.</p>
        <p>
          <strong className="text-text-pri">Third-party AI providers:</strong> some Services rely on
          third-party large language model providers to process User Content and generate outputs (humanised
          text, detection scores, paraphrased content, proposal drafts, statistical summaries, and similar).
          Your content is transmitted to these providers solely to generate the output you requested.{' '}
          <P>
            confirm and list actual LLM/API providers in use, and link to or summarize their data processing
            terms — we are a data exporter to them under POPIA/GDPR and need a data processing agreement in
            place with each
          </P>
        </p>
        <p>
          <strong className="text-text-pri">We do not use your User Content to train our own or third-party
          AI models</strong> without your explicit, separate consent.{' '}
          <P>
            confirm this is factually true of the actual pipeline and any third-party provider terms before
            publishing — if any provider terms permit training on submitted data by default, either disable
            that setting contractually/technically or amend this clause to accurately disclose it
          </P>
        </p>
        <p>
          <strong className="text-text-pri">Retention of User Content:</strong> documents and generated
          outputs are retained for as long as your account is active, or as needed to provide the Services
          (e.g. your Library history), unless you delete them. You may delete documents at any time through
          the relevant module. <P>confirm actual retention period after account deletion/cancellation, and state it — e.g. "deleted within 30 days of account closure"</P>
        </p>
        <p>
          <strong className="text-text-pri">Sandboxed execution (Data Analyst):</strong> where the Service
          executes code or statistical analysis on data you upload, that data is processed transiently to
          generate your results and is not retained beyond what's needed to return your output and maintain
          your session/history, as described above.
        </p>
      </StaticSection>

      <StaticSection heading="Sharing your information">
        <p>We share personal information only with:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-text-pri">Service providers</strong> who process data on our behalf under contract (hosting providers, payment processors, third-party AI/LLM providers as described above, email delivery services)</li>
          <li><strong className="text-text-pri">Legal and regulatory authorities</strong>, where required by law</li>
          <li><strong className="text-text-pri">A successor entity</strong>, in the event of a merger, acquisition, or sale of assets, with notice to you</li>
        </ul>
        <p>We do not sell personal information.</p>
      </StaticSection>

      <StaticSection heading="International data transfers">
        <p>
          Because the Services may involve third-party AI providers and infrastructure located outside South
          Africa, your information may be transferred internationally.
        </p>
        <p>
          <strong className="text-text-pri">Under POPIA</strong>, we ensure such transfers occur only where
          the recipient is subject to a law, binding corporate rules, or agreement that provides an adequate
          level of protection substantially similar to POPIA, or where you have consented.
        </p>
        <p>
          <strong className="text-text-pri">Under GDPR</strong>, where we transfer personal data of EU/UK
          individuals outside the EU/UK, we rely on Standard Contractual Clauses (SCCs) or another approved
          transfer mechanism with our processors. South Africa does not currently hold a European Commission
          adequacy decision, so SCCs (or an equivalent mechanism) apply to any such transfer.{' '}
          <P>reverify South Africa's adequacy status and confirm actual hosting location(s) before publishing — adequacy decisions can change</P>
        </p>
      </StaticSection>

      <StaticSection heading="Your rights">
        <p><strong className="text-text-pri">Under POPIA, you have the right to:</strong></p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Be notified that your personal information is being collected</li>
          <li>Access the personal information we hold about you</li>
          <li>Request correction, deletion, or destruction of personal information</li>
          <li>Object to processing of your personal information, including for direct marketing</li>
          <li>Complain to the Information Regulator of South Africa if you believe your rights have been infringed</li>
        </ul>
        <p><strong className="text-text-pri">Under GDPR (if you are in the EU/UK), you additionally have the right to:</strong></p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Data portability (receive your data in a structured, machine-readable format)</li>
          <li>Restriction of processing in certain circumstances</li>
          <li>Withdraw consent at any time, where processing is based on consent</li>
          <li>Lodge a complaint with your local supervisory authority (e.g. the ICO in the UK, or your national Data Protection Authority in the EU)</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:support@humaniseai.co.za" className={linkClass}>support@humaniseai.co.za</a>. We
          will respond within the timeframes required by applicable law (generally 30 days under POPIA; one
          month, extendable, under GDPR).
        </p>
      </StaticSection>

      <StaticSection heading="Data security">
        <p>
          We implement technical and organisational measures to protect personal information, including
          encryption in transit and access controls on our infrastructure.{' '}
          <P>at a high level only — avoid naming specific past incidents or technical specifics of the security setup in a public-facing document</P>{' '}
          No method of transmission or storage is completely secure, and we cannot guarantee absolute
          security.
        </p>
      </StaticSection>

      <StaticSection heading="Data retention">
        <p>
          We retain personal information for as long as necessary to provide the Services and fulfil the
          purposes described in this policy, or as required by law (e.g. financial records retention under
          South African tax law).{' '}
          <P>state specific retention periods once confirmed — account data, billing records, support correspondence</P>
        </p>
      </StaticSection>

      <StaticSection heading="Cookies and tracking">
        <p>We currently use only essential cookies, required for login sessions and core functionality — see our{' '}
          <a href="/cookies" className={linkClass}>Cookie Policy</a> for details. We do not currently use
          analytics or advertising cookies. If that changes, this section and our Cookie Policy will be
          updated first, and non-essential cookies will be gated behind a consent banner for EU/UK visitors.
        </p>
      </StaticSection>

      <StaticSection heading="Children's privacy">
        <p>
          The Services are intended for users aged 18 and older, or the age of majority in your jurisdiction,
          given their use in academic and professional contexts. We do not knowingly collect personal
          information from children.
        </p>
      </StaticSection>

      <StaticSection heading="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be notified via email or
          a notice on the Services. Continued use after changes take effect constitutes acceptance.
        </p>
      </StaticSection>

      <StaticSection heading="Contact us">
        <p>
          For privacy questions, requests, or complaints:{' '}
          <a href="mailto:support@humaniseai.co.za" className={linkClass}>support@humaniseai.co.za</a>
          <br />
          Registered address: <P>registered physical address</P>
        </p>
      </StaticSection>
    </StaticPageLayout>
  )
}

export default PrivacyPolicyPage
