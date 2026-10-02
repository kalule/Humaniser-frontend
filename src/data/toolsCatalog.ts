import { Sparkles, Shield, RefreshCw, SpellCheck, Scissors, type LucideIcon } from 'lucide-react'

// Single source of truth for the five core Humaniser services — drives the
// homepage services grid, the features page, and the footer/nav links, so
// the product's public positioning can't drift out of sync across pages.

export interface PublicTool {
  icon: LucideIcon
  label: string
  desc: string
  longDesc: string
  to: string
  iconBg: string
  iconColor: string
}

export const PUBLIC_TOOLS: PublicTool[] = [
  {
    icon: Sparkles,
    label: 'AI Humaniser',
    desc: 'Make AI-generated text sound more natural, personal and human.',
    longDesc: 'Rewrite AI-generated text so it reads naturally human — adjustable strength and tone, with your original meaning kept intact.',
    to: '/app/humaniser',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-700',
  },
  {
    icon: Shield,
    label: 'AI Detector',
    desc: 'Check whether text is likely AI-generated, with a clear, easy-to-understand analysis.',
    longDesc: 'Scan text for signs of AI generation and get a sentence-level breakdown. AI detection is probabilistic, not a guarantee.',
    to: '/app/detector',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
  },
  {
    icon: RefreshCw,
    label: 'Paraphraser',
    desc: 'Rewrite sentences and paragraphs while keeping the original meaning.',
    longDesc: 'Rewrite sentences and paragraphs in different words while keeping your original meaning — useful for tightening prose or avoiding repetition.',
    to: '/app/paraphrase',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
  },
  {
    icon: SpellCheck,
    label: 'Grammar Checker',
    desc: 'Find grammar, spelling, punctuation and clarity issues in your writing.',
    longDesc: 'Catch grammar, spelling, punctuation, and clarity issues before you hit send — built for everyday and professional writing.',
    to: '/app/grammar',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
  {
    icon: Scissors,
    label: 'Summariser',
    desc: 'Turn long text into concise summaries that keep the important ideas.',
    longDesc: 'Condense long documents, articles, or reports down to the key points in seconds, without losing what matters.',
    to: '/app/summarise',
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-700',
  },
]

export const PUBLIC_TOOL_COUNT = PUBLIC_TOOLS.length
