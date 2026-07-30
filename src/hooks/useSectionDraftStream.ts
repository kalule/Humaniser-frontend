import { useCallback, useRef, useState } from 'react'
import { tokenRef } from '../lib/tokenRef'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/**
 * Pulls complete `data: {...}\n\n` SSE frames out of whatever text has arrived so far and returns
 * the deltas they carry, plus whatever trailing partial frame should be carried into the next
 * chunk (a frame can straddle two separate stream reads — e.g. the blank-line separator lands in
 * the next network chunk). Pure and DOM-free so it's unit-testable on its own: this is the part
 * responsible for surfacing text incrementally as chunks arrive rather than only once the whole
 * response is buffered, which is the actual behavior worth protecting against regressing.
 */
export function parseSseFrames(buffer: string, incoming: string): { deltas: string[]; remainder: string } {
  const combined = buffer + incoming
  const frames = combined.split('\n\n')
  const remainder = frames.pop() ?? ''

  const deltas: string[] = []
  for (const frame of frames) {
    const dataLine = frame.split('\n').find(line => line.startsWith('data: '))
    if (!dataLine) continue
    try {
      const parsed = JSON.parse(dataLine.slice('data: '.length)) as { delta?: string }
      if (parsed.delta) deltas.push(parsed.delta)
    } catch {
      // Malformed frame — skip it; the caller's poll fallback is the safety net for the section.
    }
  }
  return { deltas, remainder }
}

interface UseSectionDraftStreamResult {
  streamingContent: string
  isStreaming: boolean
  startStream: (projectId: string, sectionCode: string) => void
  stopStream: () => void
}

/**
 * Consumes ResearchController's section-draft SSE endpoint via fetch + ReadableStream rather than
 * EventSource — EventSource can't attach the Authorization header this API requires (Bearer token
 * from an in-memory ref, not a cookie; see client.ts's request interceptor).
 *
 * Purely additive to the existing 3s status poll in ResearchAgentPage: this only makes the
 * paragraph visibly form in real time while the section is Generating. If the stream never
 * connects, the server has nothing to stream (204 — not started, or already finished by the time
 * this connects), or the connection drops, streamingContent just stays wherever it was and the
 * poll's own Generating -> Draft/NotStarted transition is what the UI ultimately relies on to
 * know generation is done — this hook never needs to itself detect or report failure.
 */
export function useSectionDraftStream(): UseSectionDraftStreamResult {
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const stopStream = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const startStream = useCallback((projectId: string, sectionCode: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStreamingContent('')

    void (async () => {
      try {
        const token = tokenRef.current
        const url = `${API_BASE}/api/v1/research/projects/${projectId}/sections/stream?code=${encodeURIComponent(sectionCode)}`
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          signal: controller.signal,
        })

        // 204 (nothing to stream) or any non-2xx — fall back silently to the poll.
        if (!res.ok || !res.body) return

        setIsStreaming(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const { deltas, remainder } = parseSseFrames(buffer, decoder.decode(value, { stream: true }))
          buffer = remainder
          for (const delta of deltas) setStreamingContent(prev => prev + delta)
        }
      } catch {
        // Network error or intentional abort (stopStream/section switch) — nothing else to do.
      } finally {
        setIsStreaming(false)
      }
    })()
  }, [])

  return { streamingContent, isStreaming, startStream, stopStream }
}
