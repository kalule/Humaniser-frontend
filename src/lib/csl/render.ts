import CSL from 'citeproc'
import type { FormatStyle } from '../../types/citation'
import { referenceAuthorNames, type EssayReferenceMeta } from '../citationFormat'
import apa from './styles/apa.csl?raw'
import harvard from './styles/harvard-cite-them-right.csl?raw'
import ieee from './styles/ieee.csl?raw'
import mla from './styles/modern-language-association.csl?raw'
import chicago from './styles/chicago-author-date.csl?raw'
import vancouver from './styles/nlm-citation-sequence.csl?raw'
import locale from './locales-en-US.xml?raw'

const styles: Record<FormatStyle, string> = { apa7: apa, harvard, ieee, mla, chicago, vancouver }
// Prose edits do not change citation input. Reuse only completed renders, never a mutable processor.
const cache = new Map<string, CslDocument>()
const copy = (doc: CslDocument): CslDocument => ({ citations: new Map(doc.citations), bibliography: doc.bibliography.map(entry => ({ ...entry })) })
function remap(doc: CslDocument, plan: Map<string, string[]>): CslDocument {
  const result = copy(doc)
  result.citations = new Map([...plan].map(([id, parts]) => {
    const labels = parts.map(part => doc.citations.get(part)!)
    return [id, labels.length < 2 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`]
  }))
  return result
}
export interface CslSource extends EssayReferenceMeta { id: string; itemType?: string }
export interface CslCitation { id: string; items: { sourceId: string; locator?: string }[]; narrative?: boolean }
export interface CslDocument {
  citations: Map<string, string>
  bibliography: { sourceId: string; text: string }[]
}

const itemTypes: Record<string, string> = {
  journal: 'article-journal', journalarticle: 'article-journal', articlejournal: 'article-journal', article: 'article-journal',
  book: 'book', bookchapter: 'chapter', chapter: 'chapter', thesis: 'thesis', dissertation: 'thesis',
  conference: 'paper-conference', conferencepaper: 'paper-conference', paperconference: 'paper-conference', report: 'report',
  webpage: 'webpage', website: 'webpage',
}

/** Never infer page locators, access dates, publishers, missing authors or publication years. */
export function toCslItem(source: CslSource) {
  const authors = referenceAuthorNames(source)
  const itemType = (source.itemType ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
  const type = Object.hasOwn(itemTypes, itemType) ? itemTypes[itemType] : source.venue ? 'article-journal' : 'document'
  return {
    id: source.id, type,
    title: source.title.trim(), ...(authors.length ? { author: authors } : {}),
    ...(Number.isInteger(source.year) && source.year! > 0 ? { issued: { 'date-parts': [[source.year!]] } } : {}),
    ...(source.venue?.trim() ? { 'container-title': source.venue.trim() } : {}),
    ...(source.publisher?.trim() ? { publisher: source.publisher.trim() } : {}),
    ...(source.volume?.trim() ? { volume: source.volume.trim() } : {}),
    ...(source.issue?.trim() ? { issue: source.issue.trim() } : {}),
    ...(source.pages?.trim() ? { page: source.pages.trim() } : {}),
    ...(source.doi?.trim() ? { DOI: source.doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '') } : {}),
    ...(source.url?.trim() ? { URL: source.url.trim() } : {}),
  }
}

function locatorItem(sourceId: string, raw?: string) {
  if (!raw?.trim()) return { id: sourceId }
  const value = raw.trim()
  if (value.length > 256 || /[<>\r\n]/.test(value)) throw new Error('Invalid citation locator')
  const match = /^(pp?\.?|pages?|ch(?:ap(?:ter)?)?\.?|paragraphs?|paras?\.?|sections?|sec\.?)\s*(.+)$/i.exec(value)
  const label = match && /^(?:ch)/i.test(match[1]) ? 'chapter'
    : match && /^(?:para)/i.test(match[1]) ? 'paragraph'
    : match && /^(?:sec)/i.test(match[1]) ? 'section' : 'page'
  return { id: sourceId, label, locator: match ? match[2].trim() : value }
}

/** A new processor per document: numbers, suffixes and grouped citations share one registry.
 * Validate the entire input before rendering; never drop an unknown source from a cluster. */
export function renderCslDocument(sources: readonly CslSource[], clusters: readonly CslCitation[], style: FormatStyle,
  uncitedIds: readonly string[] = []): CslDocument {
  if (!Object.hasOwn(styles, style)) throw new Error('Unsupported citation style')
  const registry = new Map<string, ReturnType<typeof toCslItem>>()
  for (const source of sources) {
    if (!source.id || !source.title?.trim() || registry.has(source.id)) throw new Error('Invalid or duplicate bibliography source')
    registry.set(source.id, toCslItem(source))
  }
  const seen = new Set<string>()
  const plan = new Map<string, string[]>()
  const prepared = clusters.flatMap((cluster, index) => {
    if (!cluster.id || seen.has(cluster.id) || !cluster.items.length) throw new Error('Invalid citation cluster')
    seen.add(cluster.id)
    const items = cluster.items.map(item => {
      if (!registry.has(item.sourceId)) throw new Error(`Unverified citation source: ${item.sourceId}`)
      return locatorItem(item.sourceId, item.locator)
    })
    const narrative = cluster.narrative && style !== 'ieee' && style !== 'vancouver'
    const parts = narrative ? items.map(item => [item]) : [items]
    const ids = parts.map((_, part) => `csl-${index}-${part}`)
    plan.set(cluster.id, ids)
    return parts.map((citationItems, part) => ({ citationID: ids[part], citationItems,
      properties: { noteIndex: 0, ...(narrative ? { mode: 'composite' as const } : {}) } }))
  })
  if (uncitedIds.some(id => !registry.has(id))) throw new Error('Unverified bibliography source')
  const cacheKey = JSON.stringify([style, [...registry.values()], prepared, uncitedIds])
  const hit = cache.get(cacheKey)
  if (hit) { cache.delete(cacheKey); cache.set(cacheKey, hit); return remap(hit, plan) }
  const processor = new CSL.Engine({
    retrieveLocale: lang => lang === 'en' || lang === 'en-US' ? locale : false,
    retrieveItem: id => {
      const item = registry.get(id)
      if (!item) throw new Error(`Unverified citation source: ${id}`)
      return structuredClone(item)
    },
  }, styles[style], 'en-US')
  processor.setOutputFormat('text')
  const citedIds = new Set(prepared.flatMap(c => c.citationItems.map(item => item.id)))
  processor.updateItems([...citedIds])
  const citations = new Map<string, string>()
  const before: [string, number][] = []
  for (const cluster of prepared) {
    const [, changes] = processor.processCitationCluster(cluster, before, [])
    for (const [index, text, id] of changes) {
      const key = id ?? prepared[index]?.citationID
      if (!key || !text.trim() || text.includes('[NO_PRINTED_FORM]')) throw new Error('Citation could not be rendered')
      citations.set(key, text)
    }
    before.push([cluster.citationID, 0])
  }
  const uncited = [...new Set(uncitedIds)].filter(id => !citedIds.has(id))
  if (uncited.length) {
    processor.updateUncitedItems(uncited)
    // Uncited rows enter only after first-citation order is established. Refresh earlier labels
    // too, because bibliography-only works can require author/date disambiguation.
    for (let i = 0; i < prepared.length; i++) {
      const [, changes] = processor.processCitationCluster(prepared[i], before.slice(0, i), before.slice(i + 1))
      for (const [index, text, id] of changes) {
        const key = id ?? prepared[index]?.citationID
        if (!key || !text.trim() || text.includes('[NO_PRINTED_FORM]')) throw new Error('Citation could not be rendered')
        citations.set(key, text)
      }
    }
  }
  const bibliography = processor.makeBibliography()
  if (prepared.some(c => !citations.has(c.citationID))) throw new Error('Citation render was incomplete')
  if (!bibliography) return remap({ citations, bibliography: [] }, plan)
  if (bibliography[0].bibliography_errors?.length) throw new Error('Bibliography could not be rendered')
  const result = { citations, bibliography: bibliography[1].map((text, index) => {
    const ids = bibliography[0].entry_ids[index]
    if (ids?.length !== 1 || !registry.has(ids[0])) throw new Error('Bibliography identity mismatch')
    return { sourceId: ids[0], text: text.trim() }
  }) }
  cache.set(cacheKey, copy(result))
  if (cache.size > 8) cache.delete(cache.keys().next().value!)
  return remap(result, plan)
}
