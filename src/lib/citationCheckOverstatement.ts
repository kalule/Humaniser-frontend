import type { CitationCard, Overstatement } from '../types/citationCheck'

// The "strongly worded" warning is advisory. The writer can dismiss it per card; the choice is remembered in this browser only,
// keyed by run and card, and tied to the rules version so an updated rule set can speak again.

type Store = Pick<Storage, 'getItem' | 'setItem'>

const keyFor = (runId: string) => `cc-overstatement-dismissed:${runId}`

const defaultStore = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function loadDismissed(runId: string, store: Store | null = defaultStore()): Set<string> {
  if (!store) return new Set()
  try {
    const parsed: unknown = JSON.parse(store.getItem(keyFor(runId)) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** The entry for one card: its id plus the rules version, so a new rules version is not silenced by an old dismissal. */
export const dismissalKey = (card: Pick<CitationCard, 'id'>, o: Pick<Overstatement, 'rulesVersion'>): string => `${card.id}@${o.rulesVersion}`

export function saveDismissed(runId: string, dismissed: ReadonlySet<string>, store: Store | null = defaultStore()): void {
  if (!store) return
  try { store.setItem(keyFor(runId), JSON.stringify([...dismissed])) } catch { /* private mode or full storage: the dismissal lasts this visit only */ }
}

/** The warning to show for a card, or null when there is none or the writer dismissed it. Locked cards never show one. */
export function visibleOverstatement(card: CitationCard, dismissed: ReadonlySet<string>): Overstatement | null {
  const o = card.overstatement
  if (!o || card.locked) return null
  return dismissed.has(dismissalKey(card, o)) ? null : o
}

/** What to tell the writer: the matched phrase is quoted, and a stronger message is used when nothing stands behind the claim. */
export function overstatementMessage(o: Overstatement): string {
  return o.severity === 'Elevated'
    ? `“${o.phrase}” is a very strong claim, and its source could not be found or checked, so nothing here backs it up.`
    : `“${o.phrase}” is stronger than most single sources can support.`
}
