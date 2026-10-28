import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

export const QUESTION_PREFIX = 'Research question:'
const MIN_CHARS = 10
const MAX_CHARS = 400

/** "Research question: X" (how the topic stores it) → "X". */
export const questionFromDescription = (description: string): string =>
  description.replace(/^\s*Research question:\s*/i, '').trim()

export const isValidQuestion = (q: string): boolean => q.trim().length >= MIN_CHARS && q.trim().length <= MAX_CHARS

interface Props {
  question: string
  /** The gap the question answers, shown for context. */
  gap: string
  /** Persist the edited question; resolves when saved. Titles are regenerated from it. */
  onSave: (question: string) => Promise<void> | void
}

/**
 * Topic → gap → research question → title. After choosing a gap the student can refine the research
 * question here, before titles are generated from it.
 */
export function GapQuestionEditor({ question, gap, onSave }: Props) {
  const [value, setValue] = useState(question)
  const [saving, setSaving] = useState(false)
  const dirty = value.trim() !== question.trim()

  const save = async () => {
    if (!dirty || !isValidQuestion(value)) return
    setSaving(true)
    try { await onSave(value.trim()) } finally { setSaving(false) }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {gap && <p className="text-[12px] text-slate-600 leading-relaxed mb-3">{gap}</p>}
      <label htmlFor="gap-research-question" className="block text-[12px] font-semibold text-slate-700 mb-1">
        Your research question
      </label>
      <p className="text-[11px] text-slate-500 mb-2">What will your study investigate to address this? Your title is built from it.</p>
      <textarea
        id="gap-research-question"
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={3}
        maxLength={MAX_CHARS}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 bg-white outline-none focus:border-purple-accent resize-none"
      />
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || !isValidQuestion(value) || saving}
          className="px-3 py-1.5 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save question
        </button>
        {dirty && !isValidQuestion(value) && <span className="text-[11px] text-amber-text">Use {MIN_CHARS} to {MAX_CHARS} characters.</span>}
        {!dirty && <span className="text-[11px] text-slate-400">Saved</span>}
      </div>
    </div>
  )
}
