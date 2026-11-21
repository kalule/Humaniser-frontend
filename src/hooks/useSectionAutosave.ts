import { useCallback, useEffect, useRef, useState } from 'react'

/** Wait after the last keystroke before saving. */
export const SAVE_DEBOUNCE_MS = 1000
/** "Saving…" stays up at least this long, so a fast save never flashes. */
export const MIN_SAVING_MS = 700

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/** What to do with an edit the server refused. */
export type SaveFailure = 'retry' | 'discard'

interface Options {
  save:    (content: string) => Promise<void>
  /** Decide whether a refused edit can be retried (kept) or must be dropped. */
  onError: (err: unknown) => SaveFailure
  /** Called when nothing is left to save. */
  onIdle?: () => void
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Debounced, serialised autosave for one section. At most one request is in flight; edits made
 * while it runs are saved next, newest only, so a slow older save can never land after a newer
 * one. The indicator moves idle -> pending -> saving -> saved without flicker: "saving" is shown
 * for at least MIN_SAVING_MS and "saved" stays until the next edit. Anything still unsaved is
 * sent when the editor unmounts (scrolled away, view switched).
 */
export function useSectionAutosave({ save, onError, onIdle }: Options) {
  const [state, setState] = useState<SaveState>('idle')
  const unsaved = useRef<string | null>(null)
  const failed = useRef<string | null>(null)
  const inFlight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingSince = useRef(0)
  const callbacks = useRef({ save, onError, onIdle })
  callbacks.current = { save, onError, onIdle }

  const run = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current
    const work = (async () => {
      while (unsaved.current !== null) {
        const content = unsaved.current
        unsaved.current = null
        if (!savingSince.current) savingSince.current = Date.now()
        setState('saving')
        try {
          await callbacks.current.save(content)
          failed.current = null
        } catch (err) {
          const decision = callbacks.current.onError(err)
          // A newer edit typed meanwhile supersedes the failed one either way.
          failed.current = decision === 'retry' ? (unsaved.current ?? content) : null
          unsaved.current = null
          savingSince.current = 0
          setState(decision === 'retry' ? 'error' : 'idle')
          if (decision === 'discard') callbacks.current.onIdle?.()
          return
        }
      }
      const remaining = MIN_SAVING_MS - (Date.now() - savingSince.current)
      if (remaining > 0) await delay(remaining)
      if (unsaved.current === null && timer.current === null) {
        savingSince.current = 0
        setState('saved')
        callbacks.current.onIdle?.()
      }
    })()
    inFlight.current = work.finally(() => {
      inFlight.current = null
      // An edit that arrived during the minimum "saving" wait is still owed a save.
      if (unsaved.current !== null && timer.current === null) void run()
    })
    return inFlight.current
  }, [])

  const schedule = useCallback((content: string) => {
    unsaved.current = content
    failed.current = null
    setState(s => (s === 'saving' ? s : 'pending'))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; void run() }, SAVE_DEBOUNCE_MS)
  }, [run])

  /** Save anything pending now (before approve, export, or leaving). */
  const flush = useCallback((): Promise<void> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (unsaved.current !== null || inFlight.current) return run()
    return Promise.resolve()
  }, [run])

  const retry = useCallback(() => {
    if (failed.current === null) return
    unsaved.current = failed.current
    failed.current = null
    void run()
  }, [run])

  /** True while there is text the server has not confirmed. */
  const hasUnsaved = useCallback(
    () => unsaved.current !== null || inFlight.current !== null || timer.current !== null || failed.current !== null, [])

  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (unsaved.current !== null) void run()
  }, [run])

  return { state, schedule, flush, retry, hasUnsaved }
}
