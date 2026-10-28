import { useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { citationApi } from '../api/citation'
import { useCitationStore } from '../store/citationStore'
import type { FormatStyle, SaveCitationRequest } from '../types/citation'

function toErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message) return e.message
  }
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred.'
}

export function useCitation() {
  const store = useCitationStore()

  // ── Load library on mount ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    store.setLoading(true)
    citationApi.getLibrary()
      .then((data) => { if (!cancelled) store.setCitations(data) })
      .catch((err) => { if (!cancelled) toast.error(toErrorMessage(err)) })
      .finally(() => { if (!cancelled) store.setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Resolve ───────────────────────────────────────────────────────────────

  const resolve = useCallback(async (inputType: string, value: string) => {
    if (!value.trim()) return
    store.setResolved(null)
    store.setResolving(true)
    try {
      const result = await citationApi.resolve(inputType, value.trim())
      store.setResolved(result)
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      store.setResolving(false)
    }
  }, [store])

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = useCallback(async (data: SaveCitationRequest) => {
    store.setSaving(true)
    try {
      const saved = await citationApi.save(data)
      store.addCitation(saved)
      store.setResolved(null)
      store.setSelectedId(saved.id)
      toast.success('Saved to your library.')
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      store.setSaving(false)
    }
  }, [store])

  // ── Delete ────────────────────────────────────────────────────────────────

  const remove = useCallback(async (id: string) => {
    try {
      await citationApi.delete(id)
      store.removeCitation(id)
      if (store.selectedId === id) store.setSelectedId(null)
      toast.success('Citation removed.')
    } catch (err) {
      toast.error(toErrorMessage(err))
    }
  }, [store])

  // ── Export ────────────────────────────────────────────────────────────────

  const exportDocx = useCallback(async (format: FormatStyle) => {
    if (store.citations.length === 0) { toast.error('Your library is empty.'); return }
    store.setExporting(true)
    try {
      const { downloadCitationDocx } = await import('../lib/csl/citationDocx')
      await downloadCitationDocx(store.citations, format)
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      store.setExporting(false)
    }
  }, [store])

  const exportBibTex = useCallback(async () => {
    if (store.citations.length === 0) { toast.error('Your library is empty.'); return }
    store.setExporting(true)
    try {
      await citationApi.exportBibTex()
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      store.setExporting(false)
    }
  }, [store])

  return {
    ...store,
    resolve,
    save,
    remove,
    exportDocx,
    exportBibTex,
  }
}
