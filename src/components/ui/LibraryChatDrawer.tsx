import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  MessageCircle, X, ChevronDown, Send, BookOpen, CornerDownRight, Minimize2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { nanoid } from 'nanoid'

interface ChatMessage {
  id:      string
  role:    'user' | 'assistant'
  content: string
}

export interface ChatContext {
  docId: string
  title: string
}

interface Props {
  open:           boolean
  onClose:        () => void
  context:        ChatContext | null
  onClearContext: () => void
}

const MODELS   = ['System Default', 'Claude Sonnet 4.6', 'GPT-4o', 'Gemini Pro']
const STARTERS = [
  'Summarize my most recent paper',
  'What are the key findings across my documents?',
  'Find methodology patterns in my library',
]

const DOT_DELAY = ['0s', '0.15s', '0.3s']

export function LibraryChatDrawer({ open, onClose, context, onClearContext }: Props) {
  const [messages,   setMessages]   = useState<ChatMessage[]>([])
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [model,      setModel]      = useState('System Default')
  const [modelOpen,  setModelOpen]  = useState(false)
  const [minimized,  setMinimized]  = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!minimized) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, minimized])

  // Reset messages when context changes
  useEffect(() => {
    setMessages([])
  }, [context?.docId])

  const handleSend = () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = { id: nanoid(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    setMinimized(false)

    setTimeout(() => {
      const scope = context
        ? `Regarding "${context.title}": `
        : 'Across your library: '
      setMessages(prev => [
        ...prev,
        {
          id:      nanoid(),
          role:    'assistant',
          content: `${scope}This is a placeholder answer. Connect your backend AI endpoint to return real answers with inline citations [Doc 1, p. 3].`,
        },
      ])
      setSending(false)
    }, 1400)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 flex flex-col"
      style={{ maxHeight: minimized ? 'auto' : 'calc(100vh - 80px)', minHeight: minimized ? 'auto' : 440 }}
    >
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 shrink-0 bg-white">
        <div className="w-8 h-8 rounded-xl bg-purple-tint flex items-center justify-center">
          <MessageCircle size={16} className="text-purple-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 leading-none">Chat</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {context ? `Scoped: 1 document` : 'Your full library'}
          </p>
        </div>
        <button
          onClick={() => setMinimized(v => !v)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title={minimized ? 'Expand' : 'Minimise'}
        >
          <Minimize2 size={14} />
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {!minimized && (
        <>
          {/* ── Context banner ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {context && (
              <motion.div
                key="ctx"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden shrink-0"
              >
                <div className="flex items-start gap-2 px-4 py-2 bg-purple-tint/80 border-b border-purple-tint">
                  <CornerDownRight size={12} className="text-purple-accent shrink-0 mt-0.5" />
                  <p className="flex-1 text-[12px] text-purple-text font-medium leading-snug line-clamp-2">
                    {context.title}
                  </p>
                  <button
                    onClick={onClearContext}
                    className="text-purple-accent hover:text-purple-text shrink-0 transition-colors mt-0.5"
                    title="Switch to library-wide chat"
                  >
                    <X size={11} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Messages area ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isEmpty ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <BookOpen size={26} className="text-slate-300" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-slate-800">
                    {context ? 'Chat with this document' : 'Chat with your library'}
                  </p>
                  <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                    Ask questions about your documents and get AI-powered answers with citations.
                  </p>
                </div>
                {/* Starter chips */}
                <div className="flex flex-col gap-2 w-full">
                  {STARTERS.map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); textareaRef.current?.focus() }}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 text-[12px] text-slate-600 hover:border-purple-accent hover:bg-purple-tint/60 hover:text-purple-text transition-colors leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Thread */
              <div className="space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' && 'justify-end')}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-purple-tint flex items-center justify-center shrink-0 mt-0.5">
                        <MessageCircle size={13} className="text-purple-accent" />
                      </div>
                    )}
                    <div className={cn(
                      'rounded-2xl px-3.5 py-2.5 max-w-[78%] text-[13px] leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-slate-800 text-white rounded-tr-sm'
                        : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm',
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-tint flex items-center justify-center shrink-0 mt-0.5">
                      <MessageCircle size={13} className="text-purple-accent" />
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
                      {DOT_DELAY.map((d, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: d }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <div className="border-t border-slate-100 px-3 py-3 space-y-2 shrink-0 bg-white">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setModelOpen(v => !v)}
                className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg text-[12px] px-3 py-1.5 text-slate-600 hover:border-slate-300 transition-colors"
              >
                <span>{model}</span>
                <ChevronDown size={11} className={cn('text-slate-400 transition-transform duration-150', modelOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {modelOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden"
                    >
                      {MODELS.map(m => (
                        <button
                          key={m}
                          onClick={() => { setModel(m); setModelOpen(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-[12px] transition-colors',
                            model === m
                              ? 'bg-purple-tint text-purple-text font-medium'
                              : 'text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Textarea + send */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your files..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-accent resize-none transition-colors leading-relaxed"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="absolute right-3 bottom-3 w-7 h-7 rounded-lg bg-purple-tint0 hover:bg-purple-deep disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shadow-sm"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
