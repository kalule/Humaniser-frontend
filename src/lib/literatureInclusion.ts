import type { DashboardLiteratureFilter, DashboardLiteraturePage } from '../types/research'

/**
 * Applies a Prioritised/Available toggle to an already-loaded dashboard page, without refetching.
 *
 * Three things have to move together or the page contradicts itself: the row's own badge, the
 * prioritised/available counts in the filter chips, and — when the active filter is one of those two
 * — whether the row still belongs in the list at all. Demoting a row while viewing "Prioritised"
 * must remove it, or the list shows a source under a filter it no longer satisfies.
 *
 * Pure so it can be tested directly; the caller owns the request and the rollback on failure.
 */
export function applyInclusionChange(
  page: DashboardLiteraturePage, literatureId: string, included: boolean,
  filter: DashboardLiteratureFilter,
): DashboardLiteraturePage {
  const target = page.items.find(item => item.id === literatureId)
  if (!target || target.includedByStudent === included) return page

  const items = page.items
    .map(item => item.id === literatureId ? { ...item, includedByStudent: included } : item)
    // A row only leaves the list under the two filters this flag actually defines. Under "all",
    // "cited", "unresolved" or "excluded" it stays put — the toggle does not change whether it
    // matches those.
    .filter(item => {
      if (item.id !== literatureId) return true
      if (filter === 'prioritised') return included
      if (filter === 'available') return !included
      return true
    })

  const removed = items.length !== page.items.length
  const delta = included ? 1 : -1

  return {
    ...page,
    items,
    matchingCount: Math.max(0, page.matchingCount - (removed ? 1 : 0)),
    counts: {
      ...page.counts,
      prioritised: Math.max(0, page.counts.prioritised + delta),
      available:   Math.max(0, page.counts.available - delta),
    },
  }
}
