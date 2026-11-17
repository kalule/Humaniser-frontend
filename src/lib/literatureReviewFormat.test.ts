import { describe, expect, it } from 'vitest'
import { renderLiteratureReviewParagraphs } from './literatureReviewFormat'
import { buildWordExportHtml } from './wordExport'

describe('literature review table rendering', () => {
  it('renders a table beside prose and its caption while preserving citation markup', () => {
    const citation = '<span data-type="essayCitation" data-source-id="S1">(Eke, 2023)</span>'
    const text = `Review findings.\n| Theme | Source | Key finding |\n|---|---|---|\n| Academic Integrity | ${citation} | Raises concerns. |\n*Table 1. Key findings of selected sources, by theme.*\nFollowing discussion.`
    const html = renderLiteratureReviewParagraphs(text)
    expect(html).toContain('<p>Review findings.</p><table>')
    expect(html.match(/<th>/g)).toHaveLength(3)
    expect(html.match(/<td>/g)).toHaveLength(3)
    expect(html).toContain(`<td>${citation}</td>`)
    expect(html).toContain('</table><p><em>Table 1. Key findings of selected sources, by theme.</em></p><p>Following discussion.</p>')
    expect(html).not.toContain('|---|')
    expect(buildWordExportHtml('Review', html, [])).toContain('<th>Theme</th>')
  })

  it('preserves ordinary prose and does not turn pipe text without a separator into a table', () => {
    expect(renderLiteratureReviewParagraphs('First line.\r\nSecond line.\r\n\r\nA | B')).toBe('<p>First line.<br>Second line.</p><p>A | B</p>')
  })
})
