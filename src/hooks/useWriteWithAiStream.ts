import { useCallback, useState } from 'react'
import { tokenRef } from '../lib/tokenRef'
import type { WriteWithAiRequest, WriteWithAiResponse } from '../types/workbench'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type WriteWithAiStage = 'drafting' | 'verifying' | 'revising' | 'auditing-claims' | 'planning-evidence' | 'repairing-claims' | string | null

export type WriteWithAiSseEvent =
  | { stage: string }
  | { projectId: string }
  | { result: WriteWithAiResponse }
  | { error: string; recoverable?: boolean }

/** The server refused a new generation because one is already running for this account (HTTP 409). */
export class GenerationAlreadyRunningError extends Error {
  readonly documentId: string | null
  constructor(message: string, documentId: string | null = null) { super(message); this.name = 'GenerationAlreadyRunningError'; this.documentId = documentId }
}

/**
 * The stream ended before a result arrived, but the server may still finish the job (the literature-review job is durable).
 * Callers keep the pending marker and recover the finished review later instead of treating it as a failure.
 */
export class GenerationInterruptedError extends Error {
  constructor(message: string) { super(message); this.name = 'GenerationInterruptedError' }
}

/**
 * Pulls complete `data: {...}\n\n` SSE frames out of whatever text has arrived so far, same
 * straddling-chunk handling as useSectionDraftStream's parseSseFrames, but generalised to the
 * three payload shapes WorkbenchController.WriteWithAiStream emits (stage / result / error)
 * instead of a single `delta` field. Pure and DOM-free so it's unit-testable on its own.
 */
export function parseWriteWithAiSseFrames(
  buffer: string,
  incoming: string,
): { events: WriteWithAiSseEvent[]; remainder: string } {
  const combined = buffer + incoming
  const frames = combined.split('\n\n')
  const remainder = frames.pop() ?? ''

  const events: WriteWithAiSseEvent[] = []
  for (const frame of frames) {
    const dataLine = frame.split('\n').find(line => line.startsWith('data: '))
    if (!dataLine) continue
    try {
      const parsed = JSON.parse(dataLine.slice('data: '.length)) as
        Partial<{ stage: string; projectId: string; result: WriteWithAiResponse; error: string; recoverable: boolean }>
      if (typeof parsed.projectId === 'string') events.push({ projectId: parsed.projectId })
      else if (typeof parsed.stage === 'string') events.push({ stage: parsed.stage })
      else if (parsed.result) events.push({ result: parsed.result })
      else if (typeof parsed.error === 'string') events.push(parsed.recoverable === true ? { error: parsed.error, recoverable: true } : { error: parsed.error })
    } catch {
      // Malformed frame — skip it; the caller surfaces failure via the connection ending
      // without a result/error event.
    }
  }
  return { events, remainder }
}

interface UseWriteWithAiStreamResult {
  stage: WriteWithAiStage
  /** `onStarted` receives the project id of a literature-review generation as soon as the server has created it. */
  generate: (request: WriteWithAiRequest, signal?: AbortSignal, onStarted?: (projectId: string) => void, documentId?: string) => Promise<WriteWithAiResponse>
}

/**
 * Consumes WorkbenchController's write-with-ai/stream SSE endpoint via fetch + ReadableStream
 * rather than EventSource — same reason as useSectionDraftStream (EventSource is GET-only and
 * can't carry the Authorization header or, here, the request body). Essay generation can chain
 * several sequential Claude calls (draft, structural retry, citation verification, citation
 * retry, re-verification) and take well over a minute on a thin source pool; this surfaces
 * `stage` transitions as they happen instead of leaving the caller with nothing until the whole
 * pipeline finishes, and resolves with the same WriteWithAiResponse the non-streaming endpoint
 * returns once a `result` frame arrives.
 */
export function useWriteWithAiStream(): UseWriteWithAiStreamResult {
  const [stage, setStage] = useState<WriteWithAiStage>(null)

  const generate = useCallback(async (request: WriteWithAiRequest, signal?: AbortSignal, onStarted?: (projectId: string) => void, documentId?: string): Promise<WriteWithAiResponse> => {
    setStage(null)
    try {
      const token = tokenRef.current
      // Literature Review runs as a durable Hangfire job relayed through a broker (see the
      // backend's WriteWithAiLiteratureReviewStream doc comment) rather than synchronously in
      // this request like every other document type — a separate route, same SSE frame shapes
      // (stage/result/error), so the parsing below needs no branching.
      const endpoint = request.documentType === 'LiteratureReview'
        ? 'write-with-ai/literature-review/stream'
        : 'write-with-ai/stream'
      // The server remembers which document a literature review was started from, so a refused second start can say where the first will appear.
      const query = request.documentType === 'LiteratureReview' && documentId ? `?documentId=${encodeURIComponent(documentId)}` : ''
      const res = await fetch(`${API_BASE}/api/v1/workbench/${endpoint}${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(request),
        // Defect group H (essay audit 2026-09-28): Cancel in WriteWithAiModal was disabled for the
        // entire duration of a generation, so a student who opened the dialog by mistake — or
        // whose request was clearly going wrong — had no way to stop it short of closing the tab.
        // Aborting the fetch closes the connection; WorkbenchController's SSE action observes the
        // client disconnect via its own CancellationToken and stops the in-flight Claude/Hangfire
        // work rather than continuing to spend credits on a response nothing will read.
        signal,
      })
      if (!res.ok) {
        const body = await res.text()
        let detail = body
        let runningDocumentId: string | null = null
        try {
          const problem = JSON.parse(body) as { title?: string; detail?: string; documentId?: string; errors?: Record<string, string[]> }
          runningDocumentId = problem.documentId ?? null
          detail = problem.detail ?? (Object.values(problem.errors ?? {}).flat().join(' ') || problem.title || body)
        } catch { /* keep the plain response body */ }
        // 409: the same generation is already running on the server. Keep the pending marker so the editor collects it.
        if (res.status === 409) throw new GenerationAlreadyRunningError(detail.trim() || 'A generation is already running.', runningDocumentId)
        throw new Error(detail.trim() || `AI writing request failed (${res.status})`)
      }
      if (!res.body) throw new Error('AI writing response did not include a stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const consumeEvents = (events: WriteWithAiSseEvent[]): WriteWithAiResponse | undefined => {
        for (const event of events) {
          if ('projectId' in event) onStarted?.(event.projectId)
          else if ('stage' in event) setStage(event.stage as WriteWithAiStage)
          else if ('result' in event) return event.result
          else if ('error' in event) throw event.recoverable ? new GenerationInterruptedError(event.error) : new Error(event.error)
        }
        return undefined
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          // Flush TextDecoder state and parse a final frame even if a proxy/browser delivered EOF
          // without exposing the trailing blank-line delimiter as a separate readable chunk.
          const tail = buffer + decoder.decode()
          if (tail.trim()) {
            const { events } = parseWriteWithAiSseFrames('', `${tail}\n\n`)
            const result = consumeEvents(events)
            if (result) return result
          }
          break
        }
        const { events, remainder } = parseWriteWithAiSseFrames(buffer, decoder.decode(value, { stream: true }))
        buffer = remainder
        const result = consumeEvents(events)
        if (result) return result
      }
      throw new GenerationInterruptedError('Connection closed before generation finished')
    } finally {
      setStage(null)
    }
  }, [])

  return { stage, generate }
}
