import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Info, Plus, Star, Trash2 } from 'lucide-react'
import { studyDesignApi, type AppliedFact, type StoredCalculation } from '../../api/studyDesign'
import {
  BASIS_OPTIONS, CALCULATORS, GROUP_LABELS, asPercentHint, buildRequest, calculatorById, emptyAdjustments, errorSummaryText, fieldErrors, headline, inputRows, percent,
  type AdjustmentValues, type ApiFieldError, type CalculationResult, type CalculatorDef, type CalculatorId, type EffectBasis, type FormState,
} from '../../lib/studyDesign'
import { cn } from '../../lib/utils'

const inputClass = 'w-full rounded-lg border bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30'
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-60'

type Style = 'harvard' | 'apa'
interface ApiFailure { code?: string; message?: string; details?: ApiFieldError[]; response?: { status?: number } }

function Field({ id, label, help, error, hint, optional, children }: {
  id: string; label: string; help?: string; error?: string; hint?: string | null; optional?: boolean; children: (described: string) => React.ReactNode
}) {
  const described = [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-slate-800">
        {label}{optional ? <span className="font-normal text-slate-600"> (optional)</span> : null}
        {hint ? <span className="ml-2 font-normal text-slate-600">{hint}</span> : null}
      </label>
      {children(described)}
      {help ? <p id={`${id}-help`} className="mt-1 text-[12px] leading-snug text-slate-600">{help}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-1 flex items-start gap-1 text-[13px] font-medium text-red-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error}</span></p> : null}
    </div>
  )
}

/** "Your project's sample size is now 84 and its recruitment target 105 (was 200)." */
export function describeApplied(facts: AppliedFact[]): string {
  const part = (f: AppliedFact) => `${f.factKey === 'RecruitmentTarget' ? 'recruitment target' : 'sample size'} ${f.value}${f.previousValue ? ` (was ${f.previousValue})` : ''}`
  return facts.length === 0 ? 'Nothing was changed.' : `Saved to your project: ${facts.map(part).join(', ')}. Sections that state another figure will be flagged.`
}

const blankForm = (calculator: CalculatorId): FormState => ({ calculator, values: {}, basis: '', justification: '', adjustments: emptyAdjustments() })

export function SampleSizeTab({ projectId, projectTitle }: { projectId: string; projectTitle: string | null }) {
  const uid = useId()
  const [form, setForm] = useState<FormState>(() => blankForm('correlation_pearson'))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState<'calculate' | 'save' | null>(null)
  // Using the stored calculation in the project (W4.1): a status line, or the server's reason with a Replace offer.
  const [applyNote, setApplyNote] = useState<string | null>(null)
  const [applyClash, setApplyClash] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [shown, setShown] = useState<StoredCalculation | null>(null)
  const [dirty, setDirty] = useState(false)
  const [texts, setTexts] = useState<Partial<Record<Style, string>>>({})
  const [style, setStyle] = useState<Style>('harvard')
  const [copied, setCopied] = useState(false)
  const [label, setLabel] = useState('')
  const [saved, setSaved] = useState<StoredCalculation[]>([])
  const [savedState, setSavedState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLElement>(null)

  const def = calculatorById(form.calculator) as CalculatorDef
  const fid = (key: string) => `${uid}-${key}`

  const loadSaved = useCallback(async () => {
    if (!projectId) { setSaved([]); setSavedState('idle'); return }
    setSavedState('loading')
    try { setSaved(await studyDesignApi.list(projectId)); setSavedState('idle') }
    catch { setSavedState('error') }
  }, [projectId])
  useEffect(() => { void loadSaved() }, [loadSaved])

  // Changing project keeps what was typed, but a stored result belongs to the project it was saved with.
  useEffect(() => {
    setConfirmDelete(null)
    setShown(current => {
      if (current && current.projectId !== projectId) { setResult(null); setTexts({}); return null }
      return current
    })
  }, [projectId])

  const change = (patch: Partial<FormState>) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }
  const setValue = (key: string, value: string) => change({ values: { ...form.values, [key]: value } })
  const setAdjustment = (patch: Partial<AdjustmentValues>) => change({ adjustments: { ...form.adjustments, ...patch } })

  const fail = (err: unknown) => {
    const e = err as ApiFailure
    if (e?.code === 'STUDY_DESIGN_VALIDATION') {
      const mapped = fieldErrors(e.details)
      setErrors(mapped)
      setFailure(null)
      requestAnimationFrame(() => summaryRef.current?.focus())
    } else if (e?.response?.status === 429 || e?.code === 'STUDY_DESIGN_RATE_LIMITED') setFailure('Too many calculations in a short time. Wait a minute and try again.')
    else if (e?.code === 'STUDY_DESIGN_LIMIT_REACHED') setFailure(e.message ?? 'This project has reached its limit of stored calculations. Delete some first.')
    else if (e?.code === 'STUDY_DESIGN_NOT_FOUND') setFailure('That project or calculation could not be found. It may have been deleted.')
    else if (e?.code === 'STUDY_DESIGN_DISABLED') setFailure('Study Design is not switched on for your account.')
    else setFailure('The calculation could not be completed. Check your connection and try again. Nothing was saved.')
  }

  const run = async (save: boolean) => {
    setBusy(save ? 'save' : 'calculate'); setErrors({}); setFailure(null); setCopied(false)
    const request = buildRequest(form)
    try {
      if (save && projectId) {
        const stored = await studyDesignApi.save(projectId, { ...request, label: label.trim() || undefined })
        setResult(stored.result); setShown(stored); setTexts({}); setLabel('')
        void loadSaved()
      } else {
        const calculated = await studyDesignApi.calculate(request)
        setResult(calculated); setShown(null); setTexts({})
        studyDesignApi.methodsText(request).then(setTexts).catch(() => setTexts({}))
      }
      setDirty(false)
      requestAnimationFrame(() => resultRef.current?.focus())
    } catch (err) { fail(err) }
    finally { setBusy(null) }
  }

  // A stored calculation's methods text comes from the stored record, one style at a time.
  useEffect(() => {
    if (!shown || texts[style] !== undefined) return
    let cancelled = false
    studyDesignApi.storedMethodsText(shown.projectId, shown.id, style)
      .then(t => { if (!cancelled) setTexts(prev => ({ ...prev, [style]: t.text })) })
      .catch(() => { if (!cancelled) setTexts(prev => ({ ...prev, [style]: '' })) })
    return () => { cancelled = true }
  }, [shown, style, texts])

  const copy = async () => {
    const text = texts[style]
    if (!text) return
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500) }
    catch { (document.getElementById(fid('methods')) as HTMLTextAreaElement | null)?.select() }
  }

  const applyToProject = async (replace: boolean) => {
    if (!shown || applying) return
    setApplying(true); setApplyNote(null); setApplyClash(null)
    try {
      const r = await studyDesignApi.applyToProject(shown.projectId, shown.id, replace)
      setApplyNote(describeApplied(r.facts))
    } catch (err) {
      const e = err as { code?: string; details?: { code?: string; message: string }[] }
      const clash = e?.details?.find(d => d.code === 'CONFIRMED_VALUE_DIFFERS')
      if (clash) setApplyClash(e.details!.filter(d => d.code === 'CONFIRMED_VALUE_DIFFERS').map(d => d.message).join(' '))
      else fail(err)
    } finally { setApplying(false) }
  }

  const show = (c: StoredCalculation) => { setApplyNote(null); setApplyClash(null); setResult(c.result); setShown(c); setTexts({}); setDirty(false); requestAnimationFrame(() => resultRef.current?.focus()) }
  const makePrimary = async (c: StoredCalculation) => { try { await studyDesignApi.update(c.projectId, c.id, { isPrimary: true }); await loadSaved() } catch (err) { fail(err) } }
  const remove = async (c: StoredCalculation) => {
    try {
      await studyDesignApi.remove(c.projectId, c.id)
      if (shown?.id === c.id) { setResult(null); setShown(null); setTexts({}) }
      setConfirmDelete(null); await loadSaved()
    } catch (err) { fail(err) }
  }

  const errorList = useMemo(() => Object.entries(errors), [errors])
  const groups = useMemo(() => (['test', 'estimate', 'ruleOfThumb'] as const).map(g => ({ g, items: CALCULATORS.filter(c => c.group === g) })), [])
  const basis = BASIS_OPTIONS.find(b => b.value === form.basis)
  const benchmark = def.effect?.benchmarks.find(b => String(b.value) === (form.values[def.effect!.key] ?? '').trim().replace(',', '.'))
  const a = form.adjustments

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form noValidate onSubmit={e => { e.preventDefault(); void run(false) }} aria-label="Sample size inputs" className="space-y-6">
        <fieldset>
          <legend className="text-[15px] font-semibold text-slate-900">1. What is the sample for?</legend>
          <p className="mt-0.5 text-[13px] text-slate-600">Choose the analysis that answers your main research question. The calculation covers that one analysis.</p>
          <div className="mt-3 space-y-3">
            {groups.map(({ g, items }) => (
              <div key={g}>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-600">{GROUP_LABELS[g]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map(c => (
                    <label key={c.id} className={cn('flex cursor-pointer items-start gap-2 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-purple-accent/40',
                      form.calculator === c.id ? 'border-purple-accent bg-purple-tint/40' : 'border-slate-200 hover:border-slate-300')}>
                      <input type="radio" name={`${uid}-calculator`} value={c.id} checked={form.calculator === c.id} className="mt-1 accent-purple-accent"
                        onChange={() => { setForm(blankForm(c.id)); setErrors({}); setFailure(null); setDirty(true) }} />
                      <span>
                        <span className="block text-[14px] font-medium text-slate-900">{c.label}</span>
                        <span className="block text-[12px] leading-snug text-slate-600">{c.useWhen}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        {def.id === 'yamane' ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span><strong>Rule of thumb.</strong> Yamane&apos;s formula is the percentage calculator with the confidence level fixed near 95% and the proportion fixed at 0.5. It ignores how variable your outcome is. Use &ldquo;Estimate a percentage&rdquo; unless your department requires Yamane.</span>
          </p>
        ) : null}

        {def.effect ? (
          <fieldset className="space-y-3">
            <legend className="text-[15px] font-semibold text-slate-900">2. Effect size</legend>
            <p className="text-[13px] text-slate-600">The sample size is only as good as this number. Use an estimate from studies like yours if you can.</p>
            <Field id={fid(def.effect.key)} label={`${def.effect.name} (${def.effect.symbol})`} help={def.effect.help} error={errors[def.effect.key]}>
              {described => <input id={fid(def.effect!.key)} inputMode="decimal" autoComplete="off" value={form.values[def.effect!.key] ?? ''} aria-describedby={described || undefined} aria-invalid={!!errors[def.effect!.key]}
                onChange={e => setValue(def.effect!.key, e.target.value)} className={cn(inputClass, errors[def.effect!.key] ? 'border-red-600' : 'border-slate-300')} />}
            </Field>
            <div>
              <p className="text-[12px] text-slate-600">Conventions, not evidence. Choosing one marks the result as based on a convention.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {def.effect.benchmarks.map(b => (
                  <button key={b.label} type="button" aria-pressed={benchmark?.label === b.label && form.basis === 'benchmark'}
                    onClick={() => change({ values: { ...form.values, [def.effect!.key]: String(b.value) }, basis: 'benchmark' })}
                    className={cn('min-h-9 rounded-lg border px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                      benchmark?.label === b.label && form.basis === 'benchmark' ? 'border-purple-accent bg-purple-tint/60 text-purple-deep' : 'border-slate-300 text-slate-800 hover:bg-slate-50')}>
                    {b.label} ({def.effect!.symbol} = {b.value})
                  </button>
                ))}
              </div>
            </div>
            <Field id={fid('effectSizeBasis')} label="Where does this effect size come from?" error={errors.effectSizeBasis}>
              {described => (
                <select id={fid('effectSizeBasis')} value={form.basis} aria-describedby={described || undefined} aria-invalid={!!errors.effectSizeBasis}
                  onChange={e => change({ basis: e.target.value as EffectBasis | '' })} className={cn(inputClass, errors.effectSizeBasis ? 'border-red-600' : 'border-slate-300')}>
                  <option value="">Choose…</option>
                  {BASIS_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              )}
            </Field>
            <Field id={fid('effectSizeJustification')} label="Justify it" error={errors.effectSizeJustification}
              help={basis?.prompt ?? 'Explain the value in a sentence or two. It is stored with the calculation and appears in your methods text when it comes from studies or a pilot.'}>
              {described => <textarea id={fid('effectSizeJustification')} rows={3} maxLength={500} value={form.justification} aria-describedby={described || undefined} aria-invalid={!!errors.effectSizeJustification}
                onChange={e => change({ justification: e.target.value })} className={cn(inputClass, errors.effectSizeJustification ? 'border-red-600' : 'border-slate-300')} />}
            </Field>
          </fieldset>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-[15px] font-semibold text-slate-900">{def.effect ? '3. Test settings' : '2. Settings'}</legend>
          <p className="text-[13px] text-slate-600">Enter proportions as decimals: 0.05, not 5. A comma also works: 0,05.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {def.fields.map(f => (
              <Field key={f.key} id={fid(f.key)} label={f.label} help={f.help} error={errors[f.key]} optional={f.optional} hint={f.fraction ? asPercentHint(form.values[f.key] ?? '') : null}>
                {described => f.options ? (
                  <select id={fid(f.key)} value={form.values[f.key] ?? ''} aria-describedby={described || undefined} aria-invalid={!!errors[f.key]}
                    onChange={e => setValue(f.key, e.target.value)} className={cn(inputClass, errors[f.key] ? 'border-red-600' : 'border-slate-300')}>
                    <option value="">Choose…</option>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={fid(f.key)} inputMode={f.whole ? 'numeric' : 'decimal'} autoComplete="off" placeholder={f.placeholder ? `e.g. ${f.placeholder}` : undefined} value={form.values[f.key] ?? ''}
                    aria-describedby={described || undefined} aria-invalid={!!errors[f.key]} onChange={e => setValue(f.key, e.target.value)} className={cn(inputClass, errors[f.key] ? 'border-red-600' : 'border-slate-300')} />
                )}
              </Field>
            ))}
          </div>
        </fieldset>

        <details className="rounded-lg border border-slate-200 p-3" open={Object.keys(errors).some(k => ['nonResponseRate', 'unusableRate', 'clusterSize', 'icc', 'accessiblePopulation', 'nPerSubgroup', 'subgroups'].includes(k)) || undefined}>
          <summary className="cursor-pointer text-[15px] font-semibold text-slate-900">Adjustments (optional)</summary>
          <p className="mt-1 text-[13px] text-slate-600">Leave blank what does not apply. Each step is rounded up, so you can check it by hand.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field id={fid('nonResponseRate')} label="Expected non-response" help="The share of invited people who will not respond. 0.20 means 1 in 5." error={errors.nonResponseRate} hint={asPercentHint(a.nonResponseRate)}>
              {d => <input id={fid('nonResponseRate')} inputMode="decimal" value={a.nonResponseRate} aria-describedby={d || undefined} aria-invalid={!!errors.nonResponseRate} onChange={e => setAdjustment({ nonResponseRate: e.target.value })} className={cn(inputClass, errors.nonResponseRate ? 'border-red-600' : 'border-slate-300')} />}
            </Field>
            <Field id={fid('unusableRate')} label="Incomplete or unusable responses" help="The share of returned responses you expect to discard." error={errors.unusableRate} hint={asPercentHint(a.unusableRate)}>
              {d => <input id={fid('unusableRate')} inputMode="decimal" value={a.unusableRate} aria-describedby={d || undefined} aria-invalid={!!errors.unusableRate} onChange={e => setAdjustment({ unusableRate: e.target.value })} className={cn(inputClass, errors.unusableRate ? 'border-red-600' : 'border-slate-300')} />}
            </Field>
            <Field id={fid('clusterSize')} label="Average cluster size" help="Only for cluster sampling, for example whole classes. Needs the intraclass correlation too." error={errors.clusterSize}>
              {d => <input id={fid('clusterSize')} inputMode="decimal" value={a.clusterSize} aria-describedby={d || undefined} aria-invalid={!!errors.clusterSize} onChange={e => setAdjustment({ clusterSize: e.target.value })} className={cn(inputClass, errors.clusterSize ? 'border-red-600' : 'border-slate-300')} />}
            </Field>
            <Field id={fid('icc')} label="Intraclass correlation (ICC)" help="How alike people in the same cluster are, from 0 to 1. Take it from published studies." error={errors.icc}>
              {d => <input id={fid('icc')} inputMode="decimal" value={a.icc} aria-describedby={d || undefined} aria-invalid={!!errors.icc} onChange={e => setAdjustment({ icc: e.target.value })} className={cn(inputClass, errors.icc ? 'border-red-600' : 'border-slate-300')} />}
            </Field>
            <Field id={fid('accessiblePopulation')} label="People you can actually reach" help="If the study needs more invitations than this, you will be told instead of given a number." error={errors.accessiblePopulation}>
              {d => <input id={fid('accessiblePopulation')} inputMode="numeric" value={a.accessiblePopulation} aria-describedby={d || undefined} aria-invalid={!!errors.accessiblePopulation} onChange={e => setAdjustment({ accessiblePopulation: e.target.value })} className={cn(inputClass, errors.accessiblePopulation ? 'border-red-600' : 'border-slate-300')} />}
            </Field>
          </div>
          <fieldset className="mt-4">
            <legend className="text-[14px] font-semibold text-slate-900">Subgroups you will analyse separately</legend>
            <p className="text-[13px] text-slate-600">If each subgroup needs a minimum number of responses, the total may have to be larger. Shares must add up to 1.</p>
            <div className="mt-2 max-w-xs">
              <Field id={fid('nPerSubgroup')} label="Minimum completed responses per subgroup" error={errors.nPerSubgroup}>
                {d => <input id={fid('nPerSubgroup')} inputMode="numeric" value={a.nPerSubgroup} aria-describedby={d || undefined} aria-invalid={!!errors.nPerSubgroup} onChange={e => setAdjustment({ nPerSubgroup: e.target.value })} className={cn(inputClass, errors.nPerSubgroup ? 'border-red-600' : 'border-slate-300')} />}
              </Field>
            </div>
            <ul className="mt-2 space-y-2">
              {a.subgroups.map((s, i) => (
                <li key={i} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[9rem] flex-1">
                    <label htmlFor={fid(`sg-name-${i}`)} className="mb-1 block text-[12px] text-slate-700">Subgroup {i + 1} name</label>
                    <input id={fid(`sg-name-${i}`)} value={s.name} maxLength={80} onChange={e => setAdjustment({ subgroups: a.subgroups.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} className={cn(inputClass, 'border-slate-300')} />
                  </div>
                  <div className="w-36">
                    <label htmlFor={fid(`sg-share-${i}`)} className="mb-1 block text-[12px] text-slate-700">Expected share {asPercentHint(s.share) ?? ''}</label>
                    <input id={fid(`sg-share-${i}`)} inputMode="decimal" placeholder="e.g. 0.3" value={s.share} aria-invalid={!!errors.subgroups} onChange={e => setAdjustment({ subgroups: a.subgroups.map((x, j) => j === i ? { ...x, share: e.target.value } : x) })} className={cn(inputClass, errors.subgroups ? 'border-red-600' : 'border-slate-300')} />
                  </div>
                  <button type="button" onClick={() => setAdjustment({ subgroups: a.subgroups.filter((_, j) => j !== i) })} aria-label={`Remove subgroup ${i + 1}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"><Trash2 size={16} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
            {errors.subgroups ? <p id={fid('subgroups')} tabIndex={-1} className="mt-1 flex items-start gap-1 text-[13px] font-medium text-red-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{errors.subgroups}</p> : null}
            <button type="button" disabled={a.subgroups.length >= 20} onClick={() => setAdjustment({ subgroups: [...a.subgroups, { name: '', share: '' }] })}
              className={cn(buttonClass, 'mt-2 border border-slate-300 text-slate-800 hover:bg-slate-50')}><Plus size={16} aria-hidden="true" /> Add a subgroup</button>
          </fieldset>
        </details>

        {errorList.length > 0 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-400">
            <p className="font-semibold">No number was calculated. {errorList.length === 1 ? 'One value needs attention:' : `${errorList.length} values need attention:`}</p>
            <ul className="mt-1 list-disc pl-5">
              {errorList.map(([key, message]) => <li key={key}><a href={`#${fid(key)}`} className="underline" onClick={e => { e.preventDefault(); document.getElementById(fid(key))?.focus() }}>{errorSummaryText(def, key, message)}</a></li>)}
            </ul>
          </div>
        ) : null}
        {failure ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] font-medium text-red-800">{failure}</p> : null}

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy !== null} className={cn(buttonClass, 'bg-purple-accent text-white hover:bg-purple-deep')}>{busy === 'calculate' ? 'Calculating…' : 'Calculate'}</button>
            <span className="text-[12px] text-slate-600">Free. Uses no credits.</span>
          </div>
          {projectId ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor={fid('label')} className="mb-1 block text-[12px] text-slate-700">Name for this calculation (optional)</label>
                <input id={fid('label')} value={label} maxLength={120} onChange={e => setLabel(e.target.value)} placeholder="e.g. Primary hypothesis" className={cn(inputClass, errors.label ? 'border-red-600' : 'border-slate-300')} />
              </div>
              <button type="button" disabled={busy !== null} onClick={() => void run(true)} className={cn(buttonClass, 'border border-purple-accent text-purple-deep hover:bg-purple-tint/50')}>{busy === 'save' ? 'Saving…' : 'Calculate and save to project'}</button>
            </div>
          ) : <p className="text-[13px] text-slate-600">Choose a project above to save calculations with it. Without a project nothing is stored.</p>}
        </div>
      </form>

      <div className="space-y-6">
        <section ref={resultRef} tabIndex={-1} aria-live="polite" aria-label="Result" className="rounded-xl border border-slate-200 p-4 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
          {busy && !result ? <p className="text-[14px] text-slate-700">Calculating…</p> : null}
          {!result && !busy ? (
            <div className="py-8 text-center">
              <p className="text-[15px] font-semibold text-slate-900">No calculation yet</p>
              <p className="mt-1 text-[13px] text-slate-600">Fill in the values and choose Calculate. The result will show its inputs, formula and assumptions.</p>
            </div>
          ) : null}
          {result ? <ResultView result={result} stored={shown} dirty={dirty} projectTitle={projectTitle} /> : null}
          {result ? (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-slate-900">Methods text</h3>
                <div role="group" aria-label="Number style" className="inline-flex rounded-lg border border-slate-300 p-0.5">
                  {(['harvard', 'apa'] as const).map(s => (
                    <button key={s} type="button" aria-pressed={style === s} onClick={() => { setStyle(s); setCopied(false) }}
                      className={cn('min-h-8 rounded-md px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40', style === s ? 'bg-purple-accent text-white' : 'text-slate-800 hover:bg-slate-50')}>
                      {s === 'harvard' ? 'Harvard' : 'APA 7'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[12px] text-slate-600">Built from the calculation above, so the figures cannot differ. Edit the wording to suit your study; do not change the numbers.</p>
              {texts[style] === undefined ? <p className="mt-2 text-[13px] text-slate-700">Preparing the text…</p>
                : texts[style] === '' ? <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">The methods text could not be loaded. Calculate again to retry.</p>
                : (
                  <>
                    <label htmlFor={fid('methods')} className="sr-only">Methods paragraph</label>
                    <textarea id={fid('methods')} readOnly rows={9} value={texts[style]} className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/30" />
                    <div className="mt-2 flex items-center gap-3">
                      <button type="button" onClick={() => void copy()} className={cn(buttonClass, 'border border-slate-300 text-slate-800 hover:bg-slate-50')}>
                        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? 'Copied' : 'Copy as methods text'}
                      </button>
                      {shown ? (
                        <button type="button" disabled={applying} onClick={() => void applyToProject(false)} className={cn(buttonClass, 'border border-purple-300 text-purple-deep hover:bg-purple-50 disabled:opacity-50')}>
                          {applying ? 'Saving…' : 'Use this sample size in my project'}
                        </button>
                      ) : null}
                      <span role="status" className="text-[12px] text-slate-600">{copied ? 'Copied to the clipboard.' : applyNote ?? ''}</span>
                    </div>
                    {applyClash ? (
                      <div role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-900">
                        {applyClash}{' '}
                        <button type="button" disabled={applying} onClick={() => void applyToProject(true)} className="font-semibold underline">Replace</button>
                      </div>
                    ) : null}
                    {!shown ? <p className="mt-1 text-[12px] text-slate-600">Save the calculation with your project to use its sample size there.</p> : null}
                  </>
                )}
            </div>
          ) : null}
        </section>

        {projectId ? (
          <section aria-label="Saved calculations" className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-[15px] font-semibold text-slate-900">Saved with this project</h3>
            {savedState === 'loading' ? <p className="mt-2 text-[13px] text-slate-700">Loading…</p> : null}
            {savedState === 'error' ? <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">Saved calculations could not be loaded. <button type="button" className="underline" onClick={() => void loadSaved()}>Try again</button></p> : null}
            {savedState === 'idle' && saved.length === 0 ? <p className="mt-2 text-[13px] text-slate-600">Nothing saved yet. Use &ldquo;Calculate and save to project&rdquo;.</p> : null}
            <ul className="mt-2 divide-y divide-slate-200">
              {saved.map(c => {
                const h = headline(c.result)
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-slate-900">{c.label || calculatorById(c.calculator)?.label || 'Calculation'}</p>
                        <p className="text-[13px] text-slate-700">{h.value} {h.unit}{c.result.adjustments ? `; invite ${c.result.adjustments.nToInvite}` : ''} · {new Date(c.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                          {c.isPrimary ? <span className="inline-flex items-center gap-1 rounded bg-purple-tint px-1.5 py-0.5 font-semibold text-purple-deep"><Star size={12} aria-hidden="true" /> Primary: used for this project&apos;s checks</span> : null}
                          {c.projectChangedSince ? <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900"><AlertTriangle size={12} aria-hidden="true" /> Project changed since this was calculated</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => show(c)} className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">Show</button>
                        {!c.isPrimary ? <button type="button" onClick={() => void makePrimary(c)} className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">Make primary</button> : null}
                        {confirmDelete === c.id ? (
                          <>
                            <button type="button" onClick={() => void remove(c)} className="min-h-9 rounded-lg bg-red-700 px-2.5 text-[13px] font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Delete permanently</button>
                            <button type="button" onClick={() => setConfirmDelete(null)} className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">Cancel</button>
                          </>
                        ) : <button type="button" onClick={() => setConfirmDelete(c.id)} aria-label={`Delete ${c.label || 'calculation'}`} className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">Delete</button>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ResultView({ result, stored, dirty, projectTitle }: { result: CalculationResult; stored: StoredCalculation | null; dirty: boolean; projectTitle: string | null }) {
  const h = headline(result)
  const adj = result.adjustments
  return (
    <div>
      {dirty ? (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>You have changed the form since this was calculated. The result below is for the inputs listed under it. Calculate again to update it.</span>
        </p>
      ) : null}
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">{stored ? `Saved${projectTitle ? ` with ${projectTitle}` : ''}` : 'Not saved'}</p>
      <h3 className="mt-1 text-[15px] font-semibold text-slate-900">Minimum sample</h3>
      <p className="mt-1"><span className="text-4xl font-bold text-slate-900">{h.value}</span> <span className="text-[15px] text-slate-800">{h.unit}</span></p>
      {h.detail ? <p className="text-[14px] text-slate-700">{h.detail}</p> : null}
      {adj && adj.nToInvite !== adj.nRequired ? (
        <p className="mt-2 rounded-lg bg-purple-tint/50 p-2.5 text-[14px] text-slate-900">
          <strong>Invite {adj.nToInvite.toLocaleString('en-ZA').replace(/,/g, ' ')}</strong>
          {adj.nToInvitePerGroup ? ` (${adj.nToInvitePerGroup} per group)` : ''} to end with {adj.nCompletedAfterSubgroups} completed responses
          {adj.bindingConstraint === 'subgroup' ? '. A subgroup requirement, not the main test, sets this number.' : '.'}
        </p>
      ) : null}
      <p className="mt-2 text-[13px] text-slate-700"><span className="font-medium">Formula:</span> {result.formulaName} <span className="text-slate-600">({result.formulaVersion})</span></p>

      {result.warnings.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {result.warnings.map(w => (
            <li key={w.code} className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span><strong>Note.</strong> {w.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-[13px] font-semibold text-slate-900">Inputs used</h4>
          <dl className="mt-1 text-[13px]">
            {inputRows(result).map(row => <div key={row.label} className="flex justify-between gap-3 border-b border-slate-100 py-1"><dt className="text-slate-700">{row.label}</dt><dd className="font-medium text-slate-900">{row.value}</dd></div>)}
          </dl>
          {result.effectSizeJustification ? <p className="mt-2 text-[12px] text-slate-700"><span className="font-medium">Your justification:</span> {result.effectSizeJustification}</p> : null}
        </div>
        <div>
          <h4 className="text-[13px] font-semibold text-slate-900">Working</h4>
          <ol className="mt-1 text-[13px]">
            {result.steps.map((s, i) => <li key={i} className="flex justify-between gap-3 border-b border-slate-100 py-1"><span className="text-slate-700">{s.label}</span><span className="font-medium text-slate-900">{s.value}</span></li>)}
          </ol>
          {adj && adj.subgroupRows.length > 0 ? <p className="mt-2 text-[12px] text-slate-700">Subgroup shares: {adj.subgroupRows.map(s => `${s.subgroup} ${percent(s.share)}`).join(', ')}.</p> : null}
        </div>
      </div>

      {result.crossChecks.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-800">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>{result.crossChecks.map(c => <p key={c.method}><span className="font-medium">Cross-check, {c.method}: {c.n}.</span> {c.note} If another tool gives you this figure, that is why.</p>)}</div>
        </div>
      ) : null}

      <h4 className="mt-4 text-[13px] font-semibold text-slate-900">Assumptions</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-slate-800">
        {result.assumptions.map(x => <li key={x.code}>{x.text}</li>)}
      </ul>
    </div>
  )
}
