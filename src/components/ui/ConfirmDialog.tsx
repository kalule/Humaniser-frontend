import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { cn } from '../../lib/utils'

// The in-app replacement for window.confirm(), which shows an unbranded "localhost says" browser prompt.

export type ConfirmTone = 'default' | 'warning' | 'danger'

export interface ConfirmOptions {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

const toneStyles: Record<ConfirmTone, { icon: React.ElementType; iconWrap: string; button: string }> = {
  default: {
    icon: Info,
    iconWrap: 'bg-purple-50 text-purple-600 ring-purple-100',
    button: 'bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500/40',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-50 text-amber-600 ring-amber-100',
    button: 'bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500/40',
  },
  danger: {
    icon: Trash2,
    iconWrap: 'bg-red-50 text-red-600 ring-red-100',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/40',
  },
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen, onConfirm, onCancel, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default',
}: ConfirmDialogProps) {
  const style = toneStyles[tone]
  const Icon = style.icon

  // Escape cancels only this dialog. It is caught on window in the capture phase so a drawer or dialog underneath,
  // which listens on document, does not close as well.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isOpen, onCancel])
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="md"
      showCloseButton={false}
      panelClassName="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
      bodyClassName=""
    >
      <div role="alertdialog" aria-labelledby="confirm-dialog-title" aria-describedby={message ? 'confirm-dialog-message' : undefined}>
        <div className="flex gap-4 px-6 pt-6 pb-5">
          <div className={cn('shrink-0 w-10 h-10 rounded-full flex items-center justify-center ring-4', style.iconWrap)}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-[16px] font-semibold text-slate-900 leading-snug">{title}</h2>
            {message && (
              <div id="confirm-dialog-message" className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{message}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn('h-9 px-4 rounded-lg text-[13px] font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2', style.button)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Promise-based confirm: `if (!(await confirm({ title: '…' }))) return`. Render `dialog` once in the component.
 * The last options are kept after closing so the exit animation does not show an empty panel.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' })
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false)
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>(resolve => { resolver.current = resolve })
  }, [])

  const onConfirm = useCallback(() => settle(true), [settle])
  const onCancel = useCallback(() => settle(false), [settle])

  const dialog = <ConfirmDialog {...options} isOpen={open} onConfirm={onConfirm} onCancel={onCancel} />
  return { confirm, dialog }
}
