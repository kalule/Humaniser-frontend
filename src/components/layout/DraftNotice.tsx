import { AlertTriangle } from 'lucide-react'

export function DraftNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-8">
      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 leading-relaxed">
        <strong className="text-amber-900">Draft — pending legal review.</strong> This page reflects our
        current practices in plain language but has not yet been finalised by legal counsel. Do not treat it
        as a binding legal document until this notice is removed.
      </p>
    </div>
  )
}
