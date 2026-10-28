import {
  essayAuthorSurnames,
  formatEssayInTextCitation,
  type EssayCitationStyleName,
  type EssayReferenceMeta,
} from './citationFormat'

const NUMBERED_STYLES: EssayCitationStyleName[] = ['Ieee', 'Vancouver']

type OrderableReference = EssayReferenceMeta & { sourceId: string }

/**
 * Reference-list order for a generated document. The backend returns references in retrieval
 * order (S1..Sn), which is neither alphabetical nor first-cited — the Harvard list in the
 * 2026-09-28 essay audit was unsorted for exactly this reason.
 *
 * - Author-date styles (Harvard, APA 7, Chicago): alphabetical by first author's surname, with
 *   author-less works filed under their title, then by year and title. Two works by the same
 *   author(s) in the same year get "2020a"/"2020b" labels so their in-text citations stay distinct.
 * - Numbered styles (IEEE, Vancouver): order of first citation in `text`, since the number IS the
 *   list position.
 *
 * The in-text formatter indexes into this same array, so numbering and the list cannot disagree.
 */
export function orderEssayReferences<T extends OrderableReference>(
  references: T[],
  style: EssayCitationStyleName,
  text: string,
): (T & { yearLabel?: string | null })[] {
  if (NUMBERED_STYLES.includes(style)) {
    const firstUse = new Map<string, number>()
    for (const m of text.matchAll(/\[(?:N:)?(S\d+)/g)) {
      if (!firstUse.has(m[1])) firstUse.set(m[1], m.index ?? 0)
    }
    return references
      .map((r, i) => ({ r, i, at: firstUse.get(r.sourceId) ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => a.at - b.at || a.i - b.i)
      .map(x => ({ ...x.r }))
  }

  const sortKey = (r: T) => {
    const surname = essayAuthorSurnames(r)[0]
    return (surname ?? r.title).toLocaleLowerCase()
  }
  const ordered = [...references].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b))
    || (a.year ?? 0) - (b.year ?? 0)
    || a.title.localeCompare(b.title),
  ).map(r => ({ ...r, yearLabel: null as string | null }))

  // Collisions are judged on the rendered in-text citation, which is what a reader has to tell apart.
  const byCitation = new Map<string, typeof ordered>()
  for (const r of ordered) {
    if (r.year == null) continue
    const key = formatEssayInTextCitation(r, style, 0)
    byCitation.set(key, [...(byCitation.get(key) ?? []), r])
  }
  for (const group of byCitation.values()) {
    if (group.length < 2) continue
    group.sort((a, b) => a.title.localeCompare(b.title))
    group.forEach((r, i) => { r.yearLabel = `${r.year}${String.fromCharCode(97 + i)}` })
  }
  // Re-sort so suffixed works sit in suffix order within their author/year slot.
  return ordered.sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b))
    || (a.year ?? 0) - (b.year ?? 0)
    || (a.yearLabel ?? '').localeCompare(b.yearLabel ?? '')
    || a.title.localeCompare(b.title))
}
