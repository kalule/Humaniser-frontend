import { fetchWithAuth } from './fetchWithAuth'
import { useAuthStore } from '../store/authStore'
import type { EssayCitationStyle, WriteWithAiRequest, WriteWithAiResponse, ResearchPaperPlanSection } from '../types/workbench'

const base = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api/v1/workbench/research-paper`
export interface PaperRun { runId: string; status: 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Interrupted' | 'Cancelled'; stage?: string; error?: string; completedSections: number; result?: WriteWithAiResponse }
interface PendingPaper { runId: string; signature: string; citationStyle: EssayCitationStyle; startedAt: number }
class PaperApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
const key = (documentId: string) => `researchPaper.pending.${useAuthStore.getState().user?.id ?? 'signed-out'}.${documentId}`
export function pendingPaper(documentId: string): PendingPaper | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(documentId)) ?? 'null') as PendingPaper | null
    if (!value || typeof value.runId !== 'string' || typeof value.signature !== 'string' || !Number.isFinite(value.startedAt)) return null
    if (Date.now() - value.startedAt > 7 * 86400000) { clearPaper(documentId); return null }
    return value
  } catch { return null }
}
export function clearPaper(documentId: string) { localStorage.removeItem(key(documentId)) }
async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithAuth(base + path, { method, signal, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) })
  if (!res.ok) {
    const data = await res.json().catch(() => null) as { detail?: string; title?: string } | null
    throw new PaperApiError(data?.detail ?? data?.title ?? `Could not check research paper (${res.status}).`, res.status)
  }
  return res.status === 204 ? undefined as T : res.json() as Promise<T>
}
export const getPaperRun = (id: string, signal?: AbortSignal) => api<PaperRun>(`/runs/${id}`, 'GET', undefined, signal)
export const retryPaperRun = (id: string) => api(`/runs/${id}/retry`, 'POST')
export const cancelPaperRun = (id: string) => api(`/runs/${id}`, 'DELETE')
export const planResearchPaper = (request: WriteWithAiRequest) => api<ResearchPaperPlanSection[]>('/plan', 'POST', request)

export function paperRunOutcome(run: PaperRun): WriteWithAiResponse | null {
  if (run.status === 'Completed') {
    if (!run.result) throw new Error('The completed paper could not be retrieved.')
    return run.result
  }
  if (['Failed', 'Interrupted', 'Cancelled'].includes(run.status)) throw new Error(run.error || 'Generation stopped. Retry to continue from saved sections.')
  return null
}

export async function generateResearchPaper(request: WriteWithAiRequest, documentId: string, onStage: (stage: string) => void, signal?: AbortSignal): Promise<WriteWithAiResponse> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(request)))
  const signature = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  let pending = pendingPaper(documentId)
  if (pending?.signature !== signature) {
    const previous = pending
    pending = { runId: crypto.randomUUID(), signature, citationStyle: request.citationStyle ?? 'Harvard', startedAt: Date.now() }
    localStorage.setItem(key(documentId), JSON.stringify(pending))
    try { await api('/runs', 'POST', { runId: pending.runId, documentId, request }, signal) }
    catch (error) {
      // Preserve the idempotency key on transport errors: the server may have accepted the job.
      if (error instanceof PaperApiError && error.status >= 400 && error.status < 500) {
        if (previous) localStorage.setItem(key(documentId), JSON.stringify(previous))
        else clearPaper(documentId)
      }
      throw error
    }
  } else {
    // Re-submit idempotently if the browser lost the initial acknowledgement.
    await api('/runs', 'POST', { runId: pending.runId, documentId, request }, signal)
    const prior = await getPaperRun(pending.runId, signal)
    if (['Failed', 'Interrupted', 'Cancelled'].includes(prior.status) || prior.result?.completionStatus === 'Incomplete' || prior.result?.researchPaperFlags?.some(flag => flag.code === 'ModeMismatch')) await retryPaperRun(pending.runId)
  }
  for (;;) {
    signal?.throwIfAborted()
    const run = await getPaperRun(pending.runId, signal)
    const result = paperRunOutcome(run)
    if (result) return result
    onStage(run.stage ?? 'queued')
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 1500)
      signal?.addEventListener('abort', abort, { once: true })
    })
  }
}
