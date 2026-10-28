import type { JSONContent } from '@tiptap/core'
import type { Node as ProseNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import type { CitationDto, FormatStyle } from '../types/citation'
import type { WriteWithAiReference } from '../types/workbench'
import { formatEssayInTextCitation, formatEssayNarrativeCitation, formatEssayReferenceListEntry, type EssayReferenceMeta, type EssayCitationStyleName } from './citationFormat'
import { renderCslDocument, type CslCitation } from './csl/render'
import { renderCitationTokens } from './csl/tokens'
import { citationRecordSource } from './csl/citationRecord'

export interface EditorSource extends EssayReferenceMeta {
  id: string
  libraryId?: string
  canonicalId?: string
  openAlexWorkId?: string
  documentId?: string
  itemType?: string
  abstract?: string
  summary?: string
  citationCount?: number
  // Old bibliography entries are kept verbatim until the user supplies structured metadata.
  rawReference?: string
}
export interface CitationItem { sourceId: string; source?: EditorSource; locator?: string; originalLabel?: string }
export interface CitationAttrs { occurrenceId: string; citationId?: string; items: CitationItem[]; label: string; narrative?: boolean }
export const escapeCitationHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export const essayStyle = (style: FormatStyle): EssayCitationStyleName => ({ apa7: 'Apa7', harvard: 'Harvard', chicago: 'Chicago', ieee: 'Ieee', vancouver: 'Vancouver', mla: 'Harvard' } as const)[style]

export function sourceFromCitation(c: CitationDto): EditorSource {
  return { ...citationRecordSource(c, `library:${c.id}`), libraryId: c.id }
}

export function citationItems(attrs: Partial<CitationAttrs>, library: CitationDto[] = []): CitationItem[] {
  if (attrs.items?.length) return attrs.items.map(item => {
    if (item.source) return item
    const record = library.find(c => `library:${c.id}` === item.sourceId)
    return record ? { ...item, source: sourceFromCitation(record) } : item
  })
  if (!attrs.citationId) return []
  const record = library.find(c => c.id === attrs.citationId)
  return [{ sourceId: `library:${attrs.citationId}`, source: record ? sourceFromCitation(record) : undefined, originalLabel: attrs.label }]
}

export function formatCitationGroup(items: CitationItem[], style: FormatStyle, order: string[], narrative = false): string {
  const labels = items.map(item => {
    if (item.source && item.source.id !== item.sourceId) return '[Citation source identity needs review]'
    if (!item.source || item.source.rawReference) {
      const original = item.originalLabel
      if (original && /^\[(?:N:)?S\d+(?:\s*[,;]\s*S\d+)*\]$/.test(original)) {
        return `[Citation needs review: ${original.slice(1, -1)}]`
      }
      return original || 'Source details unavailable'
    }
    const index = Math.max(0, order.indexOf(item.sourceId))
    let label = style === 'mla'
      ? `(${item.source.authorDetails?.[0]?.family || item.source.authors?.split(/[;,]/)[0] || item.source.title}${item.locator ? ` ${item.locator}` : ''})`
      : (narrative ? formatEssayNarrativeCitation : formatEssayInTextCitation)(item.source, essayStyle(style), index)
    if (item.locator && style !== 'mla') label = label.replace(/[)\]]$/, end => `, ${item.locator}${end}`)
    return label
  })
  if (narrative) return labels.join(' and ')
  if (labels.every(label => label.startsWith('(') && label.endsWith(')'))) return `(${labels.map(label => label.slice(1, -1)).join('; ')})`
  if (labels.every(label => /^\[.*\]$/.test(label))) return `[${labels.map(label => label.slice(1, -1)).join(', ')}]`
  return labels.join(' ')
}

// export function formatCitationGroup(items: CitationItem[], style: FormatStyle, order: string[], narrative = false): string {
//   const labels = items.map(item => {
//     if (!item.source || item.source.rawReference) {
//       const original = item.originalLabel
//       return original && /^\[(?:N:)?S\d+(?:\s*[,;]\s*S\d+)*\]$/.test(original)
//         ? `[Citation needs review: ${original.slice(1, -1)}]`
//         : original || 'Source details unavailable'
//     }
//     const index = Math.max(0, order.indexOf(item.sourceId))
//     let label = style === 'mla'
//       ? `(${item.source.authorDetails?.[0]?.family || item.source.authors?.split(/[;,]/)[0] || item.source.title}${item.locator ? ` ${item.locator}` : ''})`
//       : (narrative ? formatEssayNarrativeCitation : formatEssayInTextCitation)(item.source, essayStyle(style), index)
//     if (item.locator && style !== 'mla') label = label.replace(/[)\]]$/, end => `, ${item.locator}${end}`)
//     return label
//   })
//   if (narrative) return labels.join(' and ')
//   if (labels.every(label => label.startsWith('(') && label.endsWith(')'))) return `(${labels.map(label => label.slice(1, -1)).join('; ')})`
//   if (labels.every(label => /^\[.*\]$/.test(label))) return `[${labels.map(label => label.slice(1, -1)).join(', ')}]`
//   return labels.join(' ')
// }

export function sourceOrder(doc: ProseNode): string[] {
  const order: string[] = []
  // Generated drafts include every supplied reference; retain that bibliography's numbering.
  doc.descendants(node => {
    if (node.type.name === 'citationReference' && node.attrs.source?.id && !order.includes(node.attrs.source.id)) order.push(node.attrs.source.id)
  })
  doc.descendants(node => {
    if (node.type.name === 'citation') citationItems(node.attrs).forEach(item => { if (!order.includes(item.sourceId)) order.push(item.sourceId) })
  })
  return order
}

export function refreshCitationLabels(tr: Transaction, style: FormatStyle): Transaction {
  const sources = new Map<string, EditorSource>()
  const referenceIds: string[] = []
  const clusters: CslCitation[] = []
  // Bibliography snapshots and citation items are linked only by exact document source IDs.
  tr.doc.descendants(node => {
    const source = node.type.name === 'citationReference' ? node.attrs.source as EditorSource | undefined : undefined
    if (source?.id && source.title?.trim() && !source.rawReference) {
      sources.set(source.id, source); referenceIds.push(source.id)
    }
  })
  tr.doc.descendants(node => {
    if (node.type.name !== 'citation') return
    for (const item of citationItems(node.attrs))
      if (item.source?.id === item.sourceId && item.source.title?.trim() && !item.source.rawReference && !sources.has(item.sourceId))
        sources.set(item.sourceId, item.source)
  })
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== 'citation' || !node.attrs.items?.length) return
    const items = citationItems(node.attrs)
    if (items.every(item => sources.has(item.sourceId) && (!item.source || item.source.id === item.sourceId)
      && (!item.locator || item.locator.length <= 256 && !/[<>\r\n]/.test(item.locator))))
      clusters.push({ id: String(pos), items, narrative: node.attrs.narrative })
  })
  // A failed render cannot silently fall back to guessed citation metadata.
  let rendered: ReturnType<typeof renderCslDocument> | null = null
  try { if (sources.size) rendered = renderCslDocument([...sources.values()], clusters, style, [...new Set(referenceIds)]) } catch { /* explicit review labels below */ }
  const bibliography = new Map(rendered?.bibliography.map(entry => [entry.sourceId, entry.text]))
  const valid = new Set(clusters.map(cluster => cluster.id))
  tr.doc.descendants((node, pos) => {
    if (node.type.name === 'citation' && node.attrs.items?.length) {
      const items = citationItems(node.attrs)
      const invalidLocator = items.some(item => item.locator && (item.locator.length > 256 || /[<>\r\n]/.test(item.locator)))
      const internalIds = items.every(item => /^\[S\d+\]$/.test(item.originalLabel ?? ''))
      const label = rendered?.citations.get(String(pos)) ?? (valid.has(String(pos))
        ? '[Citation formatting needs review]' : invalidLocator ? '[Citation locator needs review]'
          : internalIds ? `[Citation needs review: ${items.map(item => item.originalLabel!.slice(1, -1)).join(', ')}]`
            : formatCitationGroup(items, style, sourceOrder(tr.doc), node.attrs.narrative))
      if (label !== node.attrs.label) tr.setNodeMarkup(pos, undefined, { ...node.attrs, label })
    }
    if (node.type.name === 'citationReference' && node.attrs.source) {
      const source = node.attrs.source as EditorSource
      const label = source.rawReference ?? bibliography.get(source.id) ?? `[Reference needs review: ${source.title}]`
      if (label !== node.attrs.label) tr.setNodeMarkup(pos, undefined, { ...node.attrs, label })
    }
  })
  if (rendered) {
    // Reorder only contiguous, structured reference rows. Ordinary prose and raw legacy rows stay in place.
    const rank = new Map(rendered.bibliography.map((entry, index) => [entry.sourceId, index]))
    const groups: { pos: number; size: number }[][] = []
    let group: { pos: number; size: number }[] = []
    tr.doc.descendants((node, pos) => {
      if (node.type.name === 'citationReference' && rank.has(node.attrs.source?.id)) {
        if (group.length && group.at(-1)!.pos + group.at(-1)!.size !== pos) { groups.push(group); group = [] }
        group.push({ pos, size: node.nodeSize })
      }
    })
    if (group.length) groups.push(group)
    for (const rows of groups.reverse()) {
      const nodes = rows.map(row => tr.doc.nodeAt(row.pos)!)
      const sorted = [...nodes].sort((a, b) => rank.get(a.attrs.source.id)! - rank.get(b.attrs.source.id)!)
      if (sorted.some((node, index) => node !== nodes[index]))
        tr.replaceWith(rows[0].pos, rows.at(-1)!.pos + rows.at(-1)!.size, sorted)
    }
  }
  return tr
}

export function updateSharedSource(tr: Transaction, source: EditorSource): Transaction {
  tr.doc.descendants((node, pos) => {
    if (node.type.name === 'citation') {
      const items = citationItems(node.attrs)
      if (items.some(item => item.sourceId === source.id)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, items: items.map(item => item.sourceId === source.id ? { ...item, source } : item) })
    } else if (node.type.name === 'citationReference' && node.attrs.source?.id === source.id) tr.setNodeMarkup(pos, undefined, { ...node.attrs, source })
  })
  return tr
}

export function linkSavedSource(tr: Transaction, sourceId: string, libraryId: string): Transaction {
  tr.doc.descendants((node, pos) => {
    if (node.type.name === 'citation') {
      const items = citationItems(node.attrs)
      if (items.some(item => item.sourceId === sourceId && item.source)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, items: items.map(item => item.sourceId === sourceId && item.source ? { ...item, source: { ...item.source, libraryId } } : item) })
    } else if (node.type.name === 'citationReference' && node.attrs.source?.id === sourceId) tr.setNodeMarkup(pos, undefined, { ...node.attrs, source: { ...node.attrs.source, libraryId } })
  })
  return tr
}

export function replaceCitationItems(tr: Transaction, pos: number, items: CitationItem[], style: FormatStyle, split = false): Transaction {
  const node = tr.doc.nodeAt(pos)
  if (node?.type.name !== 'citation') return tr
  if (!items.length) {
    const before = tr.doc.resolve(pos).nodeBefore
    const after = tr.doc.resolve(pos + node.nodeSize).nodeAfter
    const trimSpace = before?.isText && / $/.test(before.text ?? '') && after?.isText && /^[\s.,;:!?]/.test(after.text ?? '')
    tr.delete(trimSpace ? pos - 1 : pos, pos + node.nodeSize)
  }
  else if (split) {
    const replacements = items.flatMap((item, index) => {
      const citation = node.type.create({ ...node.attrs, citationId: null, occurrenceId: crypto.randomUUID(), items: [item], label: formatCitationGroup([item], style, sourceOrder(tr.doc), node.attrs.narrative) }, null, node.marks)
      return index ? [tr.doc.type.schema.text(' '), citation] : [citation]
    })
    tr.replaceWith(pos, pos + node.nodeSize, replacements)
  } else tr.setNodeMarkup(pos, undefined, { ...node.attrs, citationId: null, items })
  return refreshCitationLabels(tr, style)
}

export function citationHtml(attrs: CitationAttrs): string {
  return `<cite data-citation-id="${escapeCitationHtml(attrs.citationId ?? '')}" data-occurrence-id="${attrs.occurrenceId}" data-items="${escapeCitationHtml(JSON.stringify(attrs.items))}" data-narrative="${Boolean(attrs.narrative)}">${escapeCitationHtml(attrs.label)}</cite>`
}

/** Resolve generation tokens while their source IDs still exist, before importing HTML into TipTap. */
export function interactiveCitationTokens(text: string, refs: WriteWithAiReference[], style: FormatStyle, namespace: string): string {
  const sources = refs.map(ref => ({ ...ref, id: `${namespace}:${ref.sourceId}`, canonicalId: ref.canonicalId ?? undefined, openAlexWorkId: ref.openAlexWorkId ?? undefined, documentId: ref.documentId ?? undefined } as EditorSource))
  const clean = text.replace(/\[CF\d+\]\s?/g, '')
  const labels = renderCitationTokens(clean, sources.map((source, i) => ({ ...source, sourceId: refs[i].sourceId })), style)
  let output = ''; let end = 0
  for (const token of labels) {
    const items = token.sourceIds.map(key => {
      const index = refs.findIndex(ref => ref.sourceId === key)
      return { sourceId: index < 0 ? `${namespace}:${key}` : sources[index].id, source: sources[index], originalLabel: `[${key}]` }
    })
    const space = token.start > 0 && /[\p{L}\p{N}]/u.test(clean[token.start - 1]) ? ' ' : ''
    output += clean.slice(end, token.start) + space + citationHtml({ occurrenceId: crypto.randomUUID(), items, label: token.label, narrative: token.narrative })
    end = token.end
  }
  return output + clean.slice(end)
}

export function referenceHtml(source: EditorSource, style: FormatStyle, index: number): string {
  return `<div data-citation-reference="${escapeCitationHtml(JSON.stringify(source))}">${escapeCitationHtml(source.rawReference ?? formatEssayReferenceListEntry(source, essayStyle(style), index))}</div>`
}

/** Old drafts have no source IDs. Mark occurrences as unresolved; never guess by author/year. */
export function upgradeLegacyCitations(json: JSONContent, library: CitationDto[], style: FormatStyle = 'apa7'): JSONContent {
  let inReferences = false
  const walk = (node: JSONContent): JSONContent => {
    if (node.type === 'heading') inReferences = /^(references|bibliography)$/i.test((node.content ?? []).map(c => c.text ?? '').join('').trim())
    if (inReferences && node.type === 'paragraph' && node.content?.length) {
      const text = node.content.map(c => c.text ?? '').join('')
      const source: EditorSource = { id: `legacy-reference:${crypto.randomUUID()}`, title: text, rawReference: text }
      return { type: 'citationReference', attrs: { source, label: text } }
    }
    if (inReferences || !node.content) return node
    return { ...node, content: node.content.flatMap(child => {
      if (child.type === 'citation') return [{ ...child, attrs: { ...child.attrs, occurrenceId: child.attrs?.occurrenceId || crypto.randomUUID(), items: citationItems(child.attrs ?? {}, library) } }]
      if (child.type !== 'text' || child.marks?.some(mark => ['link', 'code'].includes(mark.type))) return [walk(child)]
      const text = child.text ?? ''
      const regex = /\((?:[\p{L}][\p{L}\p{M}'’.,&\s-]*,?\s+(?:19|20)\d{2}[a-z]?(?:,\s*p{1,2}\.\s*[\d–-]+)?)(?:;\s*[^();]+?\s+(?:19|20)\d{2}[a-z]?(?:,\s*p{1,2}\.\s*[\d–-]+)?)*\)/gu
      const output: JSONContent[] = []; let end = 0
      for (const match of text.matchAll(regex)) {
        if (match.index! > end) output.push({ ...child, text: text.slice(end, match.index) })
        const occurrenceId = crypto.randomUUID()
        const items = match[0].slice(1, -1).split(/;\s*/).map((part, index) => ({ sourceId: `unresolved:${occurrenceId}:${index}`, originalLabel: `(${part})` }))
        output.push({ type: 'citation', marks: child.marks, attrs: { occurrenceId, items, label: match[0] } })
        end = match.index! + match[0].length
      }
      if (!end) return [child]
      if (end < text.length) output.push({ ...child, text: text.slice(end) })
      return output
    }) }
  }
  return repairUnresolvedCitationSources(walk(json), style)
}

/** Repair only exact, namespaced IDs already present in the saved document. Never restore
 * generated prose over edits or infer source identity from a displayed author/year. */
export function repairUnresolvedCitationSources(json: JSONContent, style: FormatStyle = 'apa7'): JSONContent {
  const sources = new Map<string, EditorSource>()
  const collect = (node: JSONContent) => {
    const source = node.type === 'citationReference' ? node.attrs?.source as EditorSource | undefined : undefined
    if (source?.id && !source.rawReference) sources.set(source.id, source)
    if (node.type === 'citation') for (const item of citationItems(node.attrs ?? {})) {
      if (item.source?.id === item.sourceId && !item.source.rawReference && !sources.has(item.sourceId)) sources.set(item.sourceId, item.source)
    }
    node.content?.forEach(collect)
  }
  collect(json)
  const repair = (node: JSONContent): JSONContent => {
    if (node.type === 'citation') {
      const originalItems = citationItems(node.attrs ?? {})
      const items = originalItems.map(item => item.source || !sources.has(item.sourceId)
        ? item : { ...item, source: sources.get(item.sourceId) })
      const repaired = items.some((item, index) => item.source !== originalItems[index]?.source)
      const internalLabel = typeof node.attrs?.label === 'string' && /^\[(?:N:)?S\d+(?:\s*[,;]\s*S\d+)*\]$/.test(node.attrs.label)
      const label = repaired || internalLabel
        ? formatCitationGroup(items, style, [...sources.keys()], node.attrs?.narrative) : node.attrs?.label
      return { ...node, attrs: { ...node.attrs, items, label } }
    }
    return node.content ? { ...node, content: node.content.map(repair) } : node
  }
  return repair(json)
}
