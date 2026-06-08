import { motion } from 'framer-motion'
import { Sparkles, Shield, RefreshCw, BookOpen, Scissors, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

export type WorkspaceTool = 'humanise' | 'detect'

interface ToolPill {
  id: WorkspaceTool | 'paraphrase' | 'plagiarism' | 'summarise' | 'more'
  label: string
  icon: React.ElementType
  soon?: boolean
  activeClass?: string
  ringClass?: string
}

const TOOLS: ToolPill[] = [
  {
    id: 'humanise',
    label: 'Humanise',
    icon: Sparkles,
    activeClass: 'bg-indigo-600 text-white',
    ringClass: 'ring-2 ring-indigo-500/30',
  },
  {
    id: 'detect',
    label: 'Detect AI',
    icon: Shield,
    activeClass: 'bg-emerald-600 text-white',
    ringClass: 'ring-2 ring-emerald-500/30',
  },
  { id: 'paraphrase', label: 'Paraphrase', icon: RefreshCw, soon: true },
  { id: 'plagiarism', label: 'Plagiarism', icon: BookOpen, soon: true },
  { id: 'summarise', label: 'Summarise', icon: Scissors, soon: true },
  { id: 'more', label: 'More', icon: Plus },
]

interface ToolActionBarProps {
  selected: WorkspaceTool | null
  onSelect: (tool: WorkspaceTool) => void
}

export function ToolActionBar({ selected, onSelect }: ToolActionBarProps) {
  const handleComingSoon = () => {
    toast('Coming in Phase 2 — join the waitlist to be notified', { icon: '🚀' })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center md:flex-nowrap overflow-x-auto pb-1">
      {TOOLS.map((tool, i) => {
        const isActive = selected === tool.id
        const isSoon = tool.soon
        const isMore = tool.id === 'more'

        return (
          <motion.button
            key={tool.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
            whileTap={!isSoon ? { scale: 0.97 } : undefined}
            onClick={() => {
              if (isSoon || isMore) {
                handleComingSoon()
              } else {
                onSelect(tool.id as WorkspaceTool)
              }
            }}
            disabled={false}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-all duration-150 shrink-0',
              isSoon || isMore
                ? 'opacity-50 cursor-default bg-slate-800 text-slate-400 border border-slate-700'
                : isActive
                  ? cn(tool.activeClass, tool.ringClass)
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-indigo-500/50 hover:text-white',
            )}
          >
            <tool.icon size={15} className="shrink-0" />
            {tool.label}
            {isSoon && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-400 rounded-full">
                Soon
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
