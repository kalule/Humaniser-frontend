import { AlertTriangle, CheckCircle2, Circle, Info, Loader2, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { label, type LabelKind, type Tone } from '../../lib/researchLabels'

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-green-tint text-green-text',
  warning: 'bg-amber-50 text-amber-800',
  danger:  'bg-red-50 text-red-700',
  info:    'bg-purple-tint text-purple-text',
  neutral: 'bg-slate-100 text-slate-700',
}

const TONE_ICON: Record<Tone, typeof Circle> = {
  success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: Info, neutral: Circle,
}

/** A status as words, colour and icon — never the raw enum. A running state spins. */
export function StatusChip({ kind, value, className }: { kind: LabelKind; value: string | null | undefined; className?: string }) {
  const { text, tone } = label(kind, value)
  const running = kind === 'sessionStatus' && (value === 'Running' || value === 'Queued' || value === 'Created')
  const Icon = running ? Loader2 : TONE_ICON[tone]
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium', TONE_CLASS[tone], className)}>
      <Icon size={12} aria-hidden className={cn('shrink-0', running && 'animate-spin')} />
      <span className="truncate">{text}</span>
    </span>
  )
}
