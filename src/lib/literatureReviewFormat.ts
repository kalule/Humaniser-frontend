import { isMarkdownTableBlock, renderMarkdownTable } from './caseStudyTableFormat'

/** Render section prose and tables, including captions directly beside table rows. */
export function renderLiteratureReviewParagraphs(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let prose: string[] = []
  const flush = () => {
    if (prose.length) blocks.push(`<p>${prose.join('<br>')}</p>`)
    prose = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) { flush(); continue }
    if (i + 1 < lines.length && isMarkdownTableBlock(`${line}\n${lines[i + 1].trim()}`)) {
      flush()
      const rows = [line, lines[++i].trim()]
      while (i + 1 < lines.length && /^\|.*\|$/.test(lines[i + 1].trim())) rows.push(lines[++i].trim())
      blocks.push(renderMarkdownTable(rows.join('\n')))
    } else if (/^\*Table\s+\d+[.:].*\*$/i.test(line)) {
      flush()
      blocks.push(`<p><em>${line.slice(1, -1)}</em></p>`)
    } else {
      prose.push(line)
    }
  }
  flush()
  return blocks.join('')
}
