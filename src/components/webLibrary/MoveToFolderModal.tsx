import { FolderOpen, Folder, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/utils'
import type { LibraryFolder } from '../../types/webLibrary'

// "Move to folder" was listed as a row action with no UI anywhere to do it,
// even though the handler already exists (updateDocument's folderId field —
// the same mechanism Trash already uses). This wires it up rather than
// inventing a new capability (Research Library UX audit, 2026-10-03).
export function MoveToFolderModal({
  open, folders, currentFolderId, onClose, onMove,
}: {
  open:            boolean
  folders:         LibraryFolder[]
  currentFolderId: string | null | undefined
  onClose:         () => void
  onMove:          (folderId: string | null) => void
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Move to folder" size="sm">
      <div className="space-y-0.5">
        <button
          onClick={() => onMove(null)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 transition-colors"
        >
          <FolderOpen size={14} className="text-slate-400 shrink-0" />
          <span className="flex-1 text-[13px] text-slate-700">All files (no folder)</span>
          {!currentFolderId && <Check size={13} className="text-purple-accent shrink-0" />}
        </button>
        {folders.map(f => (
          <button
            key={f.id}
            onClick={() => onMove(f.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
              currentFolderId === f.id ? 'bg-purple-tint' : 'hover:bg-slate-50',
            )}
          >
            <Folder size={14} className="text-slate-400 shrink-0" />
            <span className="flex-1 text-[13px] text-slate-700 truncate">{f.name}</span>
            {currentFolderId === f.id && <Check size={13} className="text-purple-accent shrink-0" />}
          </button>
        ))}
        {folders.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-4">No folders yet — create one from the sidebar.</p>
        )}
      </div>
    </Modal>
  )
}
