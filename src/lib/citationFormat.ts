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
  return authorBlock
    .split(/\s*(?:&|,?\s+and\s+|,)\s*/)
    .map(s => s.trim())
    .filter(Boolean)
}

// Pulls a surname out of an author token like "Smith, J." or "J. Smith" or "Smith".
function extractSurname(token: string): string | null {
  const commaForm = token.match(/^([A-Za-z'-]+),/)
  if (commaForm) return commaForm[1]
  const words = token.replace(/[.]/g, '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  return words[words.length - 1]
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

    const yearMatch = raw.match(/\((\d{4})\)/)
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
