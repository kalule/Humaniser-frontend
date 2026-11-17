import { describe, expect, it } from 'vitest'
import { paperRunOutcome, type PaperRun } from './researchPaperRuns'
import { renderLiteratureReviewParagraphs } from './literatureReviewFormat'
import { buildWordExportHtml } from './wordExport'

describe('research paper run recovery', () => {
  it('keeps queued and running states pending and exposes terminal failures', () => {
    const run: PaperRun = { runId: 'a', status: 'Queued', completedSections: 0 }
    expect(paperRunOutcome(run)).toBeNull()
    expect(paperRunOutcome({ ...run, status: 'Running' })).toBeNull()
    for (const status of ['Failed', 'Cancelled', 'Interrupted'] as const)
      expect(() => paperRunOutcome({ ...run, status, error: 'Saved sections can be resumed.' })).toThrow('Saved sections can be resumed.')
    expect(() => paperRunOutcome({ ...run, status: 'Completed' })).toThrow('could not be retrieved')
  })

  it('recovers a completed result without flattening its cited table during rendering and export', () => {
    const content = '| Study | Finding |\n|---|---|\n| <span data-type="essayCitation">(Author, 2024)</span> | Supported result |\n*Table 1. Evidence summary.*'
    const result = paperRunOutcome({ runId: 'a', status: 'Completed', completedSections: 7,
      result: { isResearchPaper: true, title: 'Review', content, references: [], wordCount: 20 } as never })!
    const html = renderLiteratureReviewParagraphs(result.content)
    expect(html).toContain('<th>Study</th>')
    expect(html).toContain('<span data-type="essayCitation">(Author, 2024)</span>')
    expect(buildWordExportHtml(result.title, html, [])).toContain('<td>Supported result</td>')
  })
})
