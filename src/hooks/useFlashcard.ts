import { useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { flashcardApi } from '../api/flashcard'
import { useFlashcardStore } from '../store/flashcardStore'

function toErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message) return e.message
  }
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred.'
}

const POLL_INTERVAL_MS = 2_000

export function useFlashcard() {
  const store = useFlashcardStore()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load decks on mount ───────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    flashcardApi.getDecks()
      .then((data) => { if (!cancelled) store.setDecks(data) })
      .catch((err) => { if (!cancelled) toast.error(toErrorMessage(err)) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Polling: when activeDeck is "processing", poll every 2s ──────────────

  useEffect(() => {
    const deck = store.activeDeck
    if (!deck || deck.status !== 'processing') {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    if (pollRef.current) return // already polling

    pollRef.current = setInterval(async () => {
      try {
        const updated = await flashcardApi.getDeck(deck.id)
        if (updated.status === 'ready') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          store.updateDeck(updated)
          store.setActiveDeck(updated)
        } else if (updated.status === 'error') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          store.updateDeck(updated)
          store.setActiveDeck(updated)
          toast.error(updated.errorMessage ?? 'Generation failed.')
        }
        // still processing — keep polling
      } catch (err) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        toast.error(toErrorMessage(err))
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.activeDeck?.id, store.activeDeck?.status])

  // ── Actions ───────────────────────────────────────────────────────────────

  const generate = useCallback(async (
    title: string,
    text: string,
    itemTypes: string[],
    sourceName?: string,
  ) => {
    store.setGenerating(true)
    try {
      const deck = await flashcardApi.generate({ title, text, itemTypes, sourceName })
      store.addDeck(deck)
      store.setActiveDeck(deck)
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      store.setGenerating(false)
    }
  }, [store])

  const selectDeck = useCallback(async (id: string) => {
    store.setLoadingDeck(true)
    try {
      const deck = await flashcardApi.getDeck(id)
      store.updateDeck(deck)
      store.setActiveDeck(deck)
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      store.setLoadingDeck(false)
    }
  }, [store])

  const removeDeck = useCallback(async (id: string) => {
    try {
      await flashcardApi.deleteDeck(id)
      store.removeDeck(id)
      toast.success('Deck deleted.')
    } catch (err) {
      toast.error(toErrorMessage(err))
    }
  }, [store])

  const retryDeck = useCallback(async (id: string) => {
    try {
      const deck = await flashcardApi.retryDeck(id)
      store.updateDeck(deck)
    } catch (err) {
      toast.error(toErrorMessage(err))
    }
  }, [store])

  const retryAllFailed = useCallback(async () => {
    const failed = store.decks.filter(d => d.status === 'error')
    await Promise.all(failed.map(d => retryDeck(d.id)))
    if (failed.length > 0) toast.success(`Retrying ${failed.length} deck${failed.length > 1 ? 's' : ''}…`)
  }, [store.decks, retryDeck])

  return {
    decks:         store.decks,
    activeDeck:    store.activeDeck,
    isGenerating:  store.isGenerating,
    isLoadingDeck: store.isLoadingDeck,
    studyIndex:    store.studyIndex,
    studyMode:     store.studyMode,
    generate,
    selectDeck,
    removeDeck,
    retryDeck,
    retryAllFailed,
    setStudyIndex:  store.setStudyIndex,
    setStudyMode:   store.setStudyMode,
    setActiveDeck:  store.setActiveDeck,
    extractDocument: flashcardApi.extractDocument,
  }
}
