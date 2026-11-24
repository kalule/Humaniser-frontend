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
  /** Source-quality warnings: "n.d.", "Abstract only", "Different population or field", "Not peer reviewed". */
  qualityFlags?:  string[]
  /** Where the verdict came from: the in-place "Check citations" run, or the automatic post-draft check. */
  checkedBy?:     'section_check' | 'auto'
  // PR 10: the source card.
  doi?:           string
  journal?:       string | null
  evidenceLevel?: string | null
  verification?:  CitationVerification
  /** The passage the claim check read, when it kept one. */
  passage?:       { quote: string; location: string | null } | null
}

/**
 * PR 10: one status per cited source. "Claim supported" only when a check said so (the in-place check's Supported
 * verdict); the automatic check records problems only, so its silence is "metadata verified" at most.
 */
export type CitationVerification = 'mismatch' | 'claim_supported' | 'metadata_verified' | 'unchecked'

export const VERIFICATION_LABEL: Record<CitationVerification, string> = {
  mismatch:          'Mismatch',
  claim_supported:   'Claim supported',
  metadata_verified: 'Metadata verified',
  unchecked:         'Unchecked',
}

const METADATA_MISMATCH = new Set(['JournalMismatch', 'AuthorMismatch', 'VenueMismatch', 'BibliographicDetailMismatch'])

export function verificationOf(support: ClaimSupport, lit: FetchedLiterature | undefined, flag: CitationFlag | undefined,
  check: SectionCheckVerdict | undefined): CitationVerification {
  if (support === 'not_supported' || support === 'partly' || lit?.doiVerification === 'Mismatch'
    || flag?.mismatchTypes.some(t => METADATA_MISMATCH.has(t))) return 'mismatch'
  if (check?.verdict === 'Supported') return 'claim_supported'
  if (lit?.doiVerification === 'Verified' || lit?.doiVerification === 'SingleRegistry') return 'metadata_verified'
  return 'unchecked'
}

/** The server's source-quality flags (SourceQuality), as the card words them. */
export const SERVER_QUALITY_LABEL: Record<string, string> = {
  retracted:            'Retracted',
  preprint:             'May not be peer reviewed',
  protocol:             'Protocol, not results',
  conference_abstract:  'Conference paper or abstract',
  low_visibility_venue: 'Low-visibility venue',
  non_english_title:    'Non-English title',
}

/** The dot shown on each in-text citation. */
export type CitationVerdictDot = 'supports' | 'partly' | 'not_supported' | 'unchecked'

export const VERDICT_DOT_LABEL: Record<CitationVerdictDot, string> = {
  supports:      'Supports the claim',
  partly:        'Partly supports the claim',
  not_supported: 'Does not support the claim',
  unchecked:     'Not checked',
}

export function verdictDot(support: ClaimSupport): CitationVerdictDot {
  if (support === 'no_issues') return 'supports'
  if (support === 'partly') return 'partly'
  if (support === 'not_supported') return 'not_supported'
  return 'unchecked'
}

/** Worst verdict across the sources one citation names ("(A, 2020; B, 2021)"). */
export function worstDot(entries: readonly Pick<CitationCardEntry, 'support'>[]): CitationVerdictDot {
  const dots = entries.map(e => verdictDot(e.support))
  for (const d of ['not_supported', 'partly', 'unchecked'] as const) if (dots.includes(d)) return d
  return dots.length ? 'supports' : 'unchecked'
}

/**
 * One citation's result from the in-place "Check citations" run (the Citation Checker's judge run
 * on this section). Kept for the session; the dots read it before the automatic flags.
 */
export interface SectionCheckVerdict {
  markerText:    string
  citedAuthors?: string | null
  citedYear?:    string | null
  claimText:     string
  /** Supported | PartiallySupported | NotSupported | Contradicted | CannotVerify; null = not reached. */
  verdict:       string | null
  failureType:   string | null
  reasoning:     string | null
  flags:         string[]
}

const CLAIM_NOT_SUPPORTED = new Set(['ClaimContentMismatch', 'Contradicted'])
const CLAIM_PARTLY = new Set(['ClaimPartialMatch', 'GeneralizationBeyondSample', 'PopulationScopeViolation', 'GeographicMismatch',
  'WeaklySupported', 'Overstated', 'OverclaimedFinding', 'CausalOverreach'])

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
  WeaklySupported:            'The source only weakly supports this claim.',
  Overstated:                 'The claim says more than the source shows.',
  Contradicted:               'The source contradicts this claim.',
  OverusedAcrossDocument:     'This source is also cited in several other sections.',
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
  /** Results of this section's in-place "Check citations" run, if one finished this session. */
  checks?:      SectionCheckVerdict[]
}

// A project can hold thousands of sources and the editor scans every text node on redraw, so the
// surname set is built once per literature array, not once per text node.
const mlaSurnameCache = new WeakMap<readonly FetchedLiterature[], Set<string>>()

export function knownMlaSurnames(literature: FetchedLiterature[]): Set<string> {
  let set = mlaSurnameCache.get(literature)
  if (!set) {
    set = new Set(literature.map(l => extractSurnamesFromAuthors(l.authors)[0]).filter((s): s is string => !!s))
    mlaSurnameCache.set(literature, set)
  }
  return set
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

const words = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
const overlap = (a: string, b: string) => {
  const x = words(a), y = words(b)
  if (!x.size || !y.size) return 0
  let n = 0
  for (const w of x) if (y.has(w)) n++
  return n / Math.min(x.size, y.size)
}
const squash = (t: string) => t.replace(/\\/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** The in-place check result for one cited source in this citation, matched on marker, author/year and claim. */
export function findCheckFor(checks: readonly SectionCheckVerdict[] | undefined, hitText: string, clause: string,
  surname: string | undefined, year: string | number | undefined, surroundingText: string): SectionCheckVerdict | undefined {
  if (!checks?.length) return undefined
  const marker = squash(hitText)
  const candidates = checks.filter(c => {
    const m = squash(c.markerText)
    if (!(m === marker || m.includes(squash(clause)) || marker.includes(m))) return false
    if (surname && c.citedAuthors && !c.citedAuthors.toLowerCase().includes(surname.toLowerCase())) return false
    if (year && c.citedYear && String(c.citedYear) !== String(year)) return false
    return true
  })
  if (candidates.length <= 1) return candidates[0]
  // The same citation in several paragraphs: the one whose checked claim is in this paragraph.
  return [...candidates].sort((a, b) => overlap(b.claimText, surroundingText) - overlap(a.claimText, surroundingText))[0]
}

function supportFromCheck(check: SectionCheckVerdict): ClaimSupport {
  switch (check.verdict) {
    case 'Supported':          return 'no_issues'
    case 'PartiallySupported': return 'partly'
    case 'NotSupported':
    case 'Contradicted':       return 'not_supported'
    case null:                 return 'checking'
    default:                   return 'not_checked'
  }
}

const CHECK_FAILURE_NOTE: Partial<Record<string, string>> = {
  OutcomePredictorInversion: 'Cause and effect are the other way round in the source.',
  DesignTypeMismatch:        'The source’s study design cannot support this claim.',
  HedgeInversion:            'The claim is more certain than the source.',
  PopulationBleed:           'The source studied a different population.',
  CrossDomainBleed:          'The source is about a different field.',
}

const OFF_SECTOR = new Set(['PopulationScopeViolation', 'GeographicMismatch', 'GeneralizationBeyondSample'])
const NOT_PEER_REVIEWED = /arxiv|ssrn|researchgate|preprint|repository|handle\.net|biorxiv|medrxiv|osf\.io|zenodo|figshare|academia\.edu|scribd/i
const PREPRINT_DOI = /^10\.(?:48550|2139|31219|31235|1101|5281|6084|21203|20944)\//

/** Source-quality warnings for one cited source, from what the project holds about it. */
export function sourceQualityFlags(lit: FetchedLiterature | undefined, clause: string, flag: CitationFlag | undefined,
  check: SectionCheckVerdict | undefined): string[] {
  const out: string[] = []
  if (/\bn\.\s?d\./i.test(clause) || (lit && (!lit.year || lit.year <= 0))) out.push('n.d. (no year)')
  if (lit && lit.hasFullText === false) out.push('Abstract only')
  if (flag?.mismatchTypes.some(t => OFF_SECTOR.has(t)) || check?.failureType === 'PopulationBleed' || check?.failureType === 'CrossDomainBleed') {
    out.push('Different population, place or field')
  }
  if (lit && (NOT_PEER_REVIEWED.test(`${lit.url ?? ''} ${lit.source ?? ''}`) || (lit.doi && PREPRINT_DOI.test(lit.doi)))) out.push('May not be peer reviewed')
  // PR 10: the server's flags (retracted first). Flags are for the student; nothing is excluded.
  for (const f of lit?.qualityFlags ?? []) {
    const label = SERVER_QUALITY_LABEL[f]
    if (!label || out.includes(label)) continue
    if (f === 'retracted') out.unshift(label)
    else out.push(label)
  }
  if (lit?.isRetracted && !out.includes('Retracted')) out.unshift('Retracted')
  return out
}

/** One entry per cited source in the hit ("(A, 2020; B, 2021)" gives two). */
const hitTextOf = (hit: CitationHit & { text?: string }) => hit.text ?? `(${hit.inner})`

export function describeCitation(hit: CitationHit & { text?: string }, surroundingText: string, ctx: CitationContext, dirty = false): CitationCardEntry[] {
  const resolved = ctx.style === 'ieee'
    ? (() => { const r = resolveIeeeHit(hit, ctx.bibliography, ctx.literature); return r ? [r] : [] })()
    : resolveHitAgainstLiterature(hit, ctx.style, ctx.literature) ?? []
  const clauses = ctx.style === 'ieee' || ctx.style === 'mla' ? [hit.inner] : hit.inner.split(';').map(c => c.trim()).filter(Boolean)
  if (resolved.length === 0) {
    return [{ clause: hit.inner, title: `(${hit.inner})`, sourceExists: false, ambiguous: false, fullTextPinned: null,
      support: 'not_checked', note: ctx.style === 'ieee' ? 'This number is not in the reference list yet.' : 'No pinned source matches this citation.' }]
  }
  const hitText = hitTextOf(hit)
  return resolved.map((r, i) => {
    const flag = r.matchedSource ? findFlagForHit(r.doi, surroundingText, ctx.flags) : undefined
    const lit = literatureFor(r, ctx.literature)
    const clause = clauses[i] ?? hit.inner
    const surname = r.authors ? extractSurnamesFromAuthors(r.authors)[0] : undefined
    const check = findCheckFor(ctx.checks, hitText, clause, surname, r.year, surroundingText)
    let support = check ? supportFromCheck(check) : supportFrom(flag, ctx.pending, r.matchedSource)
    let note = check
      ? (CHECK_FAILURE_NOTE[check.failureType ?? ''] ?? check.reasoning?.split(/(?<=\.)\s/)[0] ?? null)
      : (noteFrom(flag) ?? (r.matchedSource ? null : 'No pinned source matches this citation.'))
    // The text around the citation changed after it was checked: the verdict no longer applies.
    if (dirty && r.matchedSource) { support = 'not_checked'; note = 'The text around this citation changed since it was checked. Run Check citations again.' }
    return {
      clause,
      title:          r.displayTitle,
      authors:        r.authors,
      year:           r.year,
      sourceExists:   r.matchedSource,
      ambiguous:      (r.candidates?.length ?? 0) > 1,
      fullTextPinned: lit ? lit.hasFullText === true : null,
      support,
      note,
      viewUrl:        r.viewUrl,
      literatureId:   lit?.id,
      qualityFlags:   sourceQualityFlags(lit, clause, flag, check),
      checkedBy:      check ? 'section_check' : 'auto',
      doi:            lit?.doi ?? r.doi ?? undefined,
      journal:        lit?.journal ?? null,
      evidenceLevel:  lit?.evidenceLevel ?? null,
      verification:   r.matchedSource ? verificationOf(support, lit, flag, check) : 'unchecked',
      passage:        flag?.evidenceQuote ? { quote: flag.evidenceQuote, location: flag.evidenceLocation ?? null } : null,
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

/**
 * The citation text with one cited source taken out: "(A, 2020; B, 2021)" minus B gives
 * "(A, 2020)"; the only source of a parenthetical citation gives "" (the whole citation goes).
 * Null for a narrative citation ("Klishi (2024) found..."), where removing the name breaks the
 * sentence, and for IEEE numbers.
 */
export function removeCitationText(hitText: string, clauseIndex: number, style: CitationStyle): string | null {
  if (style === 'ieee' || !hitText.startsWith('(') || !hitText.endsWith(')')) return null
  const clauses = hitText.slice(1, -1).split(';').map(c => c.trim()).filter(Boolean)
  if (clauseIndex < 0 || clauseIndex >= clauses.length) return null
  clauses.splice(clauseIndex, 1)
  return clauses.length ? `(${clauses.join('; ')})` : ''
}

/** A new parenthetical citation for a pinned source ("(Klishi, 2024)"); null for IEEE, whose numbers come from the compiled list. */
export function inTextCitationFor(source: FetchedLiterature, style: CitationStyle): string | null {
  if (style === 'ieee') return null
  const surnames = extractSurnamesFromAuthors(source.authors)
  if (surnames.length === 0) return null
  const ref: ParsedReference = { id: 0, surnames, year: source.year ? String(source.year) : 'n.d.', raw: source.title }
  return formatInTextCitation(ref, style, 0)
}
