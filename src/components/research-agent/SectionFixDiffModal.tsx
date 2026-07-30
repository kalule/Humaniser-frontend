import { Check, Loader2, Sparkles, X } from 'lucide-react'
import type { SectionFixPreview } from '../../types/research'

interface SectionFixDiffModalProps {
  preview:      SectionFixPreview
  isConfirming: boolean
  onAccept:     () => void
  onCancel:     () => void
}

type DiffToken = { text: string; type: 'same' | 'added' | 'removed' }

// Word-level LCS diff — no new dependency for a section-length (a few hundred words) diff.
// Whitespace runs are kept as their own tokens (not collapsed) so rejoined text reads exactly
// like the source, and are treated as ordinary tokens by the LCS so unchanged spacing/newlines
// never render as a spurious add/remove pair.
function diffWords(original: string, proposed: string): DiffToken[] {
  const tokenize = (s: string) => s.split(/(\s+)/).filter(t => t.length > 0)
  const a = tokenize(original)
  const b = tokenize(proposed)
  const n = a.length
  const m = b.length

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const tokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i], type: 'same' })
      i++; j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ text: a[i], type: 'removed' })
      i++
    } else {
      tokens.push({ text: b[j], type: 'added' })
      j++
    }
  }
  while (i < n) { tokens.push({ text: a[i], type: 'removed' }); i++ }
  while (j < m) { tokens.push({ text: b[j], type: 'added' }); j++ }

  return tokens
}

// This app's first "AI proposes a rewrite, student reviews a diff, accepts or rejects" pattern
// (FactConflictsPanel/ExternalFactsReviewPanel are pick-a-value, not review-a-rewrite) — see the
// Apply Fix investigation's finding that no such pattern existed yet.
export function SectionFixDiffModal({ preview, isConfirming, onAccept, onCancel }: SectionFixDiffModalProps) {
  const tokens = diffWords(preview.originalContent, preview.proposedContent)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-6 pt-6 pb-3 border-b border-slate-100">
          <Sparkles size={18} className="text-[#7c3aed] shrink-0" />
          <h3 className="text-[15px] font-bold text-slate-800">
            Review fix — section {preview.sectionCode}
          </h3>
        </div>

        <div className="flex items-center gap-4 px-6 py-2 text-[11px] text-slate-500 border-b border-slate-100">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200" /> Added</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-200" /> Removed</span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">
            {tokens.map((token, i) => {
              if (token.type === 'same') return <span key={i}>{token.text}</span>
              if (token.type === 'added') {
                return <span key={i} className="bg-emerald-100 text-emerald-800 rounded-sm">{token.text}</span>
              }
              return (
                <span key={i} className="bg-red-100 text-red-700 line-through decoration-red-400 rounded-sm">
                  {token.text}
                </span>
              )
            })}
          </p>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <X size={13} /> Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={isConfirming}
            className="flex-1 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold transition-colors shadow-md shadow-[#7c3aed]/20 flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {isConfirming ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
