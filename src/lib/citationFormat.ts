import type { CitationStyle } from '../types/research'

export interface ParsedReference {
  id:       number   // position in the compiled bibliography list — stable within a session
  surnames: string[] // extracted author surnames, in order; empty if unparseable
  year:     string | null
  raw:      string   // full display text for this entry (numbering stripped)
  doiUrl?:  string
}

// Splits characters like "&" / "and" / "," that separate authors in a compiled
// bibliography's author block (the text before the "(YYYY)" year marker).
function splitAuthorBlock(authorBlock: string): string[] {
  const tokens = authorBlock
    .split(/\s*(?:&|,?\s+and\s+|,)\s*/)
    .map(s => s.trim())
    .filter(Boolean)

  // A comma can separate authors or separate one surname from its initials. Fold an
  // initials-only token back into the preceding author so "Smith, J., Jones, A." is two authors,
  // not four. Provider-native structured authors remain the long-term authoritative solution.
  const authors: string[] = []
  for (const token of tokens) {
    const compact = token.replace(/[.\s-]/g, '')
    const initialsOnly = compact.length > 0 && compact.length <= 4 && /^[A-Z]+$/i.test(compact)
      && (token.includes('.') || compact.length === 1)
    if (initialsOnly && authors.length > 0) authors[authors.length - 1] += `, ${token}`
    else authors.push(token)
  }
  return authors
}

// Unicode hyphen/dash lookalikes that occasionally appear in a hyphenated surname as
// returned by an external metadata provider (e.g. OpenAlex returning "Shira Zelber‐Sagi"
// with U+2010 HYPHEN, not the plain ASCII hyphen-minus a drafting model naturally writes
// when citing "(Zelber-Sagi, 2011)" in prose) — visually identical, but two different
// characters, so an otherwise-correct surname match silently fails and the citation shows
// as UNMATCHED even though the source is genuinely in the project's literature. Mirrors
// the backend fix (ResearchService.UnicodeHyphenVariants / item #53, docs/OPEN_ITEMS.md) —
// that fix only touched the C# resolver; this file is a separate, independent
// reimplementation for the in-editor citation-click popover and needs its own copy.
const UNICODE_HYPHEN_VARIANTS_RE = /[‐‑‒–—−]/g

// A word counts as an initial if it carries a literal period (e.g. "D.", "J.H." —
// unambiguous regardless of length, since a real surname is never itself written with a
// trailing period) or — for a period-less single letter like a bare "D" — is exactly one
// character. Mirrors the backend's IsInitialToken (ResearchService.cs) so this frontend
// reimplementation doesn't misread a trailing initial as the surname.
function isInitialToken(word: string): boolean {
  if (word.includes('.')) return true
  return word.length <= 1
}

// Pulls a surname out of an author token like "Smith, J." or "J. Smith" or "Smith" or
// "Smith D." (surname-first, no comma — confirmed live: a project's own literature stored
// "Sadeghi D." this way; the previous "always take the last word" heuristic below
// extracted "D" as the surname instead of "Sadeghi", so a genuinely-existing, correctly-
// cited source showed as UNMATCHED).
function extractSurname(token: string): string | null {
  const normalized = token.replace(UNICODE_HYPHEN_VARIANTS_RE, '-')
  const commaForm = normalized.match(/^([A-Za-z'-]+),/)
  if (commaForm) return commaForm[1]

  const rawWords = normalized.trim().split(/\s+/).filter(Boolean)
  if (rawWords.length === 0) return null
  if (rawWords.length === 1) return rawWords[0].replace(/\./g, '')

  // No comma to anchor on. Filter out trailing/leading initials first ("D." in "Sadeghi
  // D.", "B." in "Frank B. Hu") before falling back to the "Given [Middle] Surname" order
  // assumption (e.g. "Rahul Rao", "Philipp A. Trotter") — confirmed live: a generated essay
  // rendered "Rahul Rao" as "(Rahul, 2020)" and "Joanne Sharp" as "(Joanne, 2013)", i.e. the
  // given name usually being the longer word, not the surname — so once initials are
  // excluded, the surname is reliably the LAST remaining word for that order. If every word
  // looked like an initial (unusual), fall back to the raw words rather than returning null.
  const nonInitialWords = rawWords.filter(w => !isInitialToken(w))
  const baseWords = nonInitialWords.length > 0 ? nonInitialWords : rawWords
  return baseWords[baseWords.length - 1].replace(/\./g, '')
}

// Extracts ordered surnames from a raw "authors" string as stored on a literature
// record (e.g. FetchedLiterature.authors: "Smith, J., & Jones, K." or "Smith, John and Jones, Kate").
// Shared by the in-editor citation-click matcher (citationMatch.ts) so it parses
// author blocks the same way the compiled-bibliography path already does.
export function extractSurnamesFromAuthors(authors: string): string[] {
  return splitAuthorBlock(authors)
    .map(extractSurname)
    .filter((s): s is string => !!s)
}

// Parses the numbered lines already extracted by ReferencesStep's
// `/^\d+\.\s/` filter (see ResearchAgentPage.tsx) into structured rows.
export function parseBibliographyEntries(compiled: string): ParsedReference[] {
  const lines = compiled
    .split('\n')
    .filter(l => /^\d+\.\s/.test(l.trim()))
    .map(l => l.trim())

  return lines.map((line, id) => {
    const text = line.replace(/^\d+\.\s*/, '')
    const doiMatch = text.match(/https?:\/\/doi\.org\/\S+/)
    const doiUrl   = doiMatch?.[0]
    const raw      = doiUrl ? text.replace(doiUrl, '').trimEnd() : text

    const yearMatch = raw.match(/\((\d{4}[a-z]?)\)/i)
    if (!yearMatch) return { id, surnames: [], year: null, raw, doiUrl }

    const authorBlock = raw.slice(0, yearMatch.index).trim()
    const surnames = splitAuthorBlock(authorBlock)
      .map(extractSurname)
      .filter((s): s is string => !!s)

    return { id, surnames, year: yearMatch[1], raw, doiUrl }
  })
}

// Formats a single reference as an in-text citation for the given style, mirroring
// the 1/2/3+ author branching used for the global Citation Generator's
// formatAuthorsShort() (src/pages/app/CitationPage.tsx) — adapted to the parenthetical
// form used inline in section text.
export function formatInTextCitation(
  ref: ParsedReference,
  style: CitationStyle,
  indexInList: number,
): string {
  if (style === 'ieee') return `[${indexInList + 1}]`

  if (ref.surnames.length === 0) {
    const short = ref.raw.length > 40 ? `${ref.raw.slice(0, 40)}…` : ref.raw
    return `(${short})`
  }

  if (style === 'mla') return `(${ref.surnames[0]})`

  const year = ref.year ?? 'n.d.'
  if (ref.surnames.length === 1) return `(${ref.surnames[0]}, ${year})`
  if (ref.surnames.length === 2) return `(${ref.surnames[0]} & ${ref.surnames[1]}, ${year})`
  return `(${ref.surnames[0]} et al., ${year})`
}

// ── Write With AI: formats raw WriteWithAiReference metadata (title/authors/year/venue/url) ──
// into an actual citation, for the given essay citation style — used by DocumentEditorPage to
// replace the [S1]-style internal source-tracking tokens Write With AI's content contains with a
// real citation before insertion, since those tokens were never meant to be the displayed form.
// A separate, purpose-built pair of functions rather than reusing formatInTextCitation/
// parseBibliographyEntries above: those parse an already-compiled bibliography TEXT block back
// into structured data (ResearchAgentPage's own reference-compilation flow), where here the
// structured fields already exist on WriteWithAiReference and need to go the other way — into
// display text — so there's nothing to parse.
export type EssayCitationStyleName = 'Harvard' | 'Apa7' | 'Ieee' | 'Chicago' | 'Vancouver'

// Deterministic author-date grouping after internal [S#] tokens have been resolved. This keeps
// citation punctuation out of the drafting model and turns `(A, 2023)(B, 2024)` into the single
// Harvard/APA/Chicago group `(A, 2023; B, 2024)` without touching ordinary parenthetical prose.
export function groupConsecutiveAuthorDateCitations(text: string): string {
  const pair = /\(([^()]*\b(?:19|20)\d{2}[a-z]?[^()]*)\)\s*\(([^()]*\b(?:19|20)\d{2}[a-z]?[^()]*)\)/g
  let grouped = text
  let previous: string
  do {
    previous = grouped
    grouped = grouped.replace(pair, '($1; $2)')
  } while (grouped !== previous)
  return grouped
}

export interface EssayReferenceMeta {
  title:    string
  authors?: string | null
  year?:    number | null
  venue?:   string | null
  url?:     string | null
  doi?:     string | null
  volume?:  string | null
  issue?:   string | null
  pages?:   string | null
  // "2020a"/"2020b" when two works share author and year (see orderEssayReferences).
  yearLabel?: string | null
}

const NUMBERED_ESSAY_STYLES: EssayCitationStyleName[] = ['Ieee', 'Vancouver']

export function formatEssayInTextCitation(
  meta: EssayReferenceMeta,
  style: EssayCitationStyleName,
  indexInList: number,
): string {
  if (NUMBERED_ESSAY_STYLES.includes(style)) return `[${indexInList + 1}]`

  const surnames = meta.authors ? extractSurnamesFromAuthors(meta.authors) : []
  const year = meta.yearLabel ?? meta.year ?? 'n.d.'
  if (surnames.length === 0) {
    const short = meta.title.length > 40 ? `${meta.title.slice(0, 40)}…` : meta.title
    return `(${short}, ${year})`
  }
  if (surnames.length === 1) return `(${surnames[0]}, ${year})`
  if (surnames.length === 2) return `(${surnames[0]} & ${surnames[1]}, ${year})`
  return `(${surnames[0]} et al., ${year})`
}

export function formatEssayNarrativeCitation(meta: EssayReferenceMeta, style: EssayCitationStyleName, indexInList: number): string {
  if (NUMBERED_ESSAY_STYLES.includes(style)) return `[${indexInList + 1}]`
  const surnames = meta.authors ? extractSurnamesFromAuthors(meta.authors) : []
  const year = meta.yearLabel ?? meta.year ?? 'n.d.'
  if (surnames.length === 0) {
    // No author to lead the clause with — standard convention for an anonymous/no-author work
    // is a short quoted title standing in for the author position, never the bare unquoted title
    // (confirmed live: rendered as "The Red Sea from Byzantium to the Caliphate: AD 500-1000
    // (2013) The economic stimulus..." — indistinguishable from an author name mid-sentence).
    const short = meta.title.length > 40 ? `${meta.title.slice(0, 40)}…` : meta.title
    return `"${short}" (${year})`
  }
  const names = surnames.length === 1 ? surnames[0]
    : surnames.length === 2 ? `${surnames[0]} and ${surnames[1]}`
    : `${surnames[0]} et al.`
  return `${names} (${year})`
}

export function formatEssayReferenceListEntry(
  meta: EssayReferenceMeta,
  style: EssayCitationStyleName,
  indexInList: number,
): string {
  // A source with no parsed author is an honest gap (WorkbenchService.FetchWebSourcesAsync leaves
  // this null rather than coercing it), not a value to fill in — this used to render the literal
  // string "Unknown author", which is indistinguishable from a real (if oddly-named) author to
  // anyone reading the reference list. Leading with the title and a parenthetical system note
  // keeps the gap visibly a gap.
  const authorsPart = meta.authors?.trim() || null
  const year = meta.yearLabel ?? meta.year ?? 'n.d.'
  const venuePart = meta.venue ? `, ${meta.venue}` : ''
  const volumeIssue = meta.volume ? `, ${meta.volume}${meta.issue ? `(${meta.issue})` : ''}` : meta.issue ? `, (${meta.issue})` : ''
  const pagesPart = meta.pages ? `, pp. ${meta.pages}` : ''
  const normalizedDoi = meta.doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  const stableUrl = normalizedDoi ? `https://doi.org/${normalizedDoi}` : meta.url
  const urlPart = stableUrl ? normalizedDoi ? ` doi:${normalizedDoi}.` : ` Available at: ${stableUrl}.` : ''

  if (NUMBERED_ESSAY_STYLES.includes(style))
    return authorsPart
      ? `[${indexInList + 1}] ${authorsPart}, "${meta.title}"${venuePart}${volumeIssue}${pagesPart}, ${year}.${urlPart}`
      : `[${indexInList + 1}] "${meta.title}" (author not available)${venuePart}${volumeIssue}${pagesPart}, ${year}.${urlPart}`

  // Harvard / Apa7 / Chicago all share this author-date shape closely enough for a single
  // reasonable rendering — full per-style punctuation rules (Apa7's italicised venue, Chicago's
  // footnote variant) are a further-refinement, not something the current [S1]-token bug leaves
  // room to get wrong today.
  return authorsPart
    ? `${authorsPart} (${year}) '${meta.title}'${venuePart}${volumeIssue}${pagesPart}.${urlPart}`
    : `'${meta.title}' (author not available, ${year})${venuePart}${volumeIssue}${pagesPart}.${urlPart}`
}
