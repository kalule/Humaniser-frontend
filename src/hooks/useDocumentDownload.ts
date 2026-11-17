import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { downloadLibraryDocument, exportErrorMessage, type ExportFormat } from '../lib/documentExport'

/** Shared by the Documents row menu and the Editor toolbar: one in-flight download at a time, with a clear error toast. */
export function useDocumentDownload() {
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null)

  const download = useCallback(async (
    doc: { id: string; title: string }, format: ExportFormat, references: string[], beforeExport?: () => Promise<void>,
  ) => {
    if (busyFormat) return
    setBusyFormat(format)
    try {
      await beforeExport?.()
      await downloadLibraryDocument(doc, format, references)
    } catch (err) {
      toast.error(exportErrorMessage(err))
    } finally {
      setBusyFormat(null)
    }
  }, [busyFormat])

  return { download, busyFormat, isDownloading: busyFormat !== null }
}
