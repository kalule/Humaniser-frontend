import type { CitationCard } from '../types/citationCheck'
import { verdictMeta, type Meta } from './citationCheckView'

// What a card's buttons and header do, kept apart from the JSX so the rules can be tested. Nothing here changes a draft except
// insertReference, which only ever ADDS one clearly marked line, and only when the writer clicks.

// ── Source link ─────────────────────────────────────────────────────────────────────────────────

/**
 * The server builds the source link from a validated DOI, but the browser is the last line of defence: only an https URL is ever turned into a
 * link, so a "javascript:" or "data:" value (from a bug, a tampered response, anything) renders as no link at all.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

// ── Title and badge ─────────────────────────────────────────────────────────────────────────────

/** The one work this card is about. A marker like "(Smith, 2020; Jones, 2019)" is two cards, so the marker alone would title both the same. */
export const cardTitle = (card: Pick<CitationCard, 'citedLabel' | 'markerText'>): string => card.citedLabel?.trim() || card.markerText

const REFERENCE_FLAGS = ['NoReferenceList', 'OrphanCitation', 'YearMismatch', 'AmbiguousReference', 'SourceNotFound'] as const

/** True when the citation has no entry in the writer's reference list that we could match: the one case a reference line can fix. */
export const needsReferenceEntry = (card: Pick<CitationCard, 'flags' | 'locked'>): boolean =>
  !card.locked && (card.flags.includes('NoReferenceList') || card.flags.includes('OrphanCitation'))

/**
 * The card's main badge. When the reason a citation could not be judged is a reference-list problem, say THAT ("Missing reference") instead of
 * the vaguer "Could not verify". For everything else the verdict speaks. Null when there is no verdict yet and no reference problem to report.
 */
export function primaryBadge(card: Pick<CitationCard, 'flags' | 'verdict'>): Meta | null {
  if (card.flags.includes('NoReferenceList'))
    return { label: 'No reference list', tone: 'warning', hint: 'Add a "References" section so each citation can be matched to a paper.' }
  if (card.flags.includes('OrphanCitation'))
    return { label: 'Missing reference', tone: 'warning', hint: 'This citation has no entry in your reference list.' }
  // The entry exists but no database has the work. Said once, as the main badge, in the careful words: we could not find it, which is not
  // the same as proving it does not exist.
  if (card.flags.includes('SourceNotFound'))
    return { label: 'Source not found', tone: 'warning', hint: 'We could not find this source in the databases we search. It may still exist.' }
  // The list HAS this author: the fix is a year, not a new entry, so this is deliberately not offered "Add entry to References".
  // When the server judged the claim against that one entry, the verdict is the main badge and the year stays visible as a chip beside it.
  if (card.flags.includes('YearMismatch') && !isJudgedYearLink(card))
    return { label: "Year doesn't match", tone: 'warning', hint: 'Your reference list has this author with a different year. Check the year in your text or your list.' }
  if (card.flags.includes('AmbiguousReference'))
    return { label: 'Ambiguous reference', tone: 'warning', hint: 'It matches more than one entry. Add a year letter (2020a) or a second author.' }
  return card.verdict ? verdictMeta(card.verdict.verdict) : null
}

/** A year-mismatched citation that was nonetheless judged against the one same-author entry (a real verdict, not "could not verify"). */
export function isJudgedYearLink(card: Pick<CitationCard, 'flags' | 'verdict'>): boolean {
  return card.flags.includes('YearMismatch') && !!card.verdict && card.verdict.verdict !== 'CannotVerify'
}

/** The flags still worth a chip once the main badge has said its piece (no repeating "Missing reference" twice). */
export function chipFlags(card: Pick<CitationCard, 'flags'> & Partial<Pick<CitationCard, 'verdict'>>): string[] {
  const judged = isJudgedYearLink({ flags: card.flags, verdict: card.verdict ?? null })
  return card.flags.filter(f => f === 'YearMismatch' ? judged : !(REFERENCE_FLAGS as readonly string[]).includes(f))
}

/**
 * The server's "Judged against Bender (2021) from your reference list, because the year in your text (2019) does not match it" line. It is
 * what makes a year-linked verdict honest, so it is always shown for such a card, in addition to any abstract-only caveat it carries.
 */
export function linkNote(card: Pick<CitationCard, 'flags' | 'verdict'>): string | null {
  return isJudgedYearLink(card) ? card.verdict?.note?.trim() || null : null
}

// ── Adding a reference ─────────────────────────────────────────────────────────────────────────

const TITLE_PLACEHOLDER = '[Title of the work]'
const SOURCE_PLACEHOLDER = '[Journal or publisher]'

/**
 * A reference line to fill in: "Venter and Dlamini. (2024). [Title of the work]. [Journal or publisher]."
 * The shape is deliberate. It begins "names. (year)." so the server's reference parser recognises it as a NEW entry on its own line and matches
 * it to the citation by surname and year, even before the writer has replaced the bracketed parts. (A "Venter, [initials]" form would not be
 * recognised as an entry start, and would be swallowed into the entry above it.) Null when the card has no author and year to build from.
 */
export function referenceStub(card: Pick<CitationCard, 'citedAuthors' | 'citedYear'>): string | null {
  const authors = card.citedAuthors?.trim()
  const year = card.citedYear?.trim()
  if (!authors || !year) return null
  return `${authors}. (${year}). ${TITLE_PLACEHOLDER}. ${SOURCE_PLACEHOLDER}.`
}

const REFERENCE_HEADING = /^[ \t]*(?:#{1,6}[ \t]*)?(?:\d+[.)]?[ \t]+)?(?:\*\*|__)?(?:reference list|references?|bibliography|works cited|literature cited)(?:\*\*|__)?[ \t]*:?[ \t]*$/gim

/**
 * Adds the stub as the last entry of the draft's reference list, creating a "References" heading when there is none. It copies the list's own
 * layout: entries separated by blank lines get a blank line, entries on consecutive lines get a single line break. Mixing the two would change
 * how the server splits the list (a blank line turns the whole list above into one entry). Adding the same line twice does nothing.
 */
export function insertReference(draft: string, stub: string): string {
  if (draft.includes(stub)) return draft

  const eol = draft.includes('\r\n') ? '\r\n' : '\n'
  const trimmed = draft.replace(/\s+$/, '')

  let headingEnd = -1
  for (const m of trimmed.matchAll(REFERENCE_HEADING)) headingEnd = (m.index ?? 0) + m[0].length   // the LAST heading, like the server
  if (headingEnd < 0) return `${trimmed}${eol}${eol}References${eol}${eol}${stub}${eol}`

  // Copy the list's own layout. With nothing or ONE entry there is no layout to copy: use a blank line, the usual way to set an entry apart.
  const list = trimmed.slice(headingEnd).trim()
  const entryLines = list === '' ? 0 : list.split(/\r?\n/).filter(l => l.trim() !== '').length
  const separator = entryLines <= 1 || /\r?\n[ \t]*\r?\n/.test(list) ? eol + eol : eol
  return `${trimmed}${separator}${stub}${eol}`
}
