import type { CitationFlag, CitationStyle, FetchedLiterature } from '../types/research'
import type { ParsedReference } from './citationFormat'
import { extractSurnamesFromAuthors } from './citationFormat'

// ── In-editor citation detection ────────────────────────────────────────────
// Scans plain prose for citation-shaped substrings so DocumentSurface can decorate
// them as clickable and resolve a click back to a real source. Deliberately
// conservative per style — false positives (highlighting a parenthetical that
// isn't really a citation) are worse than the occasional missed real one:
//   - apa7/harvard: "(Surname[s], YYYY)" — the trailing year is what makes this safe.
//   - mla:          "(Surname)" with no year marker — only decorated when the surname
//                    also appears in the project's own literature, gated by the caller.
//   - ieee:         "[N]" — decorated unconditionally; distinctive enough in prose.
export interface CitationHit {
  from:   number
  to:     number
  inner:  string   // text inside the delimiters, e.g. "Smith, 2023" or "3"
}

const YEAR_STYLE_RE = /\(([^()]{3,100})\)/g
const YEAR_SUFFIX_RE = /,?\s*(\d{4}[a-z]?)\s*$/
const NARRATIVE_AUTHOR_TAIL_RE = /((?:[A-Z][\p{L}'\p{Pd}-]*)(?:(?:\s+(?:de|van|von|der|den|el|al|bin|ibn|da|dos|das|la|le|du|di)\s+[A-Z][\p{L}'\p{Pd}-]*)|(?:\s+(?:and|&)\s+[A-Z][\p{L}'\p{Pd}-]*)|(?:\s+et\s+al\.?))?)\s*$/u
const MLA_RE  = /\(([A-Z][\p{L}'-]+)\)/gu
const IEEE_RE = /\[(\d{1,3})\]/g

// Runs the style-appropriate regex over a single text run (a ProseMirror text node's
// content, or any plain string) and returns character-offset hits relative to that string.
export function scanTextForCitations(
  text: string,
  style: CitationStyle,
  knownMlaSurnames: Set<string>,
): CitationHit[] {
  const hits: CitationHit[] = []

  if (style === 'ieee') {
    for (const m of text.matchAll(IEEE_RE)) {
      hits.push({ from: m.index!, to: m.index! + m[0].length, inner: m[1] })
    }
    return hits
  }

  if (style === 'mla') {
    for (const m of text.matchAll(MLA_RE)) {
      if (knownMlaSurnames.has(m[1])) {
        hits.push({ from: m.index!, to: m.index! + m[0].length, inner: m[1] })
      }
    }
    return hits
  }

  // apa7 / harvard
  for (const m of text.matchAll(YEAR_STYLE_RE)) {
    const yearMatch = m[1].match(YEAR_SUFFIX_RE)
    if (!yearMatch) continue
    const authorInside = m[1].slice(0, yearMatch.index).replace(/,\s*$/, '').trim()
    if (!authorInside) {
      const narrative = text.slice(0, m.index).match(NARRATIVE_AUTHOR_TAIL_RE)
      if (narrative?.index !== undefined) {
        hits.push({ from: narrative.index, to: m.index! + m[0].length, inner: `${narrative[1]}, ${yearMatch[1]}` })
        continue
      }
    }
    hits.push({ from: m.index!, to: m.index! + m[0].length, inner: m[1] })
  }
  return hits
}

// ── Resolving a hit to a real source ────────────────────────────────────────

export interface ResolvedCitation {
  displayTitle:   string           // bold heading — literature title, or the raw matched text as fallback
  authors?:       string
  year?:          number | string
  abstract?:      string
  viewUrl?:       string           // DOI link when available
  doi?:           string           // bare DOI, for matching against CitationFlag.doi
  matchedSource:  boolean          // false => nothing in project literature matched; showing raw text only
}

function firstSurname(authors: string): string | null {
  return extractSurnamesFromAuthors(authors)[0] ?? null
}

// apa7/harvard: "Smith, 2023" / "Smith & Jones, 2023" / "Smith et al., 2023" → first surname + year.
function parseYearStyleInner(inner: string): { surname: string; year: string } | null {
  const yearMatch = inner.match(YEAR_SUFFIX_RE)
  if (!yearMatch) return null
  const authorPart  = inner.slice(0, yearMatch.index).trim().replace(/\s+et\s+al\.?\s*,?$/i, '')
  const surnameFirst = extractSurnamesFromAuthors(authorPart)[0]
  if (!surnameFirst) return null
  return { surname: surnameFirst, year: yearMatch[1].replace(/[a-z]$/, '') }
}

function resolveOne(clauseText: string, style: CitationStyle, literature: FetchedLiterature[]): ResolvedCitation | null {
  let match: FetchedLiterature | undefined

  if (style === 'mla') {
    match = literature.find(l => firstSurname(l.authors) === clauseText)
  } else {
    const parsed = parseYearStyleInner(clauseText)
    if (!parsed) return null
    match = literature.find(l =>
      firstSurname(l.authors) === parsed.surname && String(l.year) === parsed.year)
  }

  if (!match) {
    return {
      displayTitle:  `(${clauseText})`,
      matchedSource: false,
    }
  }

  return {
    displayTitle:  match.title,
    authors:       match.authors,
    year:          match.year,
    abstract:      match.abstract,
    viewUrl:       match.doi ? `https://doi.org/${match.doi}` : match.url,
    doi:           match.doi,
    matchedSource: true,
  }
}

// A single clicked span can hold a grouped Harvard/APA citation like "(Alabi, 2020;
// Moodley, 2024)" — each `;`-separated clause names its own author/year and must be
// resolved against the literature independently. Resolving the whole inner string as
// one clause (the previous behaviour) paired the FIRST surname with the LAST year,
// so "Alabi, 2020; Moodley, 2024" looked up "Alabi, 2024" — which matches neither real
// source — and only ever showed one (wrong) result. MLA/IEEE hits are never grouped
// this way (MLA has no year to anchor a `;` split on; IEEE resolves separately via
// resolveIeeeHit), so they always return a single-element array.
export function resolveHitAgainstLiterature(
  hit:       CitationHit,
  style:     CitationStyle,
  literature: FetchedLiterature[],
): ResolvedCitation[] | null {
  if (style === 'ieee') return null // needs the compiled bibliography — resolved separately

  if (style === 'mla') {
    const resolved = resolveOne(hit.inner, style, literature)
    return resolved ? [resolved] : null
  }

  const clauses = hit.inner.split(';').map(c => c.trim()).filter(Boolean)
  const resolved = clauses
    .map(clause => resolveOne(clause, style, literature))
    .filter((r): r is ResolvedCitation => r !== null)

  return resolved.length > 0 ? resolved : null
}

// IEEE resolves the bracketed index against the compiled bibliography (the same
// ordering used when the citation was inserted — see formatInTextCitation), then
// cross-matches into `literature` for the richer title/abstract/DOI fields.
export function resolveIeeeHit(
  hit:        CitationHit,
  bibliography: ParsedReference[],
  literature: FetchedLiterature[],
): ResolvedCitation | null {
  const index = parseInt(hit.inner, 10) - 1
  const ref = bibliography[index]
  if (!ref) return null

  const match = ref.surnames[0]
    ? literature.find(l => firstSurname(l.authors) === ref.surnames[0] && String(l.year) === ref.year)
    : undefined

  if (!match) {
    return {
      displayTitle:  ref.raw,
      viewUrl:       ref.doiUrl,
      matchedSource: false,
    }
  }

  return {
    displayTitle:  match.title,
    authors:       match.authors,
    year:          match.year,
    abstract:      match.abstract,
    viewUrl:       match.doi ? `https://doi.org/${match.doi}` : (match.url ?? ref.doiUrl),
    doi:           match.doi,
    matchedSource: true,
  }
}

// ── Citation integrity flags ─────────────────────────────────────────────────
// Matches CitationVerificationFlag rows (fetched per-section from the backend) back onto a
// resolved in-text citation, so DocumentSurface can decorate it and CitationPopover can show
// the mismatch detail. Matched by DOI; when the same source is cited more than once in a
// section (and so carries more than one flag), a best-effort proximity check against the
// surrounding document text picks the flag whose claim sentence actually appears nearby,
// rather than showing every occurrence of that source as flagged.

export function findFlagsForDoi(doi: string | undefined, flags: CitationFlag[]): CitationFlag[] {
  if (!doi) return []
  return flags.filter(f => f.status === 'Open' && f.doi.toLowerCase() === doi.toLowerCase())
}

export function findFlagForHit(
  doi:            string | undefined,
  surroundingText: string,
  flags:          CitationFlag[],
): CitationFlag | undefined {
  const candidates = findFlagsForDoi(doi, flags)
  if (candidates.length <= 1) return candidates[0]
  return candidates.find(f => f.claimSentence && surroundingText.includes(f.claimSentence)) ?? candidates[0]
}
