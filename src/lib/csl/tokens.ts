import type { FormatStyle } from '../../types/citation'
import { renderCslDocument, type CslSource } from './render'

export interface CitationToken { start: number; end: number; sourceIds: string[]; narrative: boolean }
export function citationTokens(text: string): CitationToken[] {
  const tokens: CitationToken[] = []
  for (const match of text.matchAll(/\[(N:)?(S\d+(?:\s*[,;]\s*S\d+)*)\]/g)) {
    const token = { start: match.index!, end: match.index! + match[0].length,
      sourceIds: [...new Set(match[2].split(/\s*[,;]\s*/))], narrative: Boolean(match[1]) }
    const punctuationGap = /^[ \t]+(?=[.,;:!?])/.exec(text.slice(token.end))
    if (punctuationGap) token.end += punctuationGap[0].length
    const previous = tokens.at(-1)
    if (previous && !previous.narrative && !token.narrative && /^\s*$/.test(text.slice(previous.end, token.start))) {
      previous.end = token.end; previous.sourceIds = [...new Set([...previous.sourceIds, ...token.sourceIds])]
    } else tokens.push(token)
  }
  return tokens
}

/** Returns a label for every occurrence. Invalid clusters remain explicit review items as a whole. */
export function renderCitationTokens(text: string, sources: readonly (CslSource & { sourceId: string })[], style: FormatStyle) {
  const tokens = citationTokens(text)
  const known = new Set(sources.map(source => source.sourceId))
  const valid = tokens.filter(token => token.sourceIds.every(id => known.has(id)))
  let rendered: ReturnType<typeof renderCslDocument> | null = null
  try {
    if (valid.length) rendered = renderCslDocument(sources, valid.map(token => ({
      id: String(token.start), narrative: token.narrative,
      items: token.sourceIds.map(id => ({ sourceId: sources.find(source => source.sourceId === id)!.id })),
    })), style)
  } catch { /* Metadata errors stay explicit review labels in both preview and import. */ }
  return tokens.map(token => ({ ...token, label: rendered?.citations.get(String(token.start))
    ?? `[Citation needs review: ${token.sourceIds.join(', ')}]` }))
}

export function resolveCslTokens(text: string, sources: readonly (CslSource & { sourceId: string })[], style: FormatStyle): string {
  const labels = renderCitationTokens(text, sources, style)
  let end = 0; let output = ''
  for (const token of labels) {
    output += text.slice(end, token.start)
    if (token.start > 0 && /[\p{L}\p{N}]/u.test(text[token.start - 1])) output += ' '
    output += token.label; end = token.end
  }
  return output + text.slice(end)
}
