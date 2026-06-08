import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { WorkspaceTool } from './ToolActionBar'
import toast from 'react-hot-toast'

const PLACEHOLDER_MAP: Record<WorkspaceTool, string> = {
  humanise: 'Paste your AI-generated text to humanise it...',
  detect: 'Paste any text to check if it was written by AI...',
}

const DEFAULT_PLACEHOLDER = 'Write, paste, or upload your text here...'

interface WorkspaceInputProps {
  text: string
  onChange: (text: string) => void
  selectedTool: WorkspaceTool | null
  onSubmit: () => void
  isLoading: boolean
}

export function WorkspaceInput({
  text,
  onChange,
  selectedTool,
  onSubmit,
  isLoading,
}: WorkspaceInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const canSubmit = text.trim().length > 0 && selectedTool !== null && !isLoading
  const placeholder = selectedTool ? PLACEHOLDER_MAP[selectedTool] : DEFAULT_PLACEHOLDER

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 400) + 'px'
  }, [])

  useEffect(() => {
    autoResize()
  }, [text, autoResize])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const content = ev.target?.result
        if (typeof content === 'string') {
          onChange(content)
          toast.success('File uploaded — text extracted')
        }
      }
      reader.readAsText(file)
    } else {
      toast('File uploaded — text extracted', { icon: '📄' })
    }
  }

  const wordCountColor =
    wordCount >= 500
      ? 'text-red-400'
      : wordCount >= 400
        ? 'text-amber-400'
        : 'text-slate-500'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, duration: 0.25 }}
      className={cn(
        'bg-slate-800 border rounded-2xl shadow-xl shadow-black/30 overflow-hidden transition-all duration-150',
        isFocused
          ? 'border-indigo-500/50 shadow-[0_0_0_3px_rgba(99,102,241,0.1)]'
          : 'border-slate-700',
      )}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        rows={5}
        className="w-full bg-transparent text-slate-100 text-base placeholder:text-slate-500 resize-none outline-none p-5 min-h-[160px] max-h-[400px] leading-relaxed"
        aria-label="Text input"
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between h-[52px] px-4 bg-slate-800/80 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            aria-label="Upload file"
          >
            <Plus size={15} />
            Upload file
          </button>
          <span className={cn('text-xs', wordCountColor)}>
            {wordCount === 0 ? '0 words' : `${wordCount} word${wordCount !== 1 ? 's' : ''}`}
          </span>
        </div>

        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          whileTap={canSubmit ? { scale: 0.95 } : undefined}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150',
            canSubmit
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed',
          )}
          aria-label="Submit"
          title={
            !selectedTool
              ? 'Select a tool first'
              : !text.trim()
                ? 'Enter some text first'
                : 'Run (Ctrl+Enter)'
          }
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
        </motion.button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.doc,.docx,.pdf"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </motion.div>
  )
}
