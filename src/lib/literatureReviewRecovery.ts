import { tokenRef } from './tokenRef'
import { parseWriteWithAiSseFrames } from '../hooks/useWriteWithAiStream'
import type { WriteWithAiResponse } from '../types/workbench'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const STORAGE_PREFIX = 'literatureReview.pending.'

/** A literature review generation this browser started for a document and has not yet received. */
export interface PendingGeneration {
  projectId: string
  startedAt: number
  citationStyle: string
}

/** The server keeps a finished review for 24h; a pending marker older than this can never be collected. */
export const PENDING_MAX_AGE_MS = 60 * 60 * 1000

const read = (key: string): string | null => { try { return localStorage.getItem(key) } catch { return null } }

export function savePendingGeneration(documentId: string, pending: PendingGeneration): void {
  try { localStorage.setItem(STORAGE_PREFIX + documentId, JSON.stringify(pending)) } catch { /* private mode: recovery is best effort */ }
}

export function clearPendingGeneration(documentId: string): void {
  try { localStorage.removeItem(STORAGE_PREFIX + documentId) } catch { /* ignore */ }
}

export function loadPendingGeneration(documentId: string, now = Date.now()): PendingGeneration | null {
  const raw = read(STORAGE_PREFIX + documentId)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<PendingGeneration>
    if (typeof p.projectId !== 'string' || typeof p.startedAt !== 'number') return null
    if (now - p.startedAt > PENDING_MAX_AGE_MS) { clearPendingGeneration(documentId); return null }
    return { projectId: p.projectId, startedAt: p.startedAt, citationStyle: p.citationStyle ?? 'Harvard' }
  } catch { return null }
}

/** The document a still-running generation was started from, if this browser remembers one (any document). */
export function findAnyPendingGeneration(now = Date.now()): ({ documentId: string } & PendingGeneration) | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(STORAGE_PREFIX)) continue
      const documentId = key.slice(STORAGE_PREFIX.length)
      const pending = loadPendingGeneration(documentId, now)
      if (pending) return { documentId, ...pending }
    }
  } catch { /* storage unavailable */ }
  return null
}

export type LiteratureReviewOutcome =
  | { status: 'pending'; stage?: string }
  | { status: 'complete'; result: WriteWithAiResponse }
  | { status: 'failed'; message: string }
  | { status: 'unavailable' }

/** Turns the server's outcome payload into a result the editor can use. Pure so it is testable without a network. */
export function interpretOutcome(body: { status?: string; stage?: string | null; frame?: string } | null): LiteratureReviewOutcome {
  if (!body) return { status: 'unavailable' }
  if (body.status === 'pending') return { status: 'pending', stage: body.stage ?? undefined }
  if (body.status !== 'complete' || !body.frame) return { status: 'unavailable' }
  const { events } = parseWriteWithAiSseFrames('', 'data: ' + body.frame + '\n\n')
  for (const event of events) {
    if ('result' in event) return { status: 'complete', result: event.result }
    if ('error' in event) return { status: 'failed', message: event.error }
  }
  return { status: 'unavailable' }
}

export async function fetchLiteratureReviewOutcome(projectId: string, signal?: AbortSignal): Promise<LiteratureReviewOutcome> {
  const token = tokenRef.current
  const res = await fetch(`${API_BASE}/api/v1/workbench/write-with-ai/literature-review/${encodeURIComponent(projectId)}/outcome`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    signal,
  })
  if (res.status === 404) return { status: 'unavailable' }
  if (!res.ok) throw new Error(`Could not check the literature review (${res.status})`)
  return interpretOutcome(await res.json())
}
