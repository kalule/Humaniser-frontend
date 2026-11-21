import type { CitationFlag, CitationStyle, FetchedLiterature } from '../types/research'
import { extractSurnamesFromAuthors, formatInTextCitation, type ParsedReference } from './citationFormat'
import {
  findFlagForHit, resolveHitAgainstLiterature, resolveIeeeHit, scanTextForCitations,
  type CitationHit, type ResolvedCitation,
} from './citationMatch'

/**
 * What the Document view's citation card says about one cited source. Citations stay plain text in
 * the stored markdown (the server's checks and the .docx export read that text); this resolves a
 * citation to a pinned source when it is shown, the same way Guided's citation popover does.
 */
export type ClaimSupport = 'no_issues' | 'partly' | 'not_supported' | 'checking' | 'not_checked'

export interface CitationCardEntry {
  /** The clause as written, e.g. "Pillay and Beharry-Ramraj, 2024". */
  clause:         string
  title:          string
  authors?:       string
  year?:          number | string
  sourceExists:   boolean
  /** More than one pinned source has this author and year. */
  ambiguous:      boolean
  /** Null when the source is unknown. */
  fullTextPinned: boolean | null
  support:        ClaimSupport
  /** Why the check raised a flag, when it did. */
  note:           string | null
  viewUrl?:       string
  literatureId?:  string
}

const CLAIM_NOT_SUPPORTED = new Set(['ClaimContentMismatch'])
const CLAIM_PARTLY = new Set(['ClaimPartialMatch', 'GeneralizationBeyondSample', 'PopulationScopeViolation', 'GeographicMismatch'])

const NOTE_TEXT: Partial<Record<string, string>> = {
  ClaimContentMismatch:       'The source may not support this claim.',
  ClaimPartialMatch:          'The source supports only part of this claim.',
  GeneralizationBeyondSample: 'The claim generalises beyond the source’s sample.',
  PopulationScopeViolation:   'The claim is about a different population than the source.',
  GeographicMismatch:         'The claim is about a different place than the source.',
  JournalMismatch:            'The journal named does not match the source.',
  AuthorMismatch:             'The authors named do not match the source.',
  UnresolvedCitation:         'No pinned source matches this citation.',
  MissingSourceData:          'The source has no text to check the claim against.',
}

function supportFrom(flag: CitationFlag | undefined, pending: boolean, sourceExists: boolean): ClaimSupport {
  if (flag?.mismatchTypes.some(t => CLAIM_NOT_SUPPORTED.has(t))) return 'not_supported'
  if (flag?.mismatchTypes.some(t => CLAIM_PARTLY.has(t))) return 'partly'
  if (pending) return 'checking'
  return sourceExists ? 'no_issues' : 'not_checked'
}

function noteFrom(flag: CitationFlag | undefined): string | null {
  if (!flag) return null
  const notes = flag.mismatchTypes.map(t => NOTE_TEXT[t]).filter((n): n is string => !!n)
  return notes.length ? notes.join(' ') : (flag.llmReasoning ?? null)
}

export interface CitationContext {
  style:        CitationStyle
  literature:   FetchedLiterature[]
  bibliography: ParsedReference[]
  /** Open citation flags for this section. */
  flags:        CitationFlag[]
  /** The section's claim-support check has not finished yet. */
  pending:      boolean
}

export function knownMlaSurnames(literature: FetchedLiterature[]): Set<string> {
  return new Set(literature.map(l => extractSurnamesFromAuthors(l.authors)[0]).filter((s): s is string => !!s))
}

/** Citation hits in one run of text (a text node), with offsets relative to it. */
export function findCitations(text: string, ctx: Pick<CitationContext, 'style' | 'literature'>): CitationHit[] {
  return scanTextForCitations(text, ctx.style, knownMlaSurnames(ctx.literature))
}

function literatureFor(resolved: ResolvedCitation, literature: FetchedLiterature[]): FetchedLiterature | undefined {
  if (!resolved.matchedSource) return undefined
  return literature.find(l => (resolved.doi && l.doi && l.doi.toLowerCase() === resolved.doi.toLowerCase())
    || (l.title === resolved.displayTitle && String(l.year) === String(resolved.year)))
}

/** One entry per cited source in the hit ("(A, 2020; B, 2021)" gives two). */
export function describeCitation(hit: CitationHit, surroundingText: string, ctx: CitationContext): CitationCardEntry[] {
  const resolved = ctx.style === 'ieee'
    ? (() => { const r = resolveIeeeHit(hit, ctx.bibliography, ctx.literature); return r ? [r] : [] })()
    : resolveHitAgainstLiterature(hit, ctx.style, ctx.literature) ?? []
  const clauses = ctx.style === 'ieee' || ctx.style === 'mla' ? [hit.inner] : hit.inner.split(';').map(c => c.trim()).filter(Boolean)
  if (resolved.length === 0) {
    return [{ clause: hit.inner, title: `(${hit.inner})`, sourceExists: false, ambiguous: false, fullTextPinned: null,
      support: 'not_checked', note: ctx.style === 'ieee' ? 'This number is not in the reference list yet.' : 'No pinned source matches this citation.' }]
  }
  return resolved.map((r, i) => {
    const flag = r.matchedSource ? findFlagForHit(r.doi, surroundingText, ctx.flags) : undefined
    const lit = literatureFor(r, ctx.literature)
    return {
      clause:         clauses[i] ?? hit.inner,
      title:          r.displayTitle,
      authors:        r.authors,
      year:           r.year,
      sourceExists:   r.matchedSource,
      ambiguous:      (r.candidates?.length ?? 0) > 1,
      fullTextPinned: lit ? lit.hasFullText === true : null,
      support:        supportFrom(flag, ctx.pending, r.matchedSource),
      note:           noteFrom(flag) ?? (r.matchedSource ? null : 'No pinned source matches this citation.'),
      viewUrl:        r.viewUrl,
      literatureId:   lit?.id,
    }
  })
}

/**
 * The text that replaces one cited source with another, keeping the citation's form:
 * a parenthetical clause stays a clause inside the same brackets, a narrative citation
 * ("Klishi (2024)") stays narrative. Null when the style cannot be swapped this way (IEEE
 * numbers depend on the compiled reference list).
 */
export function swapCitationText(hitText: string, clauseIndex: number, replacement: FetchedLiterature, style: CitationStyle): string | null {
  if (style === 'ieee') return null
  const surnames = extractSurnamesFromAuthors(replacement.authors)
  if (surnames.length === 0) return null
  const ref: ParsedReference = { id: 0, surnames, year: String(replacement.year), raw: replacement.title }
  const formatted = formatInTextCitation(ref, style, 0)            // "(Surname, 2024)"
  const inner = formatted.replace(/^\(|\)$/g, '')
  if (!hitText.startsWith('(')) {
    // Narrative: "Surname (2024)" / "Surname and Other (2024)" / "Surname et al. (2024)".
    const who = surnames.length === 1 ? surnames[0]
      : surnames.length === 2 ? `${surnames[0]} and ${surnames[1]}` : `${surnames[0]} et al.`
    return style === 'mla' ? `(${who})` : `${who} (${replacement.year})`
  }
  const clauses = hitText.slice(1, -1).split(';').map(c => c.trim())
  if (clauseIndex < 0 || clauseIndex >= clauses.length) return formatted
  clauses[clauseIndex] = inner
  return `(${clauses.join('; ')})`
}
