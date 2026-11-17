import type { CitationCheckReport } from '../types/citationCheck'
import { isTerminal } from './citationCheckView'

// Follows one check until it finishes. The backend has no push channel (a deliberate v1 choice), so the page polls; this is the
// loop, with its fetch and its clock injected so every branch can be tested without timers or a server.

export type PollOutcome =
  | { kind: 'done'; report: CitationCheckReport }   // Completed or Failed: either way, the run has stopped
  | { kind: 'gone' }                                // the server no longer has it: deleted, expired, or not this user's
  | { kind: 'aborted' }                             // the caller stopped polling (navigated away, started over)
  | { kind: 'error'; message: string }              // repeated failures to reach the server

export interface PollDeps {
  /** Null means "no such run" (the API turns a 404 into null); a thrown error means "could not ask". */
  fetchReport: () => Promise<CitationCheckReport | null>
  /** Must resolve early, not reject, when the signal aborts. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
  onUpdate: (report: CitationCheckReport) => void
}

/** Consecutive failed requests tolerated before giving up. One dropped request on a mobile connection must not end the watch. */
export const MAX_TRANSIENT_FAILURES = 5

/** Quick at first so results feel live, slower as a long run drags on; a run still waiting to start does not need fast checks. */
export function pollDelayMs(attempt: number, status?: string): number {
  if (attempt >= 40) return 5000
  if (attempt >= 10) return 3000
  return status === 'Queued' ? 2500 : 1500
}

const retryDelayMs = (failures: number): number => Math.min(2000 * 2 ** (failures - 1), 15_000)

export const LOST_TOUCH_MESSAGE = 'We lost touch with your check. It may still be running: reload this page to see where it got to.'

export async function pollUntilDone(deps: PollDeps, signal: AbortSignal): Promise<PollOutcome> {
  let attempt = 0
  let failures = 0

  while (!signal.aborted) {
    let report: CitationCheckReport | null
    try {
      report = await deps.fetchReport()
    } catch {
      if (signal.aborted) break
      failures += 1
      if (failures > MAX_TRANSIENT_FAILURES) return { kind: 'error', message: LOST_TOUCH_MESSAGE }
      await deps.sleep(retryDelayMs(failures), signal)
      continue
    }
    if (signal.aborted) break
    failures = 0

    if (report === null) return { kind: 'gone' }
    deps.onUpdate(report)
    if (isTerminal(report.status)) return { kind: 'done', report }

    await deps.sleep(pollDelayMs(attempt++, report.status), signal)
  }
  return { kind: 'aborted' }
}

/** A sleep that ends the moment the signal aborts, so leaving the page never leaves a timer holding the loop open. */
export const abortableSleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
