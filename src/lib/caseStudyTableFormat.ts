// Case Study Phase 2, Part 2 — converts the GitHub-Flavored-Markdown tables
// WorkbenchService.BuildCaseStudySystemPrompt instructs the model to emit (for the three
// purposeful table types: Option Evaluation Matrix, Stakeholder Matrix, Implementation Roadmap)
// into real HTML <table> markup the Tiptap editor's TableKit extension can hold, and DOCX export
// can render as an actual Word table — a GFM table pasted as plain text would otherwise flatten
// into an unreadable pipe-delimited paragraph, the exact "text pretending to be a table" failure
// mode this module exists to avoid.

const MARKDOWN_TABLE_SEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/

// A block is a markdown table only if every non-empty line is pipe-delimited AND the second line
// is a separator row (|---|---|...) — this is deliberately strict: an ordinary prose paragraph
// never matches, so this never misfires on non-tabular content (Part 2's "no forced/empty tables"
// requirement is satisfied structurally, not by a special case).
export function isMarkdownTableBlock(block: string): boolean {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.length >= 2
    && lines.every(l => l.startsWith('|') && l.endsWith('|'))
    && MARKDOWN_TABLE_SEPARATOR.test(lines[1])
}

export function markdownTableCells(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

export function renderMarkdownTable(block: string): string {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  const headerHtml = `<tr>${markdownTableCells(lines[0]).map(c => `<th>${c}</th>`).join('')}</tr>`
  const bodyHtml = lines.slice(2)
    .map(line => `<tr>${markdownTableCells(line).map(c => `<td>${c}</td>`).join('')}</tr>`)
    .join('')
  return `<table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`
}

// Sibling to DocumentEditorPage's renderEssayParagraphs rather than a modification of it (this
// PR's scope restriction: don't touch Essay-facing shared rendering beyond what's confirmed
// safe) — same paragraph-split/subheading logic, with markdown-table detection layered on top,
// used only for case-study content.
export function renderCaseStudyParagraphs(text: string, allowSubheadings: boolean): string {
  return text
    .split(/\n\n+/)
    .map(p => {
      const trimmed = p.trim()
      if (isMarkdownTableBlock(trimmed)) return renderMarkdownTable(trimmed)
      if (allowSubheadings && trimmed.split(/\s+/).length <= 10 && !/[.!?]$/.test(trimmed)) return `<h3>${trimmed}</h3>`
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    })
    .join('')
}
