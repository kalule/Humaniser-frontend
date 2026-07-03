import { useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { pdfChatApi } from '../api/pdfChat'
import { usePdfChatStore } from '../store/pdfChatStore'
import { classifyApiError } from '../lib/classifyApiError'

function toErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message) return e.message
  }
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred. Please try again.'
}

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS  = 300_000   // 5 min
const MAX_FILE_MB      = 50

export function usePdfChat() {
  const {
    document, messages, isIngesting, isQuerying, pdfFileUrl,
    setDocument, updateDocument, addMessage, updateMessage,
    setIngesting, setQuerying, setPdfFileUrl, reset,
  } = usePdfChatStore()

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const _stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // ── Upload & ingest ──────────────────────────────────────────────────────────

  const uploadDocument = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported.')
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_FILE_MB} MB limit.`)
      return
    }

    // Revoke any previous object URL before creating a new one
    const prev = usePdfChatStore.getState().pdfFileUrl
    if (prev) URL.revokeObjectURL(prev)

    reset()

    const objectUrl = URL.createObjectURL(file)
    setPdfFileUrl(objectUrl)
    setIngesting(true)

    try {
      const res = await pdfChatApi.upload(file)

      setDocument({
        documentId:   res.documentId,
        jobId:        res.jobId,
        fileName:     file.name,
        pageCount:    null,
        status:       'ingesting',
        errorMessage: null,
      })

      const start = Date.now()

      pollRef.current = setInterval(async () => {
        if (Date.now() - start > POLL_TIMEOUT_MS) {
          _stopPolling()
          updateDocument({ status: 'error', errorMessage: 'Processing timed out. Please try uploading again.' })
          setIngesting(false)
          return
        }

        try {
          const status = await pdfChatApi.pollStatus(res.jobId)

          if (status.status === 'completed') {
            _stopPolling()
            updateDocument({ status: 'ready', pageCount: status.pageCount ?? null })
            setIngesting(false)
            toast.success(`Ready — ${status.pageCount ?? 0} pages indexed`)
          } else if (status.status === 'failed') {
            _stopPolling()
            updateDocument({
              status:       'error',
              errorMessage: status.error ?? 'Document processing failed.',
            })
            setIngesting(false)
          }
        } catch (err) {
          _stopPolling()
          const raw = toErrorMessage(err)
          const classified = classifyApiError(raw)
          updateDocument({ status: 'error', errorMessage: classified.message })
          setIngesting(false)
        }
      }, POLL_INTERVAL_MS)

    } catch (err) {
      const raw = toErrorMessage(err)
      const classified = classifyApiError(raw)
      updateDocument({ status: 'error', errorMessage: classified.message })
      setIngesting(false)
      toast.error(classified.message)
    }
  }, [reset, setIngesting, setDocument, updateDocument, setPdfFileUrl])

  // ── Query ────────────────────────────────────────────────────────────────────

  const queryDocument = useCallback(async (text: string, highQuality = false) => {
    if (!document || document.status !== 'ready') return
    if (!text.trim()) return

    addMessage({
      id:        nanoid(),
      role:      'user',
      content:   text.trim(),
      createdAt: new Date().toISOString(),
    })

    const assistantId = nanoid()
    addMessage({
      id:        assistantId,
      role:      'assistant',
      content:   '',
      isLoading: true,
      createdAt: new Date().toISOString(),
    })
    setQuerying(true)

    try {
      const res = await pdfChatApi.query({
        documentId:  document.documentId,
        query:       text.trim(),
        highQuality,
      })
      updateMessage(assistantId, {
        content:     res.answer,
        sourcePages: res.sourcePages,
        isLoading:   false,
      })
    } catch (err) {
      const raw = toErrorMessage(err)
      const classified = classifyApiError(raw)
      updateMessage(assistantId, {
        content:   '',
        error:     classified.message,
        errorKind: classified.kind,
        isLoading: false,
      })
      if (classified.kind !== 'offline' && classified.kind !== 'sandbox_offline') {
        toast.error(classified.message)
      }
    } finally {
      setQuerying(false)
    }
  }, [document, addMessage, updateMessage, setQuerying])

  // ── Clear ────────────────────────────────────────────────────────────────────

  const clearDocument = useCallback(() => {
    _stopPolling()
    const url = usePdfChatStore.getState().pdfFileUrl
    if (url) URL.revokeObjectURL(url)
    reset()
  }, [reset])

  return {
    document,
    messages,
    isIngesting,
    isQuerying,
    pdfFileUrl,
    uploadDocument,
    queryDocument,
    clearDocument,
  }
}
