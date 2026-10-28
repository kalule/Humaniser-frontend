import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MoreVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tooltip } from '../ui/Tooltip'
import { CitePopover, type CitablePaper } from './CitePopover'
import type { RowAction } from './libraryRowActions'

// One shared actions bar for every saved-papers row (Library View, Reference
// Manager View, and Collection detail in a later pass) — same icons, same
// order, same labels everywhere (Research Library UX audit, 2026-10-03).
//
// The kebab menu renders into document.body via a portal with its position
// computed from the trigger's own bounding rect — rows live inside a
// horizontally/vertically scrolling table (`overflow-auto`), and an
// absolutely-positioned child there gets silently clipped to that scroll
// container instead of floating over the page. Same technique CitePopover
// already uses for this exact reason.
export function RowActionBar({ open, paper, overflow }: { open: RowAction; paper: CitablePaper; overflow: RowAction[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect()
    if (!trigger) return
    const margin = 8
    const width = 224 // w-56
    const height = menuRef.current?.offsetHeight ?? 260
    const left = Math.min(Math.max(trigger.right - width, margin), window.innerWidth - width - margin)
    const roomBelow = window.innerHeight - trigger.bottom - margin
    const top = roomBelow >= height
      ? trigger.bottom + 4
      : Math.max(margin, trigger.top - height - 4)
    setPosition({ left, top, ready: true })
  }, [])

  useLayoutEffect(() => {
    if (!menuOpen) return
    updatePosition()
    const frame = requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [menuOpen, updatePosition])

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <Tooltip label={open.disabledReason ?? open.label}>
        <button
          onClick={open.onClick}
          disabled={open.disabled}
          aria-label={open.label}
          className={cn(
            'w-7 h-7 rounded-lg border flex items-center justify-center transition-colors',
            open.disabled
              ? 'border-slate-100 text-slate-300 cursor-not-allowed'
              : 'border-slate-200 text-slate-500 hover:bg-purple-tint hover:text-purple-accent hover:border-purple-accent',
          )}
        >
          {open.icon}
        </button>
      </Tooltip>

      <CitePopover paper={paper} />

      <Tooltip label="More actions">
        <button
          ref={triggerRef}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center transition-colors"
        >
          <MoreVertical size={14} />
        </button>
      </Tooltip>
      {createPortal(
        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[70]" onClick={() => setMenuOpen(false)} />
              <motion.div
                ref={menuRef}
                role="menu"
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="fixed w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-[71] py-1 overflow-hidden"
                style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
              >
                {overflow.map(action => (
                  <button
                    key={action.key}
                    role="menuitem"
                    disabled={action.disabled}
                    title={action.disabledReason}
                    onClick={() => { setMenuOpen(false); action.onClick() }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors',
                      action.disabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : action.key === 'trash' || action.key === 'delete-forever'
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {action.icon} {action.label}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
