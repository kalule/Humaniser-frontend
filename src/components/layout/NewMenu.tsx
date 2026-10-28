import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus, FileText, Upload, Sparkles, Shield, RefreshCw, SpellCheck, Scissors,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { importDocumentFromFile } from '../../lib/importWordDocument'
import { CreationCard } from '../app/CreationCard'

// New-document flow prompt #4 — a global entry point into document creation, reachable from any
// authenticated screen (not just the Library). "New document" reuses prompt #3's CreationCard
// unchanged; "Import document" is a quicker, no-dialog version of the same card's import button
// (importDocumentFromFile, shared) since asking for a document type/citation style just to upload
// an existing file would be unnecessary friction here.
const LAUNCH_TOOLS = [
  { label: 'Humaniser',   icon: Sparkles,   link: '/app/humaniser',  description: 'Rewrite AI text to sound natural' },
  { label: 'AI Detector', icon: Shield,     link: '/app/detector',   description: 'Check text for AI authorship' },
  { label: 'Paraphraser', icon: RefreshCw,  link: '/app/paraphrase', description: 'Rephrase text in a new style' },
  { label: 'Grammar',     icon: SpellCheck, link: '/app/grammar',    description: 'Fix spelling and grammar issues' },
  { label: 'Summariser',  icon: Scissors,   link: '/app/summarise',  description: 'Condense text to its key points' },
]

export function NewMenu({ compact }: { compact: boolean }) {
  const [open, setOpen] = useState(false)
  const [showCreationCard, setShowCreationCard] = useState(false)
  const [importing, setImporting] = useState(false)
  const createDocument = useLibraryStore(s => s.createDocument)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // Escape closes the menu from anywhere, not only once focus is inside it — opening it with the
    // mouse leaves focus on the trigger, where the menu's own onKeyDown never sees the key.
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    const raf = requestAnimationFrame(() => itemRefs.current[0]?.focus())
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const closeAndFocusTrigger = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => itemRefs.current[0]?.focus())
    }
  }

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean) as HTMLElement[]
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); closeAndFocusTrigger(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(currentIndex + 1) % items.length]?.focus(); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(currentIndex - 1 + items.length) % items.length]?.focus(); return }
  }

  const handleImportClick = () => {
    setOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || importing) return
    setImporting(true)
    try {
      await importDocumentFromFile(file, createDocument)
      toast.success('Document imported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="relative px-2 pt-2 pb-1.5" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? 'New' : undefined}
        title={compact ? 'New' : undefined}
        className={cn(
          'flex items-center gap-2 rounded-lg border font-medium text-[13px] transition-colors',
          compact ? 'w-8 h-8 justify-center mx-auto' : 'w-full px-3 py-1.5',
        )}
        style={{ borderColor: 'var(--color-purple)', color: 'var(--color-purple)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-purple-tint)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Plus size={16} />
        {!compact && 'New'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="New"
            onKeyDown={handleMenuKeyDown}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className={cn('absolute z-40 top-full mt-1.5 w-64 rounded-xl shadow-elevated overflow-hidden py-1.5', compact ? 'left-0' : 'left-2')}
            style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-hairline)' }}
          >
            <button
              ref={el => { itemRefs.current[0] = el }}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setShowCreationCard(true) }}
              className="flex items-start gap-2.5 w-full px-3 py-2 text-left transition-colors hover:bg-[var(--surface-rail)]"
            >
              <FileText size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="flex flex-col">
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>New document</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pick a type and citation style</span>
              </span>
            </button>
            <button
              ref={el => { itemRefs.current[1] = el }}
              type="button"
              role="menuitem"
              disabled={importing}
              onClick={handleImportClick}
              className="flex items-start gap-2.5 w-full px-3 py-2 text-left transition-colors hover:bg-[var(--surface-rail)] disabled:opacity-50"
            >
              <Upload size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="flex flex-col">
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {importing ? 'Importing…' : 'Import document'}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Bring in a Word (.docx) file</span>
              </span>
            </button>

            <div className="my-1.5 mx-3" style={{ borderTop: '0.5px solid var(--border-hairline)' }} />
            <p className="px-3 pb-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>
              Start with a tool
            </p>
            {LAUNCH_TOOLS.map((tool, i) => (
              <Link
                key={tool.label}
                ref={el => { itemRefs.current[2 + i] = el }}
                to={tool.link}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-start gap-2.5 w-full px-3 py-2 text-left transition-colors hover:bg-[var(--surface-rail)]"
              >
                <tool.icon size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{tool.label}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{tool.description}</span>
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.docx"
        onChange={e => void handleFileSelected(e)}
        className="hidden"
        aria-hidden="true"
      />

      {showCreationCard && <CreationCard onClose={() => setShowCreationCard(false)} />}
    </div>
  )
}
