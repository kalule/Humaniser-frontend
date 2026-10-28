import type { WriteWithAiResponse } from '../types/workbench'

/** Keep block boundaries explicit for HTML export and plain-text extraction as well as layout. */
export function appendGeneratedReferenceSection(bodyHtml: string, referencesHtml: string): string {
  return referencesHtml ? `${bodyHtml}\n\n<h2>REFERENCES</h2>\n${referencesHtml}` : bodyHtml
}

/** Generation-only guard. Saved TipTap documents (and user edits) never pass through this. */
export function renderGeneratedEssay(result: WriteWithAiResponse, resolve: (text: string) => string): string {
  const sections = result.sections
  if (!sections || !sections.introduction?.trim() || !sections.mainBody?.trim() || !sections.conclusion?.trim()) {
    throw new Error('The generated essay is missing a section. Please retry generation.')
  }
  const tokens = (text: string) => Array.from(text.matchAll(/\[(?:N:)?(S\d+(?:\s*[,;]\s*S\d+)*)\]/g))
    .flatMap(match => match[1].split(/\s*[,;]\s*/))
  const sectionTokens = tokens([sections.introduction, sections.mainBody, sections.conclusion].join('\n\n'))
  const contentTokens = tokens(result.content)
  const refs = new Set(result.references.map(ref => ref.sourceId))
  const unresolved = [...new Set([...contentTokens, ...sectionTokens].filter(id => !refs.has(id)))]
  const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim()
  const marker = /^[ \t]*(?:#{1,6}[ \t]*)?(?:[*_]{1,3}[ \t]*)?(?:\d+[.)][ \t]*)?(INTRODUCTION|MAIN[ \t]+BODY|CONCLUSION)[ \t]*:?[ \t]*(?:[*_]{1,3})?[ \t]*:?[ \t]*$/gim
  const markers = [...result.content.matchAll(marker)]
  const expected = [sections.introduction, sections.mainBody, sections.conclusion]
  const sameRevision = markers.length === 3 && markers.every((m, i) =>
    m[1].toUpperCase().replace(/\s+/g, ' ') === ['INTRODUCTION', 'MAIN BODY', 'CONCLUSION'][i]
    && normalize(result.content.slice(m.index! + m[0].length, markers[i + 1]?.index)) === normalize(expected[i]))
  const uncited = result.references.some(ref => !contentTokens.includes(ref.sourceId))
  if (!sameRevision || uncited || refs.size !== result.references.length || unresolved.length || JSON.stringify(contentTokens) !== JSON.stringify(sectionTokens)) {
    throw new Error(`The generated essay's text, sections and references do not match${unresolved.length ? ` (${unresolved.join(', ')})` : ''}. The existing document has been preserved. Please retry generation.`)
  }
  const paragraphs = (text: string, allowSubheadings: boolean) => resolve(text).split(/\n\n+/).map(p => {
    const heading = /^(?:\\?#){1,6}\s+([^\n]+)$/.exec(p.trim())
    if (allowSubheadings && heading) return `<h3>${heading[1]}</h3>`
    const trimmed = p.trim()
    return allowSubheadings && trimmed.split(/\s+/).length <= 10 && !/[.!?]$/.test(trimmed)
      ? `<h3>${trimmed}</h3>` : `<p>${p.replace(/\n/g, '<br>')}</p>`
  }).join('')
  return `<h2>INTRODUCTION</h2>${paragraphs(sections.introduction, false)}`
    + `<h2>MAIN BODY</h2>${paragraphs(sections.mainBody, true)}`
    + `<h2>CONCLUSION</h2>${paragraphs(sections.conclusion, false)}`
}
