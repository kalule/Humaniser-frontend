import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Share2, ChevronDown, Sparkles, RefreshCw, SpellCheck, Scissors } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useToolTransferStore } from '../../store/toolTransferStore'

const DESTINATIONS = [
  { label: 'Voice Editor',  path: '/app/humaniser',  Icon: Sparkles  },
  { label: 'Paraphraser',   path: '/app/paraphrase', Icon: RefreshCw  },
  { label: 'Grammar',       path: '/app/grammar',    Icon: SpellCheck },
  { label: 'Summariser',    path: '/app/summarise',  Icon: Scissors   },
] as const

interface SendToMenuProps {
  text: string
  className?: string
}

export function SendToMenu({ text, className }: SendToMenuProps) {
  const [open, setOpen] = useState(false)
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
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors"
      >
        <Share2 size={12} />
        Send to
        <ChevronDown
          size={10}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          {destinations.map(({ label, path, Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => {
                setTransfer(text, pathname)
                navigate(path)
                setOpen(false)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Icon size={12} className="text-slate-500 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
