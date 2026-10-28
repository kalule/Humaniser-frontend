import { BookOpen, Download, MessageCircle, FolderPlus, Info, FolderInput, Trash2, RotateCcw, XCircle, FolderMinus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ResearchDocument } from '../../types/webLibrary'

export interface RowAction {
  key:      string
  icon:     ReactNode
  label:    string
  disabled: boolean
  disabledReason?: string
  onClick:  () => void
}

export interface RowActionHandlers {
  onOpenPdfViewer: (doc: ResearchDocument) => void
  onDownload:      (doc: ResearchDocument) => void
  onChat:          (doc: ResearchDocument) => void
  onAddToCollection: (doc: ResearchDocument) => void
  onDetails:       (doc: ResearchDocument) => void
  onMoveToFolder:  (doc: ResearchDocument) => void
  onTrash:         (doc: ResearchDocument) => void
  // Only used in the Trash location — real handlers (updateDocument/deleteDocument), not stubs.
  onRestore?:        (doc: ResearchDocument) => void
  onDeleteForever?:  (doc: ResearchDocument) => void
  // Only used in Collection detail — removes membership without touching the paper itself.
  onRemoveFromCollection?: (doc: ResearchDocument) => void
}

// One shared action config for every saved-papers view (Library View, Reference
// Manager View, and Collection detail in a later pass) — so the same action
// behaves the same way everywhere instead of each view re-implementing its own
// subset (Research Library UX audit, 2026-10-03).
//
// "Open" only has a real destination for canonical (Find Papers-sourced) papers
// — WebLibraryPdfViewerPage is keyed by canonicalWorkId, there is no viewer for
// a manually uploaded file beyond downloading it. For uploads, Open falls back
// to the same download action rather than claiming a viewer that doesn't exist.
// Plain helper functions, not React hooks (no internal state/effects) — named
// without a "use" prefix so calling them inside .map() isn't flagged by the
// rules-of-hooks lint.
export function getPrimaryRowActions(doc: ResearchDocument, handlers: RowActionHandlers): { open: RowAction; cite: boolean } {
  const canOpenViewer = Boolean(doc.canonicalWorkId)
  const hasFile = Boolean(doc.filePath)
  const open: RowAction = canOpenViewer
    ? { key: 'open', icon: <BookOpen size={13} />, label: 'Open', disabled: false, onClick: () => handlers.onOpenPdfViewer(doc) }
    : hasFile
      ? { key: 'open', icon: <Download size={13} />, label: 'Open file', disabled: false, onClick: () => handlers.onDownload(doc) }
      : { key: 'open', icon: <BookOpen size={13} />, label: 'Open', disabled: true, disabledReason: 'No file attached to this record', onClick: () => {} }
  return { open, cite: true }
}

export function getOverflowRowActions(doc: ResearchDocument, handlers: RowActionHandlers, inTrash: boolean): RowAction[] {
  const canDetails = Boolean(doc.canonicalWorkId)
  const hasFile = Boolean(doc.filePath)

  const actions: RowAction[] = [
    {
      key: 'collection', icon: <FolderPlus size={14} />, label: 'Add to collection', disabled: false,
      onClick: () => handlers.onAddToCollection(doc),
    },
    {
      key: 'chat', icon: <MessageCircle size={14} />, label: 'Chat with this paper', disabled: false,
      onClick: () => handlers.onChat(doc),
    },
    {
      key: 'download', icon: <Download size={14} />, label: 'Download', disabled: !hasFile,
      disabledReason: hasFile ? undefined : 'No file attached to this record',
      onClick: () => handlers.onDownload(doc),
    },
    {
      key: 'details', icon: <Info size={14} />, label: 'Details', disabled: !canDetails,
      disabledReason: canDetails ? undefined : 'Only available for papers found via Find Papers',
      onClick: () => handlers.onDetails(doc),
    },
    {
      key: 'move', icon: <FolderInput size={14} />, label: 'Move to folder', disabled: false,
      onClick: () => handlers.onMoveToFolder(doc),
    },
  ]

  if (inTrash) {
    if (handlers.onRestore) {
      actions.push({ key: 'restore', icon: <RotateCcw size={14} />, label: 'Restore', disabled: false, onClick: () => handlers.onRestore!(doc) })
    }
    if (handlers.onDeleteForever) {
      actions.push({ key: 'delete-forever', icon: <XCircle size={14} />, label: 'Delete permanently', disabled: false, onClick: () => handlers.onDeleteForever!(doc) })
    }
  } else {
    actions.push({ key: 'trash', icon: <Trash2 size={14} />, label: 'Move to Trash', disabled: false, onClick: () => handlers.onTrash(doc) })
  }

  if (handlers.onRemoveFromCollection) {
    actions.push({ key: 'remove-from-collection', icon: <FolderMinus size={14} />, label: 'Remove from collection', disabled: false, onClick: () => handlers.onRemoveFromCollection!(doc) })
  }

  return actions
}
