import type { CitationFlag, FetchedLiterature } from '../../types/research'

/** Below this, the picker shows a hint instead of a list — a one-character query matches almost everything. */
export const MIN_REPLACEMENT_QUERY_LENGTH = 2

/** Keeps the rendered <option> list bounded on projects holding thousands of candidate sources. */
export const MAX_REPLACEMENT_OPTIONS = 50

export interface ReplacementCandidates {
  /** Sources this project could legally swap in — approved, and not the one already flagged. */
  eligible: FetchedLiterature[]
  /** The subset matching the current query; empty until the query is long enough to be meaningful. */
  matches:  FetchedLiterature[]
  /** True when the query is too short to search on, but there ARE sources it could match. */
  queryTooShort: boolean
}

/**
 * Splits a project's literature into what the "Replace citation" picker can offer.
 *
 * `includedByStudent` is not a display preference — PreviewCitationFixAsync rejects a manually
 * chosen replacement that isn't in the approved corpus ("a student-chosen source needs no
 * re-verification"), so an unapproved source would fail server-side even if it were listed. The
 * important consequence is that `eligible` is routinely EMPTY: a live project carried 1,831
 * candidate sources with zero approved, and every project sampled alongside it had between 0 and 10
 * approved out of thousands. The caller must handle that case with something other than an empty
 * dropdown — the backend's own no-source-supplied path (one verified retrieval keyed on the claim)
 * exists precisely for it.
 */
export function getReplacementCandidates(
  literature: FetchedLiterature[], flag: CitationFlag, query: string,
): ReplacementCandidates {
  const eligible = literature.filter(
    source => source.includedByStudent && source.id !== flag.literatureId)

  const normalised = query.trim().toLocaleLowerCase()
  if (normalised.length < MIN_REPLACEMENT_QUERY_LENGTH)
    return { eligible, matches: [], queryTooShort: eligible.length > 0 }

  const matches = eligible
    .filter(source => `${source.title} ${source.authors}`.toLocaleLowerCase().includes(normalised))
    .slice(0, MAX_REPLACEMENT_OPTIONS)

  return { eligible, matches, queryTooShort: false }
}
