import { useState } from 'react'
import { Lightbulb, Plus, X } from 'lucide-react'
import { literatureReviewApi, type ScopeInput } from '../../api/literatureReview'
import {
  cleanList, errorMessage, LEVEL_LABELS, REVIEW_TYPE_HINTS, REVIEW_TYPE_LABELS, STYLE_LABELS,
  type Review, type ReviewOptions, type ScopeAdvice,
} from '../../lib/literatureReview'
import { Notice, Panel } from './ui'
import { btn, inputClass } from './styles'

const ASSESSMENT: Record<ScopeAdvice['assessment'], string> = {
  Clear: 'Your question is clear enough to search.',
  Vague: 'Your question is a little vague.',
  TooBroad: 'Your question may be too broad for one review.',
  TooNarrow: 'Your question may be too narrow to find enough studies.',
}

/** Step 1: the question and scope. Saving moves the review on; nothing here costs credits except suggestions. */
export function ScopeStep({ review, options, onSaved, onNext }: {
  review: Review; options: ReviewOptions; onSaved: (r: Review) => void; onNext: () => void
}) {
  const [form, setForm] = useState({
    question: review.question, title: review.title, reviewType: review.reviewType, academicLevel: review.academicLevel,
    discipline: review.discipline ?? '', citationStyle: review.citationStyle, targetWords: String(review.targetWords),
    yearFrom: review.yearFrom ? String(review.yearFrom) : '', yearTo: review.yearTo ? String(review.yearTo) : '',
  })
  const [include, setInclude] = useState<string[]>(review.criteria.include)
  const [exclude, setExclude] = useState<string[]>(review.criteria.exclude)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advice, setAdvice] = useState<ScopeAdvice | null>(null)
  const [adviceBusy, setAdviceBusy] = useState(false)
  const [adviceError, setAdviceError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async (andNext: boolean) => {
    setBusy(true)
    setError(null)
    const input: ScopeInput = {
      question: form.question, title: form.title, reviewType: form.reviewType, academicLevel: form.academicLevel, discipline: form.discipline,
      citationStyle: form.citationStyle, targetWords: Number(form.targetWords) || undefined,
      yearFrom: form.yearFrom ? Number(form.yearFrom) : undefined, yearTo: form.yearTo ? Number(form.yearTo) : undefined,
      clearYearFrom: !form.yearFrom, clearYearTo: !form.yearTo,
      criteria: { include: cleanList(include), exclude: cleanList(exclude) }, revision: review.revision,
      currentStep: andNext ? Math.max(review.currentStep, 1) : undefined,
    }
    try {
      const saved = await literatureReviewApi.update(review.id, input)
      onSaved(saved)
      if (andNext) onNext()
    } catch (err) {
      setError(errorMessage(err, 'Your changes could not be saved. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const suggest = async () => {
    setAdviceBusy(true)
    setAdviceError(null)
    try {
      // Suggestions are made on the saved question, so save first.
      if (form.question.trim() !== review.question) await save(false)
      setAdvice(await literatureReviewApi.suggestScope(review.id))
    } catch (err) {
      setAdviceError(errorMessage(err, 'Suggestions are not available right now.'))
    } finally {
      setAdviceBusy(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="What is the review about?" id="lr-scope">
        <form onSubmit={e => { e.preventDefault(); void save(true) }} className="space-y-4" noValidate>
          <div>
            <label htmlFor="lr-question" className="block text-[14px] font-medium text-slate-900">Research question or topic</label>
            <textarea id="lr-question" rows={3} value={form.question} onChange={set('question')} maxLength={1000} className={inputClass + ' mt-1'} />
          </div>
          <div>
            <label htmlFor="lr-title" className="block text-[14px] font-medium text-slate-900">Title</label>
            <input id="lr-title" value={form.title} onChange={set('title')} maxLength={200} className={inputClass + ' mt-1'} />
          </div>

          <fieldset>
            <legend className="text-[14px] font-medium text-slate-900">Type of review</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {options.reviewTypes.map(t => (
                <label key={t} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-[13px] has-[:checked]:border-purple-accent has-[:checked]:bg-purple-tint/40">
                  <input type="radio" name="lr-type" value={t} checked={form.reviewType === t} onChange={set('reviewType')} className="mt-0.5" />
                  <span><span className="font-semibold text-slate-900">{REVIEW_TYPE_LABELS[t] ?? t}</span><span className="block text-slate-700">{REVIEW_TYPE_HINTS[t]}</span></span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-slate-600">For a formal systematic review with PRISMA and risk of bias, use Systematic Review instead.</p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lr-level" className="block text-[14px] font-medium text-slate-900">Academic level</label>
              <select id="lr-level" value={form.academicLevel} onChange={set('academicLevel')} className={inputClass + ' mt-1'}>
                {options.academicLevels.map(l => <option key={l} value={l}>{LEVEL_LABELS[l] ?? l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lr-discipline" className="block text-[14px] font-medium text-slate-900">Subject area <span className="font-normal text-slate-600">(optional)</span></label>
              <input id="lr-discipline" value={form.discipline} onChange={set('discipline')} maxLength={120} placeholder="For example: public health" className={inputClass + ' mt-1'} />
            </div>
            <div>
              <label htmlFor="lr-style" className="block text-[14px] font-medium text-slate-900">Citation style</label>
              <select id="lr-style" value={form.citationStyle} onChange={set('citationStyle')} className={inputClass + ' mt-1'}>
                {options.citationStyles.map(s => <option key={s} value={s}>{STYLE_LABELS[s] ?? s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lr-words" className="block text-[14px] font-medium text-slate-900">Target length (words)</label>
              <input id="lr-words" type="number" inputMode="numeric" min={options.minTargetWords} max={options.maxTargetWords} step={250} value={form.targetWords} onChange={set('targetWords')} className={inputClass + ' mt-1'} />
            </div>
            <div>
              <label htmlFor="lr-from" className="block text-[14px] font-medium text-slate-900">Published from <span className="font-normal text-slate-600">(year, optional)</span></label>
              <input id="lr-from" type="number" inputMode="numeric" value={form.yearFrom} onChange={set('yearFrom')} className={inputClass + ' mt-1'} />
            </div>
            <div>
              <label htmlFor="lr-to" className="block text-[14px] font-medium text-slate-900">Published to <span className="font-normal text-slate-600">(year, optional)</span></label>
              <input id="lr-to" type="number" inputMode="numeric" value={form.yearTo} onChange={set('yearTo')} className={inputClass + ' mt-1'} />
            </div>
          </div>

          <CriteriaList id="lr-include" label="Include studies that…" items={include} onChange={setInclude} placeholder="For example: participants aged 13 to 18" />
          <CriteriaList id="lr-exclude" label="Exclude studies that…" items={exclude} onChange={setExclude} placeholder="For example: opinion pieces" />

          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={btn.primary}>{busy ? 'Saving…' : 'Save and continue to sources'}</button>
            <button type="button" disabled={busy} onClick={() => void save(false)} className={btn.secondary}>Save</button>
          </div>
        </form>
      </Panel>

      <Panel title="Sharpen the question" description="Optional. One quick suggestion; you decide what to use." id="lr-advice">
        <button type="button" onClick={() => void suggest()} disabled={adviceBusy} className={btn.secondary}>
          <Lightbulb size={16} aria-hidden /> {adviceBusy ? 'Thinking…' : 'Suggest improvements'}
        </button>
        {adviceError ? <div className="mt-3"><Notice tone="error">{adviceError}</Notice></div> : null}
        {advice ? (
          <div className="mt-3 space-y-3 text-[13px] text-slate-800" aria-live="polite">
            <p className="font-medium text-slate-900">{ASSESSMENT[advice.assessment]}</p>
            {advice.issues.length > 0 ? <ul className="list-disc space-y-1 pl-5">{advice.issues.map(i => <li key={i}>{i}</li>)}</ul> : null}
            {advice.suggestedQuestions.map(q => (
              <div key={q} className="rounded-lg border border-slate-200 p-2.5">
                <p>{q}</p>
                <button type="button" className={btn.link + ' mt-1 text-[13px]'} onClick={() => setForm(f => ({ ...f, question: q }))}>Use this question</button>
              </div>
            ))}
            {advice.keyConcepts.length > 0 ? <p><span className="font-medium">Search concepts:</span> {advice.keyConcepts.join(', ')}</p> : null}
          </div>
        ) : null}
      </Panel>
    </div>
  )
}

function CriteriaList({ id, label, items, onChange, placeholder }: { id: string; label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = () => { if (draft.trim()) { onChange(cleanList([...items, draft])); setDraft('') } }
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-medium text-slate-900">{label} <span className="font-normal text-slate-600">(optional)</span></label>
      {items.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map(item => (
            <li key={item} className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-slate-50 py-0.5 pl-2.5 pr-1 text-[13px] text-slate-900">
              <span className="[overflow-wrap:anywhere]">{item}</span>
              <button type="button" onClick={() => onChange(items.filter(i => i !== item))} aria-label={`Remove "${item}"`} className="rounded-full p-0.5 hover:bg-slate-200"><X size={12} aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-1.5 flex gap-2">
        <input id={id} value={draft} maxLength={300} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder={placeholder} className={inputClass} />
        <button type="button" onClick={add} className={btn.secondary} aria-label={`Add to "${label}"`}><Plus size={16} aria-hidden /></button>
      </div>
    </div>
  )
}
