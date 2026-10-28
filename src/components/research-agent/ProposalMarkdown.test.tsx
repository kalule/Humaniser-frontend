import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProposalMarkdown, proposalUrlTransform } from './ProposalMarkdown'

describe('proposal preview', () => {
  it('renders generated charts and tables rather than their Markdown payload', () => {
    const html = renderToStaticMarkup(<ProposalMarkdown content={'| Phase | Month |\n| --- | --- |\n| Study | 1 |\n\n![Timeline](data:image/png;base64,aGVsbG8=)'} />)
    expect(html).toContain('<table>')
    expect(html).toContain('<img src="data:image/png;base64,aGVsbG8=" alt="Timeline"')
    expect(html).not.toContain('![Timeline]')
  })
  it('keeps executable links and unsupported data URLs blocked', () => {
    expect(proposalUrlTransform('javascript:alert(1)', 'href')).toBe('')
    expect(proposalUrlTransform('data:image/svg+xml;base64,aGVsbG8=', 'src')).toBe('')
    expect(proposalUrlTransform('data:image/png;base64,aGVsbG8=', 'href')).toBe('')
    const html = renderToStaticMarkup(<ProposalMarkdown content={'<script>alert(1)</script>'} />)
    expect(html).not.toContain('<script>')
  })
})
