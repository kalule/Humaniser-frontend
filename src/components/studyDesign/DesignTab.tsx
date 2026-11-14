import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { studyDesignApi, type DesignAdviceResponse, type DesignAdvisorInput } from '../../api/studyDesign'
import { designLabel, fieldErrors, splitLines, whereLabel, type ApiFieldError } from '../../lib/studyDesign'
import { cn } from '../../lib/utils'

const inputClass = 'w-full rounded-lg border bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30'
const DEGREE_LEVELS = ['Undergraduate', 'Honours', 'Masters', 'Doctoral']

interface Fields { title: string; questions: string; objectives: string; hypotheses: string; discipline: string; degreeLevel: string; statedDesign: string; reachable: string }
const blank: Fields = { title: '', questions: '', objectives: '', hypotheses: '', discipline: '', degreeLevel: '', statedDesign: '', reachable: '' }
interface ApiFailure { code?: string; message?: string; details?: ApiFieldError[]; response?: { status?: number } }

const fromInput = (i: DesignAdvisorInput): Fields => ({
  title: i.title ?? '', questions: (i.questions ?? []).join('\n'), objectives: (i.objectives ?? []).join('\n'), hypotheses: (i.hypotheses ?? []).join('\n'),
  discipline: i.discipline ?? '', degreeLevel: i.degreeLevel ?? '', statedDesign: i.statedDesign ?? '', reachable: i.reachableParticipants ? String(i.reachableParticipants) : '',
})

/**
 * Design tab: the student describes the study and gets a recommended design, the strongest alternative, wording that
 * does not fit the design, and caveats. Everything shown comes from the server, which has already checked the
 * advisor's answer; this component adds no advice of its own and never changes the project.
 */
export function DesignTab({ projectId, projectTitle, credits, designs }: { projectId: string; projectTitle: string | null; credits: number; designs: Record<string, string> }) {
  const uid = useId()
  const fid = (key: string) => `${uid}-${key}`
  const [fields, setFields] = useState<Fields>(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DesignAdviceResponse | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLElement>(null)

  // With a project: start from the project's own details and show its last advice. Typed text is never overwritten.
  useEffect(() => {
    if (!projectId) { setLoadedFrom(null); setResult(r => (r?.projectId ? null : r)); return }
    let cancelled = false
    studyDesignApi.adviceInputs(projectId).then(input => {
      if (cancelled) return
      setFields(current => (Object.values(current).some(v => v.trim() !== '') ? current : fromInput(input)))
      setLoadedFrom(projectId)
    }).catch(() => { if (!cancelled) setLoadedFrom(null) })
    studyDesignApi.latestAdvice(projectId).then(latest => { if (!cancelled) { setResult(latest); setDirty(false) } }).catch(() => undefined)
    return () => { cancelled = true }
  }, [projectId])

  const set = (patch: Partial<Fields>) => { setFields(f => ({ ...f, ...patch })); setDirty(true) }

  const submit = async () => {
    setBusy(true); setErrors({}); setFailure(null)
    const reachable = fields.reachable.trim() === '' ? undefined : Number(fields.reachable.replace(/\s/g, ''))
    if (reachable !== undefined && !Number.isInteger(reachable)) {
      setErrors({ reachableParticipants: 'Enter a whole number, or leave this blank.' }); setBusy(false)
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    try {
      const response = await studyDesignApi.advise({
        projectId: projectId || undefined, title: fields.title.trim(), questions: splitLines(fields.questions), objectives: splitLines(fields.objectives),
        hypotheses: splitLines(fields.hypotheses), discipline: fields.discipline.trim(), degreeLevel: fields.degreeLevel, statedDesign: fields.statedDesign, reachableParticipants: reachable,
      })
      setResult(response); setDirty(false)
      requestAnimationFrame(() => resultRef.current?.focus())
    } catch (err) {
      const e = err as ApiFailure
      if (e?.code === 'STUDY_DESIGN_VALIDATION') { setErrors(fieldErrors(e.details)); requestAnimationFrame(() => summaryRef.current?.focus()) }
      else if (e?.response?.status === 402) setFailure('You do not have enough credits for design advice. Nothing was charged.')
      else if (e?.response?.status === 429 || e?.code === 'STUDY_DESIGN_LIMIT_REACHED') setFailure("You have reached today's limit for design advice. Try again tomorrow.")
      else if (e?.code === 'STUDY_DESIGN_ADVISOR_DISABLED' || e?.code === 'STUDY_DESIGN_DISABLED') setFailure('The design advisor is not switched on for your account.')
      else if (e?.code === 'STUDY_DESIGN_NOT_FOUND') setFailure('That project could not be found. It may have been deleted.')
      else setFailure('The advice could not be fetched. Check your connection and try again. If credits were held, they are released.')
    } finally { setBusy(false) }
  }

  const errorList = Object.entries(errors)
  const area = (key: keyof Fields, label: string, help: string, rows: number, errorKey: string = key, optional = false) => (
    <div>
      <label htmlFor={fid(errorKey)} className="mb-1 block text-[13px] font-medium text-slate-800">{label}{optional ? <span className="font-normal text-slate-600"> (optional)</span> : null}</label>
      <textarea id={fid(errorKey)} rows={rows} value={fields[key]} onChange={e => set({ [key]: e.target.value } as Partial<Fields>)} aria-describedby={`${fid(errorKey)}-help${errors[errorKey] ? ` ${fid(errorKey)}-error` : ''}`}
        aria-invalid={!!errors[errorKey]} className={cn(inputClass, errors[errorKey] ? 'border-red-600' : 'border-slate-300')} />
      <p id={`${fid(errorKey)}-help`} className="mt-1 text-[12px] leading-snug text-slate-600">{help}</p>
      {errors[errorKey] ? <p id={`${fid(errorKey)}-error`} className="mt-1 flex items-start gap-1 text-[13px] font-medium text-red-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{errors[errorKey]}</p> : null}
    </div>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form noValidate onSubmit={e => { e.preventDefault(); void submit() }} aria-label="Study description" className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Describe your study</h2>
          <p className="mt-0.5 text-[13px] text-slate-600">Use your own wording, exactly as it appears in your proposal. The advice quotes it back to you.</p>
          {loadedFrom && projectTitle ? <p className="mt-1 flex items-start gap-1.5 text-[13px] text-slate-700"><Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Started from your project&apos;s details. Edit anything here; your project is not changed.</p> : null}
        </div>
        {area('title', 'Title', 'Up to 300 characters.', 3)}
        {area('questions', 'Research questions', 'One per line. Up to 10.', 4)}
        {area('objectives', 'Objectives', 'One per line. Up to 10.', 4)}
        {area('hypotheses', 'Hypotheses', 'One per line.', 3, 'hypotheses', true)}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={fid('discipline')} className="mb-1 block text-[13px] font-medium text-slate-800">Discipline <span className="font-normal text-slate-600">(optional)</span></label>
            <input id={fid('discipline')} value={fields.discipline} maxLength={100} onChange={e => set({ discipline: e.target.value })} aria-invalid={!!errors.discipline} className={cn(inputClass, errors.discipline ? 'border-red-600' : 'border-slate-300')} />
          </div>
          <div>
            <label htmlFor={fid('degreeLevel')} className="mb-1 block text-[13px] font-medium text-slate-800">Degree level <span className="font-normal text-slate-600">(optional)</span></label>
            <select id={fid('degreeLevel')} value={fields.degreeLevel} onChange={e => set({ degreeLevel: e.target.value })} className={cn(inputClass, 'border-slate-300')}>
              <option value="">Choose…</option>
              {DEGREE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              {fields.degreeLevel && !DEGREE_LEVELS.includes(fields.degreeLevel) ? <option value={fields.degreeLevel}>{fields.degreeLevel}</option> : null}
            </select>
          </div>
          <div>
            <label htmlFor={fid('statedDesign')} className="mb-1 block text-[13px] font-medium text-slate-800">Design you have in mind <span className="font-normal text-slate-600">(optional)</span></label>
            <select id={fid('statedDesign')} value={fields.statedDesign} onChange={e => set({ statedDesign: e.target.value })} aria-describedby={`${fid('statedDesign')}-help`} aria-invalid={!!errors.statedDesign}
              className={cn(inputClass, errors.statedDesign ? 'border-red-600' : 'border-slate-300')}>
              <option value="">Not decided yet</option>
              {Object.entries(designs).map(([design, family]) => <option key={design} value={design}>{designLabel(design)} ({family.toLowerCase()})</option>)}
            </select>
            <p id={`${fid('statedDesign')}-help`} className="mt-1 text-[12px] text-slate-600">Your wording is checked against this design as well as the recommended one.</p>
          </div>
          <div>
            <label htmlFor={fid('reachableParticipants')} className="mb-1 block text-[13px] font-medium text-slate-800">People you can reach <span className="font-normal text-slate-600">(optional)</span></label>
            <input id={fid('reachableParticipants')} inputMode="numeric" value={fields.reachable} onChange={e => set({ reachable: e.target.value })} aria-describedby={`${fid('reachableParticipants')}-help`} aria-invalid={!!errors.reachableParticipants}
              className={cn(inputClass, errors.reachableParticipants ? 'border-red-600' : 'border-slate-300')} />
            <p id={`${fid('reachableParticipants')}-help`} className="mt-1 text-[12px] text-slate-600">Compared with your project&apos;s saved sample-size calculation, if it has one.</p>
            {errors.reachableParticipants ? <p className="mt-1 text-[13px] font-medium text-red-700">{errors.reachableParticipants}</p> : null}
          </div>
        </div>

        {errorList.length > 0 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-400">
            <p className="font-semibold">No advice was requested and nothing was charged.</p>
            <ul className="mt-1 list-disc pl-5">{errorList.map(([key, message]) => <li key={key}><a href={`#${fid(key)}`} className="underline" onClick={e => { e.preventDefault(); document.getElementById(fid(key))?.focus() }}>{message}</a></li>)}</ul>
          </div>
        ) : null}
        {failure ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] font-medium text-red-800">{failure}</p> : null}

        <div className="border-t border-slate-200 pt-4">
          <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-purple-accent px-4 text-[14px] font-semibold text-white hover:bg-purple-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Getting advice…' : `Get design advice (${credits} credits)`}
          </button>
          <p className="mt-2 text-[12px] leading-snug text-slate-600">You are charged only if the advisor&apos;s answer passes our checks. Otherwise you get the rule-based checks and pay nothing. The advisor never names instruments, authors or figures, and never changes your project.</p>
        </div>
      </form>

      <section ref={resultRef} tabIndex={-1} aria-live="polite" aria-label="Design advice" className="rounded-xl border border-slate-200 p-4 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
        {busy ? <p className="text-[14px] text-slate-700">Getting advice. This usually takes a few seconds…</p> : null}
        {!busy && !result ? (
          <div className="py-8 text-center">
            <p className="text-[15px] font-semibold text-slate-900">No advice yet</p>
            <p className="mt-1 text-[13px] text-slate-600">Describe your study and choose Get design advice. You will see a recommended design, the strongest alternative, and any wording that does not fit.</p>
          </div>
        ) : null}
        {!busy && result ? <AdviceView response={result} dirty={dirty} projectId={projectId} /> : null}
      </section>
    </div>
  )
}

function AdviceView({ response, dirty, projectId }: { response: DesignAdviceResponse; dirty: boolean; projectId: string }) {
  const a = response.advice
  return (
    <div className="space-y-4">
      {dirty ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span>You have changed the description since this advice was given. Ask again to update it.</span>
        </p>
      ) : null}
      {a.notice ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span><strong>Rule-based checks only.</strong> {a.notice}</span>
        </p>
      ) : null}
      <p className="text-[12px] text-slate-600">
        {new Date(response.createdAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        {' · '}{response.creditsCharged > 0 ? `${response.creditsCharged} credits used` : 'No credits used'}{response.id ? ' · saved with your project' : ' · not saved'}
      </p>

      {a.recommended ? (
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-600">Recommended design</h3>
          <p className="mt-1 text-xl font-semibold text-slate-900">{designLabel(a.recommended.design)} <span className="text-[14px] font-normal text-slate-700">({a.recommended.family.toLowerCase()})</span></p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-slate-800">{a.recommended.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {a.recommended.fitsQuestionIds.length > 0 ? <p className="mt-2 text-[13px] text-slate-700">Answers research question{a.recommended.fitsQuestionIds.length > 1 ? 's' : ''} {a.recommended.fitsQuestionIds.join(', ')}.</p> : null}
        </div>
      ) : null}

      {a.strongestAlternative ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-[13px] font-semibold text-slate-900">Strongest alternative: {designLabel(a.strongestAlternative.design)}</h3>
          <p className="mt-1 text-[13px] text-slate-800"><span className="font-medium">When it would be better:</span> {a.strongestAlternative.whenItWouldBeBetter}</p>
          <p className="mt-1 text-[13px] text-slate-800"><span className="font-medium">What it costs:</span> {a.strongestAlternative.whatItCosts}</p>
        </div>
      ) : null}

      <div>
        <h3 className="text-[15px] font-semibold text-slate-900">Wording that does not fit the design</h3>
        {a.mismatches.length === 0 ? <p className="mt-1 text-[13px] text-slate-700">None found. This checks wording only; it does not judge whether the design is right for your field.</p> : (
          <ul className="mt-2 space-y-2">
            {a.mismatches.map((m, i) => (
              <li key={i} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-950">
                <p className="flex flex-wrap items-center gap-2 font-semibold"><AlertTriangle size={14} aria-hidden="true" />{whereLabel(m.where)}
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">{m.origin === 'rule' ? 'Rule check' : 'Advisor'}</span></p>
                {m.quotedPhrase ? <p className="mt-1">You wrote: <q className="font-medium">{m.quotedPhrase}</q></p> : null}
                <p className="mt-1">{m.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {a.caveats.length > 0 ? (
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">What this design cannot do</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-slate-800">{a.caveats.map(c => <li key={c.code}>{c.text}</li>)}</ul>
        </div>
      ) : null}
      {a.questionsForStudent.length > 0 ? (
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">Questions to settle with your supervisor</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-slate-800">{a.questionsForStudent.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      ) : null}
      {a.notCovered.length > 0 ? (
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">Not covered by this advice</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-slate-800">{a.notCovered.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      ) : null}

      <p className="border-t border-slate-200 pt-3 text-[12px] leading-snug text-slate-600">
        Advice, not a decision. It is based only on what you typed and has not been checked by a methodologist. Study Design does not change your project
        {projectId ? <>; to adopt a design, confirm it in your <Link to={`/app/research-agent/${projectId}`} className="font-medium text-purple-deep underline">project&apos;s methodology step</Link>.</> : '.'}
      </p>
    </div>
  )
}
