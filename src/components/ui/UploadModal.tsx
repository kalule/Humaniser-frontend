import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X, Upload, FolderOpen, Plus, FileText, File, ChevronDown,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { WorkspaceFolder } from '../../types/library'

interface Props {
  open:     boolean
  folders:  WorkspaceFolder[]
  onClose:  () => void
  onUpload: (files: File[], folderId: string | null) => void
  onCreateFolder: (name: string) => WorkspaceFolder
}

const ACCEPTED = '.pdf,.docx,.doc,.md,.txt'
const MAX_FILES = 10
const MAX_MB    = 10

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf')           return <span className="text-red-500">PDF</span>
  if (ext === 'docx' || ext === 'doc') return <span className="text-blue-500">DOC</span>
  if (ext === 'md')            return <span className="text-purple-500">MD</span>
  return <span className="text-slate-400">TXT</span>
}

export function UploadModal({ open, folders, onClose, onUpload, onCreateFolder }: Props) {
  const [files, setFiles]             = useState<File[]>([])
  const [dragging, setDragging]       = useState(false)
  const [folderId, setFolderId]       = useState<string | null>(null)
  const [folderOpen, setFolderOpen]   = useState(false)
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [errors, setErrors]           = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFiles([]); setDragging(false); setFolderId(null)
    setFolderOpen(false); setNewFolderMode(false)
    setNewFolderName(''); setErrors([])
  }

  const handleClose = () => { reset(); onClose() }

  const addFiles = useCallback((incoming: File[]) => {
    const errs: string[] = []
    const valid = incoming.filter(f => {
      if (f.size > MAX_MB * 1024 * 1024) { errs.push(`${f.name} exceeds ${MAX_MB} MB`); return false }
      return true
    })
    setErrors(errs)
    setFiles(prev => {
      const combined = [...prev, ...valid]
      return combined.slice(0, MAX_FILES)
    })
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const removeFile = (i: number) =>
    setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = () => {
    if (!files.length) return
    onUpload(files, folderId)
    handleClose()
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    const f = onCreateFolder(newFolderName.trim())
    setFolderId(f.id)
    setNewFolderMode(false)
    setNewFolderName('')
    setFolderOpen(false)
  }

  const selectedFolder = folders.find(f => f.id === folderId)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.95,    y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-[16px]">Upload Files</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Constraints pill */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-[12px] text-slate-500">
                <span>Max file size: <strong className="text-slate-700">{MAX_MB} MB</strong></span>
                <span className="w-px h-4 bg-slate-200" />
                <span>Max per upload: <strong className="text-slate-700">{MAX_FILES} files</strong></span>
              </div>

              {/* Folder selector */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-600">Upload to folder</label>
                <div className="relative">
                  <button
                    onClick={() => setFolderOpen(v => !v)}
                    className="w-full flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-700 hover:border-slate-300 transition-colors"
                  >
                    <FolderOpen size={15} className="text-slate-400 shrink-0" />
                    <span className="flex-1 text-left">{selectedFolder ? selectedFolder.name : 'No folder (All files)'}</span>
                    <ChevronDown size={14} className={cn('text-slate-400 transition-transform', folderOpen && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {folderOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden"
                      >
                        {/* Create new folder */}
                        {newFolderMode ? (
                          <div className="flex items-center gap-2 p-2 border-b border-slate-100">
                            <input
                              autoFocus
                              value={newFolderName}
                              onChange={e => setNewFolderName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderMode(false) }}
                              placeholder="Folder name..."
                              className="flex-1 text-[13px] border border-slate-200 rounded-md px-2.5 py-1.5 outline-none focus:border-orange-400"
                            />
                            <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-orange-500 text-white text-[12px] rounded-md hover:bg-orange-600 transition-colors">
                              Create
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setNewFolderMode(true)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-orange-500 hover:bg-orange-50 transition-colors border-b border-slate-100"
                          >
                            <Plus size={14} /> Create New Folder
                          </button>
                        )}

                        {/* No folder option */}
                        <button
                          onClick={() => { setFolderId(null); setFolderOpen(false) }}
                          className={cn('w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-slate-50 transition-colors', !folderId && 'bg-slate-50 text-slate-700 font-medium')}
                        >
                          <FolderOpen size={14} className="text-slate-400" /> No folder (All files)
                        </button>

                        {/* Existing folders */}
                        {folders.map(f => (
                          <button
                            key={f.id}
                            onClick={() => { setFolderId(f.id); setFolderOpen(false) }}
                            className={cn('w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-slate-50 transition-colors text-slate-600', folderId === f.id && 'bg-slate-50 text-slate-700 font-medium')}
                          >
                            <FolderOpen size={14} className="text-amber-500" /> {f.name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200',
                  dragging
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
                )}
              >
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-colors', dragging ? 'bg-orange-100' : 'bg-slate-100')}>
                  <Upload size={22} className={dragging ? 'text-orange-500' : 'text-slate-500'} />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-slate-700">Drag and drop files here</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">or click to browse</p>
                </div>
                <p className="text-[11px] text-slate-400">Supported formats: PDF, DOCX, DOC, MD, TXT</p>
              </div>

              <input
                ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden"
                onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
              />

              {/* Error messages */}
              {errors.map(e => (
                <p key={e} className="text-[12px] text-red-500">{e}</p>
              ))}

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <div className="text-[10px] font-bold w-8 shrink-0 text-center">{fileIcon(f.name)}</div>
                      <span className="flex-1 text-[12px] text-slate-700 truncate">{f.name}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={handleClose} className="px-4 py-2 text-[13px] text-slate-600 hover:text-slate-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!files.length}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium transition-colors"
              >
                Upload {files.length > 0 ? files.length : 0} {files.length === 1 ? 'file' : 'files'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
