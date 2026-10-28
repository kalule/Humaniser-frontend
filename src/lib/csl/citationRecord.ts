import type { CitationDto, FormatStyle, ResolvedCitation, SaveCitationRequest } from '../../types/citation'
import { renderCslDocument, type CslSource } from './render'

export type CitationMetadata = Pick<CitationDto, 'title' | 'authors' | 'itemType' | 'publicationYear' |
  'journalName' | 'publisher' | 'doi' | 'url' | 'volume' | 'issue' | 'pages'>

export function citationRecordSource(c: CitationMetadata, id: string): CslSource {
  return { id, title: c.title,
    authors: c.authors.map(a => [a.firstName, a.middleInitial, a.lastName].filter(Boolean).join(' ')).join('; '),
    authorDetails: c.authors.map(a => ({ family: a.lastName, given: [a.firstName, a.middleInitial].filter(Boolean).join(' ') })),
    year: c.publicationYear, venue: c.journalName, publisher: c.publisher, doi: c.doi, url: c.url,
    volume: c.volume, issue: c.issue, pages: c.pages, itemType: c.itemType }
}

/** Cached server labels are deliberately excluded: only structured metadata enters CSL. */
export function citationRecordReference(record: CitationMetadata, style: FormatStyle): string | null {
  try {
    return renderCslDocument([citationRecordSource(record, 'record')], [], style, ['record'])
      .bibliography[0]?.text || null
  } catch { return null }
}

/** Save the same presets that the generator previews, without changing the API contract. */
export function cslCitationSaveRequest(record: ResolvedCitation): SaveCitationRequest | null {
  const cachedApa7 = citationRecordReference(record, 'apa7')
  const cachedHarvard = citationRecordReference(record, 'harvard')
  const cachedIeee = citationRecordReference(record, 'ieee')
  const cachedMla = citationRecordReference(record, 'mla')
  const cachedChicago = citationRecordReference(record, 'chicago')
  const cachedVancouver = citationRecordReference(record, 'vancouver')
  if (!cachedApa7 || !cachedHarvard || !cachedIeee || !cachedMla || !cachedChicago || !cachedVancouver) return null
  const { title, authors, itemType, publicationYear, journalName, publisher, doi, url, volume, issue, pages } = record
  return { title, authors, itemType, publicationYear, journalName, publisher, doi, url, volume, issue, pages,
    cachedApa7, cachedHarvard, cachedIeee, cachedMla, cachedChicago, cachedVancouver }
}
