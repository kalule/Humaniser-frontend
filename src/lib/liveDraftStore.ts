import { useCallback, useSyncExternalStore } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * Live drafts streamed from ResearchController's section stream (SSE), one per section being
 * written. Text is buffered and published to React in batches (FLUSH_MS), and each section has
 * its own listeners, so streaming one section re-renders only that section's component (and the
 * agent panel, if it watches it) — never the whole thesis.
 *
 * The server sends the whole draft so far on connect, so a dropped connection simply reconnects
 * and replaces the text; nothing is appended twice.
 */
export const FLUSH_MS = 100
const RECONNECT_MS = 2000
/** Ask again this often while the server says nothing is streaming yet (204). */
const NOT_YET_MS = 1500

export interface LiveDraft {
  text:        string
  words:       number
  sourcesRead: number | null
  activities:  string[]
  /** The server finished streaming text; the run may still be checking citations. */
  streamEnded: boolean
}

const EMPTY: LiveDraft = { text: '', words: 0, sourcesRead: null, activities: [], streamEnded: false }

export interface DraftFrame { delta?: string; activity?: string; sourcesRead?: number | null }

/** Splits complete `data: {...}\n\n` frames out of the buffer; the trailing partial frame is returned to carry over. */
export function parseDraftFrames(buffer: string, incoming: string): { frames: DraftFrame[]; remainder: string } {
  const parts = (buffer + incoming).split('\n\n')
  const remainder = parts.pop() ?? ''
  const frames: DraftFrame[] = []
  for (const part of parts) {
    const line = part.split('\n').find(l => l.startsWith('data: '))
    if (!line) continue
    try { frames.push(JSON.parse(line.slice(6)) as DraftFrame) } catch { /* skip a malformed frame */ }
  }
  return { frames, remainder }
}

const countWords = (text: string) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length

interface Live {
  draft:     LiveDraft
  pending:   string
  timer:     ReturnType<typeof setTimeout> | null
  abort:     AbortController | null
  listeners: Set<() => void>
  wanted:    boolean
}

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const lives = new Map<string, Live>()
const keyOf = (projectId: string, code: string) => `${projectId}:${code}`

function entry(key: string): Live {
  let live = lives.get(key)
  if (!live) {
    live = { draft: EMPTY, pending: '', timer: null, abort: null, listeners: new Set(), wanted: false }
    lives.set(key, live)
  }
  return live
}

function publish(live: Live, patch: Partial<LiveDraft>) {
  live.draft = { ...live.draft, ...patch }
  live.listeners.forEach(l => l())
}

function flush(live: Live) {
  live.timer = null
  if (!live.pending) return
  const text = live.draft.text + live.pending
  live.pending = ''
  publish(live, { text, words: countWords(text) })
}

function connect(projectId: string, code: string, live: Live) {
  const controller = new AbortController()
  live.abort = controller
  let first = true
  let notYet = false
  void (async () => {
    let clean = false
    try {
      const url = `${API_BASE}/api/v1/research/projects/${projectId}/sections/stream?code=${encodeURIComponent(code)}`
      const res = await fetchWithAuth(url, { signal: controller.signal })
      // 204: nothing streaming at this moment. The section is marked Generating before the request
      // that starts the run reaches the server, so this is usually "not yet": ask again while the
      // section is still being written. When it finishes, the sections poll ends the follow.
      if (res.status === 204) { notYet = true; return }
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const { frames, remainder } = parseDraftFrames(buffer, decoder.decode(value, { stream: true }))
        buffer = remainder
        for (const frame of frames) {
          if (frame.delta) {
            // The first text after (re)connecting is the full draft so far: replace, don't append.
            if (first) { live.pending = ''; live.draft = { ...live.draft, text: '' }; first = false }
            live.pending += frame.delta
            if (!live.timer) live.timer = setTimeout(() => flush(live), FLUSH_MS)
          } else if (frame.activity) {
            if (!live.draft.activities.includes(frame.activity)) {
              publish(live, { activities: [...live.draft.activities, frame.activity], sourcesRead: frame.sourcesRead ?? live.draft.sourcesRead })
            }
          }
        }
      }
      clean = true
    } catch {
      clean = controller.signal.aborted
    } finally {
      if (live.timer) { clearTimeout(live.timer); flush(live) }
      if (live.abort === controller) live.abort = null
      if (clean && !controller.signal.aborted) publish(live, { streamEnded: true })
      // Not started yet, or dropped mid-stream: try again while the section is still being written.
      if (!clean && !controller.signal.aborted && live.wanted) {
        setTimeout(() => { if (live.wanted && !live.abort && !live.draft.streamEnded) connect(projectId, code, live) }, notYet ? NOT_YET_MS : RECONNECT_MS)
      }
    }
  })()
}

/** Start following a section's draft (idempotent). */
export function followDraft(projectId: string, code: string) {
  const live = entry(keyOf(projectId, code))
  live.wanted = true
  if (!live.abort && !live.draft.streamEnded) connect(projectId, code, live)
}

/** Stop following and forget the draft (the saved section is the source of truth now). */
export function forgetDraft(projectId: string, code: string) {
  const key = keyOf(projectId, code)
  const live = lives.get(key)
  if (!live) return
  live.wanted = false
  live.abort?.abort()
  live.abort = null
  if (live.timer) { clearTimeout(live.timer); live.timer = null }
  live.pending = ''
  // Reset in place: components already subscribed keep listening to the same entry.
  publish(live, EMPTY)
}

/** The live draft for one section; re-renders only when that section's draft changes. */
export function useLiveDraft(projectId: string, code: string | null): LiveDraft {
  const key = code ? keyOf(projectId, code) : ''
  const subscribe = useCallback((listener: () => void) => {
    if (!key) return () => {}
    const live = entry(key)
    live.listeners.add(listener)
    return () => { live.listeners.delete(listener) }
  }, [key])
  return useSyncExternalStore(subscribe, () => (key ? lives.get(key)?.draft ?? EMPTY : EMPTY))
}

/** Test hook: reset everything. */
export function resetLiveDrafts() {
  for (const [key] of lives) {
    const [projectId, code] = key.split(/:(.+)/)
    forgetDraft(projectId, code)
  }
  lives.clear()
}
