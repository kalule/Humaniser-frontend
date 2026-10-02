import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Share2, ChevronDown, Sparkles, Shield, RefreshCw, SpellCheck, Scissors } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useToolTransferStore } from '../../store/toolTransferStore'

const DESTINATIONS = [
  { label: 'Rewrite',    path: '/app/humaniser',  Icon: Sparkles  },
  { label: 'AI Detector',   path: '/app/detector',   Icon: Shield     },
  { label: 'Paraphraser',   path: '/app/paraphrase', Icon: RefreshCw  },
  { label: 'Grammar',       path: '/app/grammar',    Icon: SpellCheck },
  { label: 'Summariser',    path: '/app/summarise',  Icon: Scissors   },
] as const

interface SendToMenuProps {
  text: string
  className?: string
  /** Expand the destination list in flow instead of as a floating popover. */
  inline?: boolean
}

export function SendToMenu({ text, className, inline = false }: SendToMenuProps) {
  const [open, setOpen] = useState(false)
  // Decided when the menu opens, from where the button sits in the viewport, so the
  // list never runs off the right edge or into the card's top/bottom edge.
  const [alignRight, setAlignRight] = useState(false)
  const [openUp, setOpenUp] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const setTransfer = useToolTransferStore((s) => s.setTransfer)

  const destinations = DESTINATIONS.filter((d) => d.path !== pathname)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!text) return null

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (!open && ref.current) {
            const r = ref.current.getBoundingClientRect()
            setAlignRight(r.left > window.innerWidth / 2)
            setOpenUp(window.innerHeight - r.bottom < 240)
          }
          setOpen((v) => !v)
        }}
        className="inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] text-text-sec border border-[#e0e0da] bg-white hover:border-[#d1d5db] hover:text-text-pri transition-colors"
      >
        <Share2 size={11} />
        Send to
        <ChevronDown
          size={10}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className={cn(
          'bg-white overflow-hidden',
          // Inline: expands in normal flow so it can live inside another
          // menu without being clipped by that menu's overflow-hidden.
          inline
            ? 'mt-0.5'
            : cn(
                'absolute z-50 w-44 border border-gray-200 rounded-xl shadow-elevated',
                openUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
                alignRight ? 'right-0' : 'left-0',
              ),
        )}>
          {destinations.map(({ label, path, Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => {
                setTransfer(text, pathname)
                navigate(path)
                setOpen(false)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Icon size={12} className="text-gray-400 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
