import { describe, expect, it } from 'vitest'
import { buildWordExportHtml } from './wordExport'
import { renderCaseStudyParagraphs } from './caseStudyTableFormat'

describe('buildWordExportHtml — table preservation (Case Study Phase 2, Part 2)', () => {
  it('preserves real table structure (rows, columns, headers) in the exported markup, not just prose', () => {
    const caseSectionText =
      'Three market-entry options were evaluated for Acme Corp.\n\n' +
      '| Option | Benefits | Risks | Cost | Feasibility | Evidence |\n' +
      '|---|---|---|---|---|---|\n' +
      '| Joint venture | Local knowledge | Loss of control | Medium | High | [CF2] |\n' +
      '| Direct acquisition | Full control | Regulatory risk | High | Medium | [S1] |'
    const bodyHtml = `<h1>Acme Corp: Market Entry</h1><h2>ANALYSIS</h2>${renderCaseStudyParagraphs(caseSectionText, true)}`

    const html = buildWordExportHtml('Acme Corp: Market Entry', bodyHtml, [])

    // A real table survives all the way into the exported document markup — not flattened back
    // into pipe-delimited text, not dropped, not left as an unparsed paragraph.
    expect(html).toContain('<table>')
    expect(html).toContain('<thead>')
    expect(html).toContain('<tbody>')
    expect((html.match(/<tr>/g) ?? []).length).toBeGreaterThanOrEqual(3) // 1 header row + 2 data rows
    expect((html.match(/<th>/g) ?? []).length).toBe(6)
    expect((html.match(/<td>/g) ?? []).length).toBe(12)
    expect(html).toContain('<td>Joint venture</td>')
    expect(html).toContain('<td>Direct acquisition</td>')
  })

  it('includes table CSS so the exported .doc renders visible borders and a header row, not an unstyled block', () => {
    const html = buildWordExportHtml('Title', '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>', [])

    expect(html).toMatch(/table\s*\{[^}]*border-collapse/)
    expect(html).toMatch(/th,\s*td\s*\{[^}]*border/)
  })

  it('a purely qualitative document (no tables) produces no table markup at all', () => {
    const bodyHtml = '<h1>Explanatory Case</h1><h2>ANALYSIS</h2>' +
      renderCaseStudyParagraphs('This case explains a decline in community engagement over time.', true)

    const html = buildWordExportHtml('Explanatory Case', bodyHtml, [])

    expect(html).not.toContain('<table>')
  })

  it('still renders the reference list correctly alongside table content (no regression to existing export behavior)', () => {
    const html = buildWordExportHtml('Title', '<p>Body.</p>', [{ label: '1', text: 'Smith, J. (2024) A Study.' }])

    expect(html).toContain('References')
    expect(html).toContain('Smith, J. (2024) A Study.')
  })
})
