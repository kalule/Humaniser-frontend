import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AcademicReportView, type ViewProps } from './AcademicReportCard'
import type { AcademicReport } from '../../api/deepResearch'

const base: AcademicReport = { sessionId: 's1', status: 'NotStarted', markdown: null, tier: null, keptSources: 0, wordCount: 0, notes: [], error: null, generatedAt: null, credits: 5 }
const ready: AcademicReport = { ...base, status: 'Ready', markdown: '# Title\n\n## Abstract\n\nText.\n', tier: 'Partial', keptSources: 5, wordCount: 4321, notes: ['Limited evidence: the report rests on 5 verified sources, so its conclusions are tentative.'] }

const view = (over: Partial<ViewProps> & { report: AcademicReport | null }) =>
  renderToStaticMarkup(<AcademicReportView canWrite busy={false} exporting={false} open={false} onRequest={() => {}} onDownload={() => {}} onToggle={() => {}} {...over} />).replace(/<!-- -->/g, '')

describe('AcademicReportView', () => {
  it('offers the report with its price, says it is not a systematic review, and starts nothing by itself', () => {
    const html = view({ report: base })
    expect(html).toContain('Write full report')
    expect(html).toContain('uses 5 credits')
    expect(html).toContain('not a systematic review')
  })

  it('shows that it is being written, without a button that would start a second write', () => {
    const html = view({ report: { ...base, status: 'Writing' } })
    expect(html).toContain('Writing the report')
    expect(html).not.toContain('Write full report')
  })

  it('shows a ready report with its limits, word count and a download; the text is hidden until opened', () => {
    const closed = view({ report: ready })
    expect(closed).toContain('4,321 words from 5 verified sources')
    expect(closed).toContain('conclusions are tentative')
    expect(closed).toContain('Download Word')
    expect(closed).toContain('Read here')
    expect(closed).not.toContain('<h2')
    const open = view({ report: ready, open: true })
    expect(open).toContain('Hide report')
    expect(open).toContain('<h2')
    expect(open).toContain('Abstract')
  })

  it('shows the reason a write failed and offers to try again', () => {
    const html = view({ report: { ...base, status: 'Failed', error: 'A full report needs at least 3 verified sources.' } })
    expect(html).toContain('at least 3 verified sources')
    expect(html).toContain('Try again')
  })

  it('shows a previous report with a write-again button only to someone who can write', () => {
    expect(view({ report: ready })).toContain('Write again')
    expect(view({ report: ready, canWrite: false })).not.toContain('Write again')
  })
})
