/**
 * Guided | Document choice for the Research Agent, remembered per signed-in user on this browser.
 * A ?view= query parameter wins over the stored choice so a link can open a specific view.
 * Storage can be unavailable (private window, blocked site data); both views work without it.
 */
export type ResearchAgentView = 'guided' | 'document'

const KEY_PREFIX = 'research_agent_view:'

export function parseView(value: string | null | undefined): ResearchAgentView | null {
  return value === 'guided' || value === 'document' ? value : null
}

export function readStoredView(userId: string | null | undefined): ResearchAgentView {
  try {
    return parseView(localStorage.getItem(KEY_PREFIX + (userId ?? 'anonymous'))) ?? 'guided'
  } catch {
    return 'guided'
  }
}

export function storeView(userId: string | null | undefined, view: ResearchAgentView): void {
  try {
    localStorage.setItem(KEY_PREFIX + (userId ?? 'anonymous'), view)
  } catch {
    // Not persisted this time; the current view still applies.
  }
}

export function resolveView(queryValue: string | null, userId: string | null | undefined): ResearchAgentView {
  return parseView(queryValue) ?? readStoredView(userId)
}
