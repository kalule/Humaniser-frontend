import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Quote, Copy, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  formatEssayInTextCitation, formatEssayReferenceListEntry,
} from '../../lib/citationFormat'
import type { EssayCitationStyleName, EssayReferenceMeta } from '../../lib/citationFormat'

const STYLES: EssayCitationStyleName[] = ['Harvard', 'Apa7', 'Ieee', 'Chicago', 'Vancouver']
const STYLE_LABELS: Record<EssayCitationStyleName, string> = {
  Harvard: 'Harvard', Apa7: 'APA 7th', Ieee: 'IEEE', Chicago: 'Chicago', Vancouver: 'Vancouver',
}

export interface CitablePaper {
  title:    string
  authors:  string[]
  year?:    number
  journal?: string
  doi?:     string
}

function toMeta(paper: CitablePaper): EssayReferenceMeta {
  return {
    title:   paper.title,
    authors: paper.authors.length > 0 ? paper.authors.join(', ') : null,
    year:    paper.year ?? null,
    venue:   paper.journal ?? null,
    doi:     paper.doi ?? null,
  }
}

/** Deterministic citation from the paper's own canonical metadata — no LLM reconstruction. */
export function CitePopover({ paper }: { paper: CitablePaper }) {
  const [open, setOpen]   = useState(false)
  const [style, setStyle] = useState<EssayCitationStyleName>('Harvard')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 12, top: 12, ready: false })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect()
    if (!trigger) return
    const margin = 12
    const gap = 6
    const width = Math.min(320, window.innerWidth - margin * 2)
    const height = popoverRef.current?.offsetHeight ?? 280
    // Prefer aligning the popover's left edge with the trigger. This keeps it inside the
    // Web Library content area instead of extending left beneath the application sidebar.
    const left = Math.min(Math.max(trigger.left, margin), window.innerWidth - width - margin)
    const roomBelow = window.innerHeight - trigger.bottom - margin
    const top = roomBelow >= height || trigger.top < height + gap + margin
      ? Math.min(trigger.bottom + gap, window.innerHeight - height - margin)
      : Math.max(margin, trigger.top - height - gap)
    setPosition({ left, top: Math.max(margin, top), ready: true })
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const frame = requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    // Capture scrolls from nested Web Library containers as well as window scrolling.
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const meta      = toMeta(paper)
  const inText    = formatEssayInTextCitation(meta, style, 0)
  const reference = formatEssayReferenceListEntry(meta, style, 0)

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy — please try again.')
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <Quote size={12} /> Cite
      </button>
      {createPortal(<AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <motion.div
              ref={popoverRef}
              role="dialog"
              aria-label="Cite this paper"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed bg-white border border-slate-200 rounded-xl shadow-xl z-[71] w-[min(20rem,calc(100vw-1.5rem))] p-3"
              style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Cite this paper</p>
                <div className="relative">
                  <select
                    value={style}
                    onChange={e => setStyle(e.target.value as EssayCitationStyleName)}
                    className="text-[12px] border border-slate-200 rounded-lg pl-2 pr-6 py-1 text-slate-700 outline-none focus:border-purple-accent appearance-none bg-white"
                  >
                    {STYLES.map(s => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">In-text</p>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[13px] text-slate-800 bg-slate-50 rounded-lg px-2.5 py-1.5">{inText}</p>
                    <button onClick={() => copy(inText, 'In-text citation')} title="Copy in-text" className="mt-1.5 text-slate-400 hover:text-slate-700 transition-colors">
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">Reference</p>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[12.5px] text-slate-700 leading-relaxed bg-slate-50 rounded-lg px-2.5 py-1.5">{reference}</p>
                    <button onClick={() => copy(reference, 'Reference')} title="Copy reference" className="mt-1.5 text-slate-400 hover:text-slate-700 transition-colors">
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}
    </div>
  )
}
