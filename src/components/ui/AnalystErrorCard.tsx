import { X, ServerCrash, Clock, WifiOff, FlaskConical } from 'lucide-react'
import type { ApiErrorKind } from '../../lib/classifyApiError'

interface Props {
  message: string
  kind?: ApiErrorKind
}

const CONFIG: Record<ApiErrorKind, {
  icon: React.ElementType
  heading: string
  borderCls: string
  bgCls: string
  iconCls: string
  headingCls: string
}> = {
  offline: {
    icon: ServerCrash,
    heading: 'Analysis service offline',
    borderCls: 'border-red-500/20',
    bgCls:     'bg-red-500/10',
    iconCls:   'text-red-400',
    headingCls:'text-red-300',
  },
  sandbox_offline: {
    icon: FlaskConical,
    heading: 'Execution sandbox offline',
    borderCls: 'border-orange-500/20',
    bgCls:     'bg-orange-500/10',
    iconCls:   'text-orange-400',
    headingCls:'text-orange-300',
  },
  timeout: {
    icon: Clock,
    heading: 'Taking too long',
    borderCls: 'border-amber-500/20',
    bgCls:     'bg-amber-500/10',
    iconCls:   'text-amber-400',
    headingCls:'text-amber-300',
  },
  rate_limit: {
    icon: WifiOff,
    heading: 'Rate limited',
    borderCls: 'border-violet-500/20',
    bgCls:     'bg-violet-500/10',
    iconCls:   'text-violet-400',
    headingCls:'text-violet-300',
  },
  generic: {
    icon: X,
    heading: 'Analysis failed',
    borderCls: 'border-red-500/15',
    bgCls:     'bg-transparent',
    iconCls:   'text-red-400',
    headingCls:'text-red-400',
  },
}

export function AnalystErrorCard({ message, kind = 'generic' }: Props) {
  const cfg = CONFIG[kind]
  const Icon = cfg.icon

  if (kind === 'generic') {
    return (
      <div className="flex items-center gap-2 text-red-400 text-[13px]">
        <X size={13} />
        {message}
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/70 border ${cfg.borderCls} max-w-sm`}>
      <div className={`shrink-0 w-7 h-7 rounded-lg ${cfg.bgCls} border ${cfg.borderCls} flex items-center justify-center mt-0.5`}>
        <Icon size={13} className={cfg.iconCls} />
      </div>
      <div className="space-y-0.5">
        <p className={`text-[12px] font-semibold ${cfg.headingCls}`}>{cfg.heading}</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">{message}</p>
      </div>
    </div>
  )
}
