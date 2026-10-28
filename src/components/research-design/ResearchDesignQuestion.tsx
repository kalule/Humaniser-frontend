import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { DesignInputValue, DesignQuestion } from '../../types/researchDesign'

export function ResearchDesignQuestion({ question, busy, errorId, onSubmit }: { question: DesignQuestion; busy: boolean; errorId?: string; onSubmit: (value: DesignInputValue) => void }) {
  const [text, setText] = useState('')
  const [access, setAccess] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLDivElement>(null)
  useEffect(() => { inputRef.current?.querySelector<HTMLElement>('input, textarea, select')?.focus() }, [])
  const supported = question.answerable && ['Text', 'AccessConfirmation'].includes(question.valueType)
  const fields = [['populationAccess', 'Can you access the participants?'], ['dataAvailable', 'Can you obtain the data?'], ['permissionsResolved', 'Are the necessary permissions resolved?']] as const
  const valid = question.valueType === 'Text' ? text.trim().length > 0 : fields.every(([key]) => ['yes', 'no'].includes(access[key]))
  const description = ['question-reason', errorId].filter(Boolean).join(' ')
  // Older persisted runs used one combined prompt for two independently saved fields.
  // Correct its presentation without changing question IDs, payloads or saved answers.
  const legacyScopePrompt = question.question === 'Specify the research problem and eligible target population.'
  const heading = legacyScopePrompt && question.field === 'ResearchProblem'
    ? 'What specific research problem will your study address?'
    : legacyScopePrompt && question.field === 'TargetPopulation'
      ? 'What people, systems, artifacts or records will your study examine?'
      : question.question
  return <section ref={inputRef} className="space-y-4" aria-labelledby="question-heading">
    <h2 id="question-heading" className="text-lg font-semibold">{heading}</h2>
    {legacyScopePrompt && question.field === 'ResearchProblem' && <p className="text-sm">Your study target was saved separately. Enter only the research problem here.</p>}
    <p id="question-reason" className="text-sm text-text-secondary">Why we’re asking: {question.reason}</p>
    {!supported ? <p className="text-sm">This detail needs review in your research specification. Your answer cannot be submitted here yet.</p> : <form onSubmit={e => { e.preventDefault(); if (!valid || busy) return; onSubmit(question.valueType === 'Text' ? { text: text.trim() } : { populationAccess: access.populationAccess === 'yes', dataAvailable: access.dataAvailable === 'yes', permissionsResolved: access.permissionsResolved === 'yes' }) }} className="space-y-4">
      {question.valueType === 'Text' ? question.field === 'ResearchProblem' || question.field === 'SamplingRationale' ? <div><label className="text-sm font-medium" htmlFor="design-answer">Your answer</label><textarea id="design-answer" required maxLength={question.maxLength ?? 4000} value={text} onChange={e => setText(e.target.value)} disabled={busy} aria-describedby={description} className="mt-2 w-full min-h-32 border border-border rounded-md bg-card p-3 text-sm focus-visible:outline-primary" /></div> : <Input id="design-answer" label="Your answer" required maxLength={question.maxLength ?? 4000} value={text} onChange={e => setText(e.target.value)} disabled={busy} aria-describedby={description} /> : fields.map(([key, label]) => <div key={key}><label className="text-sm font-medium block mb-2" htmlFor={key}>{label}</label><select id={key} required disabled={busy} value={access[key] ?? ''} onChange={e => setAccess({ ...access, [key]: e.target.value })} aria-describedby={description} className="w-full border border-border rounded-md bg-card p-3 text-sm focus-visible:outline-primary"><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No</option></select></div>)}
      <Button type="submit" disabled={busy || !valid} isLoading={busy}>Continue</Button>
    </form>}
  </section>
}
