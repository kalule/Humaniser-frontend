import { useMemo, useState } from 'react'
import { Sparkles, Globe, FolderOpen, Layers, Loader2, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { cn, tiptapJsonToText } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { workbenchApi } from '../../api/workbench'
import type { WriteWithAiRequest, WriteWithAiResponse, WriteWithAiSourceMode } from '../../types/workbench'
import toast from 'react-hot-toast'

const MAX_SOURCE_DOCS = 5

interface WriteWithAiModalProps {
  isOpen:            boolean
  onClose:           () => void
  onGenerated:       (result: WriteWithAiResponse) => void
  excludeDocumentId?: string
}

const SOURCE_OPTIONS: { mode: WriteWithAiSourceMode; label: string; sub: string; icon: React.ReactNode }[] = [
  { mode: 'Web',     label: 'Web',     sub: 'Academic literature', icon: <Globe size={18} /> },
  { mode: 'MyFiles', label: 'My Files', sub: 'Library docs',       icon: <FolderOpen size={18} /> },
  { mode: 'Hybrid',  label: 'Hybrid',  sub: 'Both sources',        icon: <Layers size={18} /> },
]

export function WriteWithAiModal({ isOpen, onClose, onGenerated, excludeDocumentId }: WriteWithAiModalProps) {
  const [topic, setTopic] = useState('')
  const [wordCount, setWordCount] = useState(600)
  const [sourceMode, setSourceMode] = useState<WriteWithAiSourceMode>('Web')
  const [loading, setLoading] = useState(false)

  const documents = useLibraryStore(s => s.documents)

  const candidateDocs = useMemo(() =>
    documents
      .filter(d => d.id !== excludeDocumentId && !d.isPdf && (d.content ?? '').trim())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SOURCE_DOCS),
    [documents, excludeDocumentId],
  )

  const usesMyFiles = sourceMode === 'MyFiles' || sourceMode === 'Hybrid'

  const handleClose = () => {
    if (loading) return
    onClose()
  }

  const handleSubmit = async () => {
    if (!topic.trim() || loading) return
    setLoading(true)
    try {
      const payload: WriteWithAiRequest = {
        topic: topic.trim(),
        targetWordCount: wordCount,
        sourceMode,
        libraryDocuments: usesMyFiles
          ? candidateDocs.map(d => ({ title: d.title, content: tiptapJsonToText(d.content ?? '') }))
          : undefined,
      }
      const result = await workbenchApi.writeWithAi(payload)
      onGenerated(result)
      setTopic('')
      onClose()
    } catch {
      toast.error('AI writing failed — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      panelClassName="bg-white border border-slate-100 rounded-2xl shadow-2xl"
      bodyClassName=""
      showCloseButton={false}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-accent text-white flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <h2 className="text-[15px] font-bold text-slate-800">Start AI Writing</h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
          What would you like to write about?
        </label>
        <textarea
          autoFocus
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Enter your topic or title (e.g., 'The impact of artificial intelligence on healthcare')"
          rows={3}
          disabled={loading}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 disabled:opacity-60"
        />

        {loading && (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-purple-text" role="status" aria-live="polite">
            <Loader2 size={12} className="animate-spin shrink-0" />
            <span>Generating your draft — this can take up to a minute…</span>
            <span className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-purple-tint">
              <span className="block h-full w-1/3 animate-pulse bg-purple-accent" />
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <label className="text-[12px] font-medium text-slate-500">Target length</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={150}
              max={1200}
              step={50}
              value={wordCount}
              disabled={loading}
              onChange={e => setWordCount(Math.min(1200, Math.max(150, Number(e.target.value) || 600)))}
              className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-800 text-right outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 disabled:opacity-60"
            />
            <span className="text-[12px] text-slate-500">words</span>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-[12px] font-medium text-slate-500 mb-2">Citation Sources</label>
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.mode}
                type="button"
                disabled={loading}
                onClick={() => setSourceMode(opt.mode)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all disabled:opacity-60',
                  sourceMode === opt.mode
                    ? 'border-purple-accent bg-purple-tint text-purple-text'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                {opt.icon}
                <span className="text-[12px] font-semibold">{opt.label}</span>
                <span className="text-[10px] opacity-80">{opt.sub}</span>
              </button>
            ))}
          </div>

          {usesMyFiles && (
            <p className="mt-2 text-[11px] text-slate-500">
              {candidateDocs.length > 0
                ? `Will draw on your ${candidateDocs.length} most recent document${candidateDocs.length > 1 ? 's' : ''}: ${candidateDocs.map(d => d.title).join(', ')}`
                : 'No other documents found in your library yet — this will fall back to general knowledge.'}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="px-5 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!topic.trim() || loading}
          aria-busy={loading}
          className={cn(
            'flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors shadow-md',
            loading
              ? 'bg-purple-accent cursor-wait shadow-violet-200'
              : topic.trim()
                ? 'bg-purple-accent hover:bg-purple-deep shadow-violet-200'
                : 'bg-purple-accent/40 cursor-not-allowed shadow-none',
          )}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Writing…' : 'Start Writing'}
        </button>
      </div>
    </Modal>
  )
}
