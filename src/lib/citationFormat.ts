import type { CitationStyle } from '../types/research'

export interface ParsedReference {
  id:       number   // position in the compiled bibliography list — stable within a session
  surnames: string[] // extracted author surnames, in order; empty if unparseable
  year:     string | null
  raw:      string   // full display text for this entry (numbering stripped)
  doiUrl?:  string
  sourceId?: string  // ProjectLiterature id, when the entry came from the structured bibliography
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
const UNICODE_HYPHEN_VARIANTS_RE = /[‐-―−⁃]/g

// Same failure for apostrophes: OpenAlex/Crossref store "Al-Qora’n" with a typographic apostrophe
// (U+2019) while the drafted prose, or the editor's smart-quote autocorrect, uses the straight '
// (or the reverse), so the surnames compared unequal and a source that was in the pool showed as
// UNMATCHED (live, 2026-10-10, "(Al-Qora'n, 2025)"). Mirrors CitationResolver.FoldNamePunctuation
// in the backend; keep the two character sets identical.
const UNICODE_APOSTROPHE_VARIANTS_RE = /[‘’‛ʼ′`´]/g

/** Folds typographic hyphens and apostrophes to ASCII so two spellings of one name compare equal. */
export function foldNamePunctuation(s: string): string {
  return s.replace(UNICODE_HYPHEN_VARIANTS_RE, '-').replace(UNICODE_APOSTROPHE_VARIANTS_RE, "'")
}

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
  const normalized = foldNamePunctuation(token)
  const commaForm = normalized.match(/^([^,]+),/)
  if (commaForm) return commaForm[1]

  // Narrow compatibility for a common legacy MEDLINE shape. Structured fields
  // are authoritative; do not reinterpret arbitrary all-capital or multiword names.
  const medlineForm = normalized.match(/^([A-Z][a-z'-]{4,})\s+[A-Z]{2,4}$/)
  if (medlineForm) return medlineForm[1]

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
  let start = baseWords.length - 1
  while (start > 0 && NAME_PARTICLES.has(baseWords[start - 1].toLowerCase())) start--
  return baseWords.slice(start).join(' ').replace(/\./g, '')
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

// Parses ONE already-formatted reference (no numbering) into a structured row. Shared by the
// structured-bibliography path and the legacy numbered-text path below.
export function parseReferenceText(text: string, id: number, sourceId?: string): ParsedReference {
  const doiMatch = text.match(/https?:\/\/doi\.org\/\S+/)
  const doiUrl   = doiMatch?.[0]
  const raw      = doiUrl ? text.replace(doiUrl, '').trimEnd() : text
  const withSource = sourceId ? { sourceId } : {}

  const yearMatch = raw.match(/\((\d{4}[a-z]?)\)/i)
  if (!yearMatch) return { id, surnames: [], year: null, raw, doiUrl, ...withSource }

  const authorBlock = raw.slice(0, yearMatch.index).trim()
  const surnames = splitAuthorBlock(authorBlock)
    .map(extractSurname)
    .filter((s): s is string => !!s)

  return { id, surnames, year: yearMatch[1], raw, doiUrl, ...withSource }
}

// Structured entries from GET /bibliography. Order is the server's; nothing is read from numbering.
export function parseBibliographyResultEntries(
  entries: ReadonlyArray<{ sourceId: string; formattedText: string }>,
): ParsedReference[] {
  return entries.map((e, id) => parseReferenceText(e.formattedText.trim(), id, e.sourceId))
}

// LEGACY: parses the numbered text block returned by the compile-bibliography endpoint, which
// other screens still consume. The Research Agent's References panel no longer uses this — it
// reads structured entries so a change in numbering can't silently drop references.
export function parseBibliographyEntries(compiled: string): ParsedReference[] {
  const lines = compiled
    .split('\n')
    .filter(l => /^\d+\.\s/.test(l.trim()))
    .map(l => l.trim())

  return lines.map((line, id) => parseReferenceText(line.replace(/^\d+\.\s*/, ''), id))
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
  authorDetails?: ReadonlyArray<{ family?: string | null; given?: string | null; name?: string | null }>
  year?:    number | null
  venue?:   string | null
  url?:     string | null
  doi?:     string | null
  volume?:  string | null
  issue?:   string | null
  pages?:   string | null
  publisher?: string | null
  // "2020a"/"2020b" when two works share author and year (see orderEssayReferences).
  yearLabel?: string | null
}

const NUMBERED_ESSAY_STYLES: EssayCitationStyleName[] = ['Ieee', 'Vancouver']

export function essayAuthorSurnames(meta: EssayReferenceMeta): string[] {
  if (meta.authorDetails?.length && meta.authorDetails.every(a => a.family?.trim()))
    return meta.authorDetails.map(a => a.family!.trim())
  return meta.authors ? extractSurnamesFromAuthors(meta.authors) : []
}

export function formatEssayInTextCitation(
  meta: EssayReferenceMeta,
  style: EssayCitationStyleName,
  indexInList: number,
): string {
  if (NUMBERED_ESSAY_STYLES.includes(style)) return `[${indexInList + 1}]`

  const surnames = essayAuthorSurnames(meta)
  const year = meta.yearLabel ?? meta.year ?? 'n.d.'
  if (surnames.length === 0) {
    const short = meta.title.length > 40 ? `${meta.title.slice(0, 40)}…` : meta.title
    return `(${short}, ${year})`
  }
  if (surnames.length === 1) return `(${surnames[0]}, ${year})`
  // Harvard and Chicago join two authors with "and", in the text as in the reference list; only APA uses "&".
  if (surnames.length === 2) return `(${surnames[0]} ${style === 'Apa7' ? '&' : 'and'} ${surnames[1]}, ${year})`
  if ((style === 'Chicago' || style === 'Harvard') && surnames.length === 3) return `(${surnames[0]}, ${surnames[1]}, and ${surnames[2]}, ${year})`
  return `(${surnames[0]} et al., ${year})`
}

export function formatEssayNarrativeCitation(meta: EssayReferenceMeta, style: EssayCitationStyleName, indexInList: number): string {
  if (NUMBERED_ESSAY_STYLES.includes(style)) return `[${indexInList + 1}]`
  const surnames = essayAuthorSurnames(meta)
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
    : (style === 'Chicago' || style === 'Harvard') && surnames.length === 3 ? `${surnames[0]}, ${surnames[1]}, and ${surnames[2]}`
    : `${surnames[0]} et al.`
  return `${names} (${year})`
}


// ── Reference-list entries ──────────────────────────────────────────────────────────────────────────
// Seen in a generated essay: "C. Azionya, Abyshey Nhedzi (2021) 'THE DIGITAL DIVIDE AND ...', Health SA = SA Gesondheid".
// Author names were printed as stored (first-name-first, mixed initials and full names), an ALL-CAPS title was kept, and a
// parallel journal title ("A = B") was printed whole. The helpers below put names into the style's own form and tidy the title
// and venue. They only ever re-format what the record holds; nothing is invented.

const NAME_PARTICLES = new Set(['de', 'del', 'della', 'der', 'den', 'di', 'da', 'dos', 'das', 'du', 'la', 'le', 'van', 'von', 'bin', 'ibn', 'al', 'el', 'ten', 'ter'])

interface PersonName { family: string; given: string }

/** CSL input uses the same conservative name parsing as existing metadata displays. */
export function referenceAuthorNames(meta: EssayReferenceMeta): Array<{ family: string; given: string } | { literal: string }> {
  if (meta.authorDetails?.length && meta.authorDetails.every(a => a.family?.trim() || a.name?.trim()))
    return meta.authorDetails.map(a => a.family?.trim()
      ? { family: a.family.trim(), given: a.given?.trim() ?? '' } : { literal: a.name!.trim() })
  const organization = /\b(universit(?:y|ies)|institutes?|organizations?|organisations?|associations?|councils?|commissions?|committees?|departments?|ministr(?:y|ies)|United Nations|World Bank)\b/i
  if (meta.authors && organization.test(meta.authors) && !meta.authors.includes(';')) return [{ literal: meta.authors.trim() }]
  // Semicolons are explicit author boundaries in structured imports; do not collapse
  // "Jane Smith; Kim Jones" into one person or split surname-first names at commas.
  const explicitAuthors = meta.authors?.includes(';') ?? false
  const tokens = explicitAuthors ? meta.authors!.split(';').map(name => name.trim()).filter(Boolean) : splitAuthorBlock(meta.authors ?? '')
  if (!explicitAuthors && tokens.length >= 2 && tokens.every(t => !t.includes(' ') && !t.includes(',') && t.replace(/\./g, '').length > 1))
    return meta.authors?.trim() ? [{ literal: meta.authors.trim() }] : []
  return tokens.flatMap<PersonName | { literal: string }>(token => {
    if (organization.test(token)) return [{ literal: token }]
    const person = parsePerson(token)
    return person ? [person] : []
  })
}

function isTwoOrThreeCapInitials(w: string): boolean { return /^[A-Z]{1,3}$/.test(w) }

function parsePerson(token: string): PersonName | null {
  const t = foldNamePunctuation(token).trim()
  if (!t) return null
  const comma = t.indexOf(',')
  if (comma > 0) return { family: t.slice(0, comma).trim(), given: t.slice(comma + 1).replace(/,/g, ' ').trim() }

  const words = t.split(/\s+/)
  if (words.length === 1) return { family: words[0].replace(/\./g, ''), given: '' }

  const surname = extractSurname(t)
  const bare = words.map(w => w.replace(/\./g, ''))
  let idx = surname ? bare.lastIndexOf(surname.split(/\s+/).at(-1)!) : -1
  // "Sadeghi D." / "Smithies TD": the family name comes first and only initials follow it.
  if (surname && bare[0] === surname && words.slice(1).every(w => isInitialToken(w) || isTwoOrThreeCapInitials(w))) idx = 0
  if (idx < 0) return { family: t, given: '' }
  if (idx === 0) return { family: bare[0], given: words.slice(1).join(' ') }

  // "Given [Middle] [particles] Family": a lower-case particle belongs to the family name ("de la Cruz").
  let start = idx
  while (start > 0 && NAME_PARTICLES.has(words[start - 1].toLowerCase())) start--
  return { family: words.slice(start, idx + 1).join(' ').replace(/\./g, ''), given: words.slice(0, start).join(' ') }
}

/** "Mary Ann" -> ['M','A'], "TD" (already initials) -> ['T','D'], "J.H." -> ['J','H'], "Jean-Pierre" -> ['J-P']. */
function initialsOf(given: string): string[] {
  const out: string[] = []
  for (const word of given.replace(/\./g, ' ').replace(/[^\p{L}\s-]/gu, '').trim().split(/\s+/).filter(Boolean)) {
    if (/^[A-Z]{2,3}$/.test(word)) { out.push(...word.split('')); continue }
    out.push(word.split('-').filter(Boolean).map(p => p.charAt(0).toUpperCase()).join('-'))
  }
  return out
}

type ReferenceFamily = 'harvard' | 'apa' | 'chicago' | 'ieee' | 'vancouver'

function referenceFamily(style: EssayCitationStyleName): ReferenceFamily {
  switch (style) {
    case 'Apa7': return 'apa'
    case 'Chicago': return 'chicago'
    case 'Ieee': return 'ieee'
    case 'Vancouver': return 'vancouver'
    default: return 'harvard'
  }
}

function dotted(initials: string[], joiner: string): string {
  return initials.map(i => i.split('-').map(p => `${p}.`).join('-')).join(joiner)
}

function formatPerson(p: PersonName, family: ReferenceFamily, first: boolean): string {
  const ini = initialsOf(p.given)
  if (ini.length === 0) return p.family
  switch (family) {
    case 'harvard': return `${p.family}, ${dotted(ini, '')}`
    case 'apa': return `${p.family}, ${dotted(ini, ' ')}`
    case 'chicago': return first ? `${p.family}, ${dotted(ini, ' ')}` : `${dotted(ini, ' ')} ${p.family}`
    case 'ieee': return `${dotted(ini, ' ')} ${p.family}`
    case 'vancouver': return `${p.family} ${ini.map(i => i.replace(/-/g, '')).join('')}`
  }
}

/**
 * The author block of a reference-list entry in the style's own form: Harvard "Azionya, C. and Nhedzi, A.", APA "Azionya, C., &
 * Nhedzi, A.", Chicago "Azionya, C., and A. Nhedzi", IEEE "C. Azionya and A. Nhedzi", Vancouver "Azionya C, Nhedzi A". Structured
 * authorDetails win over the stored "authors" string. Null when no author is known.
 */
export function formatReferenceAuthors(meta: EssayReferenceMeta, style: EssayCitationStyleName): string | null {
  const structured = meta.authorDetails?.length && meta.authorDetails.every(a => a.family?.trim())
  const tokens = structured ? [] : splitAuthorBlock(meta.authors ?? '')
  // "Smith, John" (every token a single word) cannot be told from two authors, "Smith" and "John". Guessing would put a wrong
  // name in front of a reader, so the stored text is kept as it is, as the backend's AuthorsFromStored does.
  if (!structured && tokens.length >= 2 && tokens.every(t => !t.includes(' ') && !t.includes(',') && t.replace(/\./g, '').length > 1))
    return meta.authors?.trim() || null
  const people: PersonName[] = structured
    ? meta.authorDetails!.map(a => ({ family: a.family!.trim(), given: (a.given ?? '').trim() }))
    : tokens.map(parsePerson).filter((p): p is PersonName => p !== null)
  if (people.length === 0) return meta.authors?.trim() || null

  const family = referenceFamily(style)
  const names = people.map((p, i) => formatPerson(p, family, i === 0))
  const last = names[names.length - 1]
  const head = names.slice(0, -1)
  switch (family) {
    case 'harvard':
      if (names.length === 1) return last
      return names.length > 10 ? `${names.slice(0, 10).join(', ')} et al.` : `${head.join(', ')} and ${last}`
    case 'apa':
      if (names.length === 1) return last
      if (names.length > 20) return `${names.slice(0, 19).join(', ')}, . . . ${last}`
      return `${head.join(', ')}, & ${last}`
    case 'chicago':
      if (names.length === 1) return last
      if (names.length > 10) return `${names.slice(0, 7).join(', ')}, et al.`
      return names.length === 2 ? `${head[0]}, and ${last}` : `${head.join(', ')}, and ${last}`
    case 'ieee':
      if (names.length === 1) return last
      if (names.length > 6) return `${names[0]} et al.`
      return names.length === 2 ? `${head[0]} and ${last}` : `${head.join(', ')}, and ${last}`
    case 'vancouver':
      return names.length > 6 ? `${names.slice(0, 6).join(', ')}, et al.` : names.join(', ')
  }
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'with'])
const KEEP_UPPER = new Set(['covid-19', 'covid', 'ict', 'icts', 'ai', 'usa', 'uk', 'hiv', 'aids', 'sars', 'stem', 'nsfas', 'sa', 'eu', 'un', 'who', 'it', 'lms', 'mooc', 'moocs'])

function isMostlyUpperCase(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, '')
  if (letters.length < 8) return false
  return letters.replace(/[^\p{Lu}]/gu, '').length / letters.length >= 0.7
}

function titleCase(s: string): string {
  let afterColon = true
  return s.toLowerCase().split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part) || part === '') return part
    const bare = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    const out = KEEP_UPPER.has(bare) ? part.replace(bare, bare.toUpperCase())
      : !afterColon && SMALL_WORDS.has(bare) ? part
      : part.replace(/\p{L}/u, c => c.toUpperCase())
    afterColon = /[:?]$/.test(part)
    return out
  }).join('')
}

/** An ALL-CAPS title is put into title case (sentence case would lose proper nouns); any other title is left as the record has it. */
export function normalizeReferenceTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, ' ')
  return isMostlyUpperCase(t) ? titleCase(t) : t
}

/** A parallel journal title ("Health SA = SA Gesondheid") keeps its first part; an ALL-CAPS venue is put into title case. */
export function normalizeReferenceVenue(venue?: string | null): string | null {
  if (!venue) return null
  const first = venue.split(/\s+=\s+/)[0].trim().replace(/\s+/g, ' ').replace(/\s+:/g, ':')
  if (!first) return null
  return isMostlyUpperCase(first) ? titleCase(first) : first
}

// One rule for volume, issue and pages across every reference, whatever the source data looks like: "Vol. 12" and "12" both
// render "12", an issue alone renders "no. 3" (never a stray "(3)"), a page range uses an en dash, one page is "p. 5", and an
// article number ("e0123", "Article 45") is not given a "pp." prefix.
const clean = (v?: string | null): string => (v ?? '').trim().replace(/\s+/g, ' ')

export function formatReferenceVolumeIssue(volume?: string | null, issue?: string | null): string {
  const vol = clean(volume).replace(/^(?:vol(?:ume)?\.?\s*)/i, '')
  const iss = clean(issue).replace(/^(?:iss(?:ue)?\.?|no\.?|number)\s*/i, '')
  if (vol) return `, ${vol}${iss ? `(${iss})` : ''}`
  return iss ? `, no. ${iss}` : ''
}

export function formatReferencePages(pages?: string | null): string {
  const raw = clean(pages).replace(/^(?:pp?\.?\s*)/i, '')
  if (!raw) return ''
  const range = raw.match(/^(\d+)\s*[-‐-―]+\s*(\d+)$/)
  if (range) return range[1] === range[2] ? `, p. ${range[1]}` : `, pp. ${range[1]}–${range[2]}`
  if (/^\d+$/.test(raw)) return `, p. ${raw}`
  if (/^(?:article\s+)?[A-Za-z]*\d[\w.-]*$/i.test(raw)) return `, ${/^article/i.test(raw) ? raw : `Article ${raw}`}`
  return `, ${raw}`
}

// ── Citation tidy-up ────────────────────────────────────────────────────────────────────────────────
// Deterministic fixes applied after [S#] tokens are resolved, for punctuation and grammar the drafting model should never be
// asked to get right: "(Kwok et al., 2021) ." (a space left before the full stop), "Al-Rahmi et al. (2014) (Sobaih et al., 2020)"
// (a narrative citation immediately followed by a second one), "(Kwok et al., 2021) utilized" (a parenthetical used as the subject)
// and "Baloyi et al. (2022) reports" ("et al." is plural).

const AUTHOR_NAME = String.raw`[A-Z][\p{L}'’-]+(?:\s+et\s+al\.|\s+(?:and|&)\s+[A-Z][\p{L}'’-]+)?`
const YEAR = String.raw`(?:19|20)\d{2}[a-z]?`
const REPORTING_VERBS = 'found|showed|reported|utili[sz]ed|used|measured|examined|studied|argued|noted|observed|documented|demonstrated|concluded|compared|focused|stated|described|suggested|highlighted|identified|explored|analy[sz]ed|investigated|surveyed|interviewed|tested|assessed|evaluated|confirmed|conducted|reviewed|developed|proposed|offered|provided|presented|linked|indicated|revealed'
  + '|reports|finds|shows|argues|notes|states|describes|suggests|highlights|identifies|explores|concludes|examines|uses|measures|observes|demonstrates|indicates|reveals|offers|provides|presents'

const PLURAL_VERB: Record<string, string> = {
  reports: 'report', finds: 'find', shows: 'show', argues: 'argue', notes: 'note', states: 'state', describes: 'describe', suggests: 'suggest',
  highlights: 'highlight', identifies: 'identify', explores: 'explore', concludes: 'conclude', examines: 'examine', uses: 'use',
  measures: 'measure', observes: 'observe', demonstrates: 'demonstrate', indicates: 'indicate', reveals: 'reveal', offers: 'offer',
    provides: 'provide', presents: 'present', interprets: 'interpret', traces: 'trace',
}

export function tidyEssayCitations(text: string, connector: '&' | 'and' = '&'): string {
  return text
    // "(Kwok et al., 2021) utilized" -> "Kwok et al. (2021) utilized"
    .replace(new RegExp(String.raw`\((${AUTHOR_NAME}),\s*(${YEAR})\)(?=\s+(?:${REPORTING_VERBS})\b)`, 'gu'),
      (_m, names: string, year: string) => `${names.replace(/\s*&\s*/g, ' and ')} (${year})`)
    // "Al-Rahmi et al. (2014) (Sobaih et al., 2020)" -> "(Al-Rahmi et al., 2014; Sobaih et al., 2020)"
    .replace(new RegExp(String.raw`\b(${AUTHOR_NAME})\s+\((${YEAR})\)\s+\(([^()]*\b${YEAR}[^()]*)\)`, 'gu'),
      (_m, names: string, year: string, other: string) => `(${names.replace(/\s+and\s+/g, ` ${connector} `)}, ${year}; ${other})`)
    // "(Kwok et al., 2021) ." -> "(Kwok et al., 2021)."
    .replace(new RegExp(String.raw`(\([^()]*\b${YEAR}[^()]*\))\s+([.,;:!?])`, 'g'), '$1$2')
    // "Baloyi et al. (2022) reports" / "Azionya and Nhedzi (2021) reports" -> plural verb
    .replace(new RegExp(String.raw`((?:et\s+al\.|[A-Z][\p{L}'’-]+\s+and\s+[A-Z][\p{L}'’-]+)\s+\(${YEAR}\))\s+(${Object.keys(PLURAL_VERB).join('|')})\b`, 'gu'),
      (_m, who: string, verb: string) => `${who} ${PLURAL_VERB[verb]}`)
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
  const authorsPart = formatReferenceAuthors(meta, style)
  const title = normalizeReferenceTitle(meta.title)
  const venue = normalizeReferenceVenue(meta.venue)
  const year = meta.yearLabel ?? meta.year ?? 'n.d.'
    const publisher = meta.publisher?.trim()
    const venuePart = (venue ? `, ${venue}` : '') + (publisher && publisher !== venue ? `, ${publisher}` : '')
  const volumeIssue = formatReferenceVolumeIssue(meta.volume, meta.issue)
  const pagesPart = formatReferencePages(meta.pages)
  const normalizedDoi = meta.doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  const stableUrl = normalizedDoi ? `https://doi.org/${normalizedDoi}` : meta.url
  const urlPart = stableUrl ? normalizedDoi ? ` doi:${normalizedDoi}.` : ` Available at: ${stableUrl}.` : ''

  if (NUMBERED_ESSAY_STYLES.includes(style))
    return authorsPart
      ? `[${indexInList + 1}] ${authorsPart}, "${title}"${venuePart}${volumeIssue}${pagesPart}, ${year}.${urlPart}`
      : `[${indexInList + 1}] "${title}" (author not available)${venuePart}${volumeIssue}${pagesPart}, ${year}.${urlPart}`

  // Harvard / Apa7 / Chicago all share this author-date shape closely enough for a single
  // reasonable rendering — full per-style punctuation rules (Apa7's italicised venue, Chicago's
  // footnote variant) are a further-refinement, not something the current [S1]-token bug leaves
  // room to get wrong today.
  return authorsPart
    ? `${authorsPart} (${year}) '${title}'${venuePart}${volumeIssue}${pagesPart}.${urlPart}`
    : `'${title}' (author not available, ${year})${venuePart}${volumeIssue}${pagesPart}.${urlPart}`
}
