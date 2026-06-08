import { motion } from 'framer-motion'
import { Sparkles, Shield, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { WorkspaceTool } from './ToolActionBar'
import toast from 'react-hot-toast'

interface SuggestionCard {
  icon: React.ElementType
  iconColor: string
  title: string
  description: string
  action: () => void
}

interface SuggestionCardsProps {
  onSelectTool: (tool: WorkspaceTool) => void
  onFocusInput: () => void
}

export function SuggestionCards({ onSelectTool, onFocusInput }: SuggestionCardsProps) {
  const cards: SuggestionCard[] = [
    {
      icon: Sparkles,
      iconColor: 'text-indigo-400',
      title: 'Humanise my essay',
      description: 'Remove AI patterns from academic or professional writing',
      action: () => {
        onSelectTool('humanise')
        onFocusInput()
      },
    },
    {
      icon: Shield,
      iconColor: 'text-emerald-400',
      title: 'Check for AI writing',
      description: 'Get an instant human score on any text',
      action: () => {
        onSelectTool('detect')
        onFocusInput()
      },
    },
    {
      icon: Zap,
      iconColor: 'text-amber-400',
      title: 'Rewrite more clearly',
      description: 'Simplify complex text for any audience',
      action: () => {
        toast('Paraphraser coming in Phase 2', { icon: '🚀' })
      },
    },
  ]

  return (
    <div>
      <p className="text-xs text-slate-500 text-center mb-3">Need an idea? Try one of these...</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <motion.button
            key={card.title}
            type="button"
            onClick={card.action}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.2 }}
            className={cn(
              'group text-left bg-slate-800/50 hover:bg-slate-800',
              'border border-slate-700 hover:border-indigo-500/30',
              'rounded-xl p-4 cursor-pointer transition-all duration-150',
            )}
          >
            <card.icon
              size={20}
              className={cn(
                card.iconColor,
                'mb-2 transition-transform duration-150 group-hover:scale-110',
              )}
            />
            <p className="text-sm font-semibold text-slate-200 group-hover:text-white mb-1 transition-colors">
              {card.title}
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">{card.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
