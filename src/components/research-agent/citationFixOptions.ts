import type { CitationFixAction, CitationFlag } from '../../types/research'

/**
 * Why a repair action cannot resolve this flag, or `undefined` when it can.
 *
 * The backend computes this per flag (Domain `CitationFixOptions`) and only ever marks an action
 * unavailable when it is STRUCTURALLY impossible — no citation marker to keep, no source to
 * re-verify against, no claim sentence to reframe. It deliberately does not guess at which repair
 * will read better, so an action staying enabled is not a promise that it will succeed.
 *
 * A flag with no `fixActions` (an older or cached response) keeps every action enabled — the
 * behaviour before this existed. This is an affordance, not a guard: the backend rejects every
 * unavailable combination independently, exactly like the `coverage` gate on Dismiss.
 */
export function citationFixBlockedReason(
  flag: CitationFlag,
  action: CitationFixAction,
): string | undefined {
  const option = flag.fixActions?.find(o => o.action === action)
  if (!option || option.available) return undefined
  return option.reason ?? 'Not available for this issue.'
}
