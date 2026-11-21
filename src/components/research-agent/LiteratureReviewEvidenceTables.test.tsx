import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LiteratureReviewEvidenceTablesView } from './LiteratureReviewEvidenceTables'
import type { LiteratureReviewEvidenceTables } from '../../api/literatureReviewEvidence'

const tables = (over: Partial<LiteratureReviewEvidenceTables> = {}): LiteratureReviewEvidenceTables => ({
  searchRecord: 'SEARCH RECORD (the only basis...):\n- Sources were retrieved automatically. The databases, queries and search dates were NOT recorded',
  hasSearchRecord: false,
  sources: [
    { sourceId: 's1', citation: 'Tladi 2025', title: 'Loadshedding and small-business owners in Alexandra', setting: 'South Africa',
      population: 'small-business owners, Alexandra', design: 'CohortOrCrossSectional', themes: ['Coping strategies'],
      evidenceLevel: 'abstract only', sourceType: 'journal article', onTopic: true },
    { sourceId: 's2', citation: 'Perosio 2001', title: 'Supply Chain Management in the Produce Industry', setting: 'United States',
      population: 'produce retail executives', design: 'CohortOrCrossSectional', themes: [],
      evidenceLevel: 'abstract only', sourceType: 'journal article', onTopic: false },
  ],
  gaps: [{ gapStatement: 'A study of small retailers in Gauteng is needed.', citedInGapParagraph: [],
    closestRetrievedSources: ['Makgopa 2025: grocery food retailers'] }],
  notes: [],
  ...over,
})

const render = (t: LiteratureReviewEvidenceTables, open = true) =>
  renderToStaticMarkup(<LiteratureReviewEvidenceTablesView tables={t} open={open} onToggle={() => {}} />)

describe('LiteratureReviewEvidenceTablesView', () => {
  it('renders nothing when there are no sources and no gaps', () => {
    expect(render(tables({ sources: [], gaps: [] }))).toBe('')
  })

  it('shows counts while collapsed, and no table', () => {
    const html = render(tables(), false)
    expect(html).toContain('2 sources')
    expect(html).toContain('1 off topic')
    expect(html).not.toContain('<table')
  })

  it('lists each source with its setting, evidence level and an off-topic marker', () => {
    const html = render(tables())
    expect(html).toContain('Tladi 2025')
    expect(html).toContain('abstract only')
    expect(html).toContain('off topic')
    expect(html).toContain('Coping strategies')
  })

  it('shows the gap with the closest uncited studies and says when nothing is cited', () => {
    const html = render(tables())
    expect(html).toContain('Makgopa 2025')
    expect(html).toContain('nothing cited')
  })

  it('says plainly when no search record is stored', () => {
    expect(render(tables())).toContain('No search record is stored')
  })
})
