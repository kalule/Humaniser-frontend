import type { BibliographyResult, FetchedLiterature, ProjectSection } from '../types/research'
import { parseBibliographyResultEntries, type ParsedReference } from './citationFormat'

// Loading, empty and failed are different conditions and must never collapse into one "0".
export type BibliographyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: BibliographyResult }
  | { status: 'error'; message: string }

// Entries for consumers that need rows (insert-at-cursor, IEEE numbering). Null until a result
// exists — "not compiled yet" is deliberately distinguishable from "compiled, zero entries".
export function bibliographyReferences(state: BibliographyState): ParsedReference[] | null {
  return state.status === 'ready' ? parseBibliographyResultEntries(state.data.entries) : null
}

export type BibliographyTone = 'neutral' | 'review' | 'error'

export interface BibliographyDescription {
  /** Short count for the panel header, e.g. "12 cited references · 3 citations to review". */
  summary: string
  /** Body message for the empty/problem states; null when there is a list to show instead. */
  message: string | null
  tone: BibliographyTone
  canRetry: boolean
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function describeBibliography(state: BibliographyState): BibliographyDescription {
  switch (state.status) {
    case 'idle':
    case 'loading':
      return { summary: 'Compiling…', message: null, tone: 'neutral', canRetry: false }
    case 'error':
      return {
        summary: 'References couldn’t load',
        message: 'References couldn’t load.',
        tone: 'error',
        canRetry: true,
      }
    case 'ready': {
      const { status, entries, unresolvedCitations } = state.data
      const refs = plural(entries.length, 'cited reference')
      const toReview = unresolvedCitations.length

      if (status === 'no_sections') {
        return { summary: 'No drafted sections', message: 'References will appear as you add citations.', tone: 'neutral', canRetry: false }
      }
      if (status === 'no_citations') {
        return { summary: 'No citations found', message: 'No citations found in this draft.', tone: 'neutral', canRetry: false }
      }
      if (toReview > 0 && entries.length === 0) {
        return {
          summary: `${plural(toReview, 'citation')} to review`,
          message: 'Some citations need to be linked to sources.',
          tone: 'review',
          canRetry: false,
        }
      }
      if (toReview > 0) {
        return {
          summary: `${refs} · ${plural(toReview, 'citation')} to review`,
          message: null,
          tone: 'review',
          canRetry: false,
        }
      }
      return { summary: refs, message: null, tone: 'neutral', canRetry: false }
    }
  }
}

// ── Cache identity ───────────────────────────────────────────────────────────

// Cheap, stable, non-cryptographic string hash (djb2). Only used to detect "did this change".
export function hashString(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export interface BibliographyKeyInput {
  projectId:     string
  citationStyle: string
  sections:      ReadonlyArray<Pick<ProjectSection, 'code' | 'status' | 'content'>>
  literature:    ReadonlyArray<Pick<FetchedLiterature, 'id' | 'year' | 'harvardCitation' | 'apaCitation'>> | null
}

// Everything the compiled result depends on: the saved section text, each section's status,
// source registry membership/citation metadata, and the citation style. Any change here makes a
// previously fetched bibliography stale.
export function buildBibliographyKey(input: BibliographyKeyInput): string {
  const sections = input.sections
    .map(s => `${s.code}:${s.status}:${s.content.length}:${hashString(s.content)}`)
    .join(';')
  const literature = input.literature === null
    ? 'pending'
    : hashString(input.literature
        .map(l => `${l.id}:${l.year}:${l.harvardCitation}:${l.apaCitation}`)
        .join(';'))
  return [input.projectId, input.citationStyle, hashString(sections), literature].join('|')
}
