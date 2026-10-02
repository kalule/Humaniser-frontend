import type { ReactNode } from 'react'

// Handles the inline emphasis the Humaniser's rewrite prose actually produces
// (**bold**, *italic*, `code`) — not a full markdown parser. Block-level
// syntax (headings, lists, links) isn't emitted by this endpoint's prompts
// today, so it's left as plain text rather than building out a parser for it.
const INLINE_PATTERN = /\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*/g

/** Parses a complete string's inline emphasis into React nodes. */
export function renderInlineMarkdown(text: string, keyPrefix = 'md'): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  INLINE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const [, bold, code, italic] = match
    if (bold !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${key++}`} className="font-semibold">{bold}</strong>)
    } else if (code !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-${key++}`} className="bg-neutral-100 text-purple-accent px-1 py-0.5 rounded text-[0.9em] font-mono">
          {code}
        </code>,
      )
    } else if (italic !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${key++}`}>{italic}</em>)
    }
    lastIndex = INLINE_PATTERN.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

interface BoldTokenResult {
  /** The token with `**` markers stripped, ready to render. */
  clean: string
  /** Whether this token itself should render bold. */
  isBold: boolean
  /** Bold state to carry into the next token. */
  nextBoldActive: boolean
}

/**
 * Strips `**` markers from a single whitespace-delimited word token, carrying
 * bold state across calls — for renderers (the word-diff view) that render
 * one word at a time and can't re-parse the whole string at once. A bold run
 * that spans several words ("**Subject-Verb Agreement**") opens on the first
 * token and stays active until the closing token, same as real markdown.
 */
export function consumeBoldMarker(word: string, boldActive: boolean): BoldTokenResult {
  const markerCount = (word.match(/\*\*/g) ?? []).length
  const clean = word.replace(/\*\*/g, '')
  if (markerCount % 2 === 0) {
    // 0 markers: state carries through unchanged. A matched pair within one
    // token ("**word**"): that token is bold, state is unchanged after it.
    return { clean, isBold: markerCount > 0 ? true : boldActive, nextBoldActive: boldActive }
  }
  // An unmatched marker toggles state — this token is the open or close edge
  // of a run, so it renders bold either way.
  return { clean, isBold: true, nextBoldActive: !boldActive }
}
