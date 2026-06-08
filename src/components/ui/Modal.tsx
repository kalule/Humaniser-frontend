import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

// Collect all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled'))
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap
      if (e.key === 'Tab' && panelRef.current != null) {
        const focusable = getFocusableElements(panelRef.current)
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Move focus into modal when opened
  useEffect(() => {
    if (isOpen && panelRef.current != null) {
      const focusable = getFocusableElements(panelRef.current)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        panelRef.current.focus()
      }
    }
  }, [isOpen])

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="modal-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title != null ? 'modal-title' : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className={cn(
              'relative z-10 w-full bg-card border border-border rounded-lg shadow-elevated',
              'focus:outline-none',
              sizeClasses[size],
            )}
          >
            {/* Header */}
            {title != null && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-text-main"
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-muted hover:text-text-main transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm p-0.5"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Close button when no title */}
            {title == null && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 text-muted hover:text-text-main transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm p-0.5"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}

            {/* Body */}
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
