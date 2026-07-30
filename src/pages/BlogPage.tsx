import { Newspaper } from 'lucide-react'
import { StaticPageLayout, StaticSection } from '../components/layout/StaticPageLayout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function BlogPage() {
  useDocumentTitle(
    'Blog — HumaniseAI',
    "The HumaniseAI blog is launching soon, covering AI writing, academic research, and study tips for South African students.",
    '/blog',
  )

  return (
    <StaticPageLayout
      icon={Newspaper}
      badge="Blog"
      title="Our blog is on its way"
      subtitle="We're preparing guides on AI writing, academic research, and study workflows for South African students. Check back soon."
    >
      <StaticSection heading="In the meantime">
        <p>
          Have a topic you'd like us to cover — AI detection, citation styles, data analysis for research
          proposals? Send it through our{' '}
          <a href="/contact" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Contact page
          </a>{' '}
          and we'll factor it into what we write first.
        </p>
      </StaticSection>
    </StaticPageLayout>
  )
}

export default BlogPage
