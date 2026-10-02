import { describe, expect, it } from 'vitest'
import { isMarkdownTableBlock, markdownTableCells, renderCaseStudyParagraphs, renderMarkdownTable } from './caseStudyTableFormat'

const optionMatrix = [
  '| Option | Benefits | Risks | Cost | Feasibility | Evidence |',
  '|---|---|---|---|---|---|',
  '| Enter via joint venture | Local market knowledge | Loss of control | Medium | High | [CF2] |',
  '| Direct acquisition | Full control | Regulatory risk | High | Medium | [S1] |',
].join('\n')

describe('isMarkdownTableBlock', () => {
  it('recognises a well-formed GitHub-Flavored-Markdown table', () => {
    expect(isMarkdownTableBlock(optionMatrix)).toBe(true)
  })

  it('does not misfire on an ordinary prose paragraph', () => {
    expect(isMarkdownTableBlock('Acme Corp is a mid-sized manufacturer considering expansion into new markets.')).toBe(false)
  })

  it('does not misfire on prose that happens to contain a pipe character', () => {
    expect(isMarkdownTableBlock('The company reported revenue | costs of $2M in the prior year.')).toBe(false)
  })

  it('requires a genuine separator row, not just pipe-delimited lines', () => {
    const notATable = '| Option | Benefits |\n| Joint venture | Local knowledge |'
    expect(isMarkdownTableBlock(notATable)).toBe(false)
  })
})

describe('markdownTableCells', () => {
  it('splits a pipe-delimited row into trimmed cells', () => {
    expect(markdownTableCells('| Option | Benefits | Risks |')).toEqual(['Option', 'Benefits', 'Risks'])
  })
})

describe('renderMarkdownTable', () => {
  it('renders the Option Evaluation Matrix as a real table with correct rows and columns', () => {
    const html = renderMarkdownTable(optionMatrix)

    expect(html).toContain('<table>')
    expect(html).toContain('<thead>')
    expect(html).toContain('<tbody>')
    // Header row: 6 columns, exactly as specified in the design (Option/Benefits/Risks/Cost/
    // Feasibility/Evidence).
    expect(html).toContain('<th>Option</th>')
    expect(html).toContain('<th>Evidence</th>')
    expect((html.match(/<th>/g) ?? []).length).toBe(6)
    // Body: 2 data rows, 6 cells each = 12 <td> total.
    expect((html.match(/<td>/g) ?? []).length).toBe(12)
    expect(html).toContain('<td>Enter via joint venture</td>')
    expect(html).toContain('<td>[CF2]</td>')
  })

  it('renders the Stakeholder Matrix and Implementation Roadmap column shapes correctly', () => {
    const stakeholderMatrix = [
      '| Stakeholder | Interest | Influence | Impact |',
      '|---|---|---|---|',
      '| Employees | High | Medium | High |',
    ].join('\n')
    const roadmap = [
      '| Action | Owner | Timing | KPI | Risk |',
      '|---|---|---|---|---|',
      '| Launch pilot | Ops Lead | Q1 2027 | Adoption rate | Delay |',
    ].join('\n')

    expect((renderMarkdownTable(stakeholderMatrix).match(/<th>/g) ?? []).length).toBe(4)
    expect((renderMarkdownTable(roadmap).match(/<th>/g) ?? []).length).toBe(5)
  })
})

describe('renderCaseStudyParagraphs', () => {
  it('converts a markdown table paragraph into a real <table>, leaving surrounding prose as <p>', () => {
    const text = `Acme Corp is evaluating three market-entry options.\n\n${optionMatrix}\n\nThe joint venture option is recommended.`

    const html = renderCaseStudyParagraphs(text, true)

    expect(html).toContain('<p>Acme Corp is evaluating three market-entry options.</p>')
    expect(html).toContain('<table>')
    expect(html).toContain('<p>The joint venture option is recommended.</p>')
    // The table's own pipe-delimited text must not also appear escaped inside a <p> — confirms
    // it was consumed as a table, not accidentally rendered twice.
    expect(html).not.toContain('<p>| Option')
  })

  // Required test 4: a purely qualitative case (no tabular content at all) must be completely
  // unaffected — no forced or empty table inserted anywhere.
  it('never inserts a table for purely qualitative content with no markdown-table-shaped text', () => {
    const text = 'This Explanatory case examines why community engagement declined over the study period.\n\n' +
      'Several converging factors explain the decline, discussed in turn below.\n\n' +
      'First, communication channels became less frequent after the pandemic.'

    const html = renderCaseStudyParagraphs(text, true)

    expect(html).not.toContain('<table>')
    expect(html).not.toContain('<td>')
    expect(html).not.toContain('<th>')
  })

  it('still applies the short-line subheading heuristic for non-table blocks', () => {
    const html = renderCaseStudyParagraphs('Market Entry Options\n\nA full paragraph of ordinary case analysis prose follows here.', true)
    expect(html).toContain('<h3>Market Entry Options</h3>')
  })
})
