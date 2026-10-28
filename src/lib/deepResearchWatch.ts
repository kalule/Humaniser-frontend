import type { DeepResearchSession } from '../api/deepResearch'

// Which Deep Research sessions the student is waiting on, so they can be told when one finishes even if they
// have moved to another page or tab. Kept in localStorage (per browser) because it is only a convenience: if it
// is unavailable nothing breaks, the student just isn't notified and can still find the session in "Your research".

const KEY = 'deepResearch.watching'
export const WATCH_EVENT = 'deepresearch:watch'
const MAX_WATCHED = 10

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids.slice(-MAX_WATCHED))) } catch { /* storage unavailable */ }
  try { window.dispatchEvent(new Event(WATCH_EVENT)) } catch { /* no window (tests) */ }
}

export const watchedSessionIds = (): string[] => read()
export const watchSession = (id: string): void => { if (!read().includes(id)) write([...read(), id]) }
export const unwatchSession = (id: string): void => { if (read().includes(id)) write(read().filter(x => x !== id)) }

export interface FinishedNotice { title: string; body: string; tone: 'success' | 'warning' | 'error' }

/** What to tell the student when a session ends. Plain words; never "agent", "iteration" or "budget". */
export function finishedNotice(s: Pick<DeepResearchSession, 'status' | 'researchQuestion' | 'result'>): FinishedNotice {
  const sources = s.result?.acceptedSources ?? 0
  const question = s.researchQuestion.length > 90 ? `${s.researchQuestion.slice(0, 90).trimEnd()}…` : s.researchQuestion
  switch (s.status) {
    case 'Completed':
      return { title: 'Your research is ready', body: `${sources} source${sources === 1 ? '' : 's'} found for: ${question}`, tone: 'success' }
    case 'Stopped':
      return { title: 'Your research reached its limit', body: `${sources} source${sources === 1 ? '' : 's'} kept for: ${question}`, tone: 'warning' }
    case 'Cancelled':
      return { title: 'Your research was stopped', body: question, tone: 'warning' }
    default:
      return { title: 'Your research could not finish', body: question, tone: 'error' }
  }
}
