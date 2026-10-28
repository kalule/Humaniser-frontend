import { useEffect, useState, type ReactNode } from 'react'
import { researchApi } from '../../api/research'
import type { UniversityTemplateSummary } from '../../types/research'
import type { ResearchSpecification } from '../../types/proposalWorkflow'
import { designDetailErrors } from '../../lib/researchDesignDetails'
import { StudyParametersEditor } from './StudyParametersEditor'

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'
export function ResearchField({ label, value, onChange, multiline = false, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; readOnly?: boolean }) {
  return <label className="grid gap-1 text-sm text-slate-600"><span>{label}</span>{multiline
    ? <textarea readOnly={readOnly} rows={3} className={inputClass} value={value} onChange={e => onChange(e.target.value)} />
    : <input readOnly={readOnly} className={inputClass} value={value} onChange={e => onChange(e.target.value)} />}</label>
}
export function ResearchLinks({ label, options, selected, onChange }: { label: string; options: { id: string; text: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-medium text-slate-600">{label}</legend>
    {options.length === 0 && <p className="text-xs text-slate-500">Add records first.</p>}
    {options.map(option => <label key={option.id} className="flex items-start gap-2 py-1 text-sm text-slate-700"><input type="checkbox" checked={selected.includes(option.id)} onChange={e => onChange(e.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} /><span>{option.text || 'Untitled record'}</span></label>)}
  </fieldset>
}
export default function ResearchSpecificationEditor({ initial, pending, onAccept, draftMode = false, extraFields }: { initial: ResearchSpecification; pending: boolean; onAccept: (spec: ResearchSpecification) => Promise<void>; draftMode?: boolean; extraFields?: (spec: ResearchSpecification, onChange: (spec: ResearchSpecification) => void) => ReactNode }) {
  const [spec, setSpec] = useState<ResearchSpecification>(() => structuredClone(initial))
  const [reconciled, setReconciled] = useState(false)
  const [shapeErrors, setShapeErrors] = useState<string[]>([])
  const [templates, setTemplates] = useState<UniversityTemplateSummary[]>([])
  useEffect(() => { let cancelled = false; void researchApi.listUniversityTemplates().then(value => { if (!cancelled) setTemplates(value) }).catch(() => {}); return () => { cancelled = true } }, [])
  const patch = (value: Partial<ResearchSpecification>) => { setSpec(s => ({ ...s, ...value })); setReconciled(false) }
  const sampling = (value: Partial<ResearchSpecification['sampling']>) => patch({ sampling: { ...spec.sampling, ...value } })
  const textFields: [keyof ResearchSpecification, string][] = [
    ['title', 'Title'], ['problem', 'Problem statement'], ['field', 'Field of research'], ['geography', 'Geography'], ['population', 'Study population'], ['unitOfAnalysis', 'Unit of analysis'], ['temporalScope', 'Time period and planned dates'], ['framework', 'Framework and its relationship to the study'], ['contribution', 'Expected contribution'], ['scopeLimits', 'Scope boundaries'], ['limitations', 'Limitations'], ['institutionRequirements', 'Reviewed institutional requirements'], ['mixedMethodIntegration', 'Mixed-method integration (when applicable)'],
  ]
  return <form onSubmit={e => { e.preventDefault(); if (reconciled && !pending) { const errors = draftMode ? designDetailErrors(spec) : []; setShapeErrors(errors); if (!errors.length) void onAccept(spec) } }} className="space-y-7">
    <fieldset disabled={pending} className="space-y-7 min-w-0">
    <StudyParametersEditor spec={spec} onChange={study => patch({ study })} />
    <p className="text-sm text-slate-600">Review imported values and complete the research design. {draftMode ? "These are proposed details. Saving checks the draft and keeps acceptance as a separate step." : "Accepting a revision preserves earlier versions and requires dependent sections to be reviewed again. Confirm methodology in the research workspace before acceptance."}</p>
    <div className="grid gap-4 md:grid-cols-2">{textFields.map(([key, label]) => <ResearchField key={key} label={label} readOnly={draftMode && key === 'title'} value={String(spec[key] ?? '')} multiline={['problem', 'framework', 'limitations', 'institutionRequirements'].includes(key)} onChange={value => { if (!draftMode || key !== 'title') patch({ [key]: value }) }} />)}
      <label className="grid gap-1 text-sm text-slate-600">Academic level<select className={inputClass} disabled={draftMode} value={spec.academicLevel} onChange={e => patch({ academicLevel: e.target.value })}>{draftMode && !['UNDERGRADUATE','MASTERS','PHD'].includes(spec.academicLevel) && <option value={spec.academicLevel}>{spec.academicLevel}</option>}<option value="UNDERGRADUATE">Undergraduate</option><option value="MASTERS">Master’s</option><option value="PHD">PhD</option></select></label>
      <label className="grid gap-1 text-sm text-slate-600">Citation style<select className={inputClass} disabled={draftMode} value={spec.citationStyle} onChange={e => patch({ citationStyle: e.target.value })}>{draftMode && !['harvard','apa7','mla','ieee'].includes(spec.citationStyle) && <option value={spec.citationStyle}>{spec.citationStyle}</option>}{['harvard', 'apa7', 'mla', 'ieee'].map(style => <option key={style}>{style}</option>)}</select></label>
      <label className="grid gap-1 text-sm text-slate-600">Total prose words<input type="number" min={2000} max={100000} className={inputClass} value={spec.totalWords} onChange={e => patch({ totalWords: Number(e.target.value) })} /></label>
      <label className="grid gap-1 text-sm text-slate-600">Institution template<select className={inputClass} disabled={draftMode} value={spec.universityTemplateId ?? ''} onChange={e => patch({ universityTemplateId: e.target.value || null })}><option value="">Generic proposal</option>{templates.filter(t => !t.isIllustrative).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {!draftMode && <p className="text-sm text-slate-600">Confirmed methodology revision: {spec.methodologyVersion || 'not confirmed'}</p>}
    </div>
    <fieldset className="space-y-3"><legend className="font-semibold text-slate-900">Questions</legend>
      {spec.questions.map((q, i) => <div key={q.id} className="flex items-end gap-2"><div className="flex-1"><ResearchField label={`Question ${i + 1}`} value={q.text} onChange={text => patch({ questions: spec.questions.map(x => x.id === q.id ? { ...x, text } : x) })} /></div><button type="button" className="p-2 text-sm text-red-700" onClick={() => patch({ questions: spec.questions.filter(x => x.id !== q.id) })}>Retire</button></div>)}
      <button type="button" className="text-sm font-medium text-violet-700" onClick={() => patch({ questions: [...spec.questions, { id: crypto.randomUUID(), text: '' }] })}>Add question</button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold text-slate-900">Constructs and measurement</legend>
      {spec.constructs.map((c, i) => <div key={c.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">{(['name', 'definition', 'role', 'scale', 'unit'] as const).map(key => <ResearchField key={key} label={`${i + 1}. ${key}`} value={c[key]} onChange={value => patch({ constructs: spec.constructs.map(x => x.id === c.id ? { ...x, [key]: value } : x) })} />)}<button type="button" className="text-sm text-red-700" onClick={() => patch({ constructs: spec.constructs.filter(x => x.id !== c.id) })}>Retire construct</button></div>)}
      <button type="button" className="text-sm font-medium text-violet-700" onClick={() => patch({ constructs: [...spec.constructs, { id: crypto.randomUUID(), name: '', definition: '', role: '', scale: '', unit: '' }] })}>Add construct</button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold text-slate-900">Data sources</legend>
      {spec.dataSources.map(d => <div key={d.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2"><ResearchField label="Source or dataset" value={d.name} onChange={name => patch({ dataSources: spec.dataSources.map(x => x.id === d.id ? { ...x, name } : x) })} /><ResearchField label="Collection method" value={d.collectionMethod} onChange={collectionMethod => patch({ dataSources: spec.dataSources.map(x => x.id === d.id ? { ...x, collectionMethod } : x) })} /><button type="button" className="text-left text-sm text-red-700" onClick={() => patch({ dataSources: spec.dataSources.filter(x => x.id !== d.id) })}>Retire data source</button></div>)}
      <button type="button" className="text-sm font-medium text-violet-700" onClick={() => patch({ dataSources: [...spec.dataSources, { id: crypto.randomUUID(), name: '', collectionMethod: '', literatureId: null }] })}>Add data source</button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold text-slate-900">Analysis contracts</legend>
      {spec.analyses.map(a => <div key={a.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2"><ResearchField label="Named analysis method" value={a.method} onChange={method => patch({ analyses: spec.analyses.map(x => x.id === a.id ? { ...x, method } : x) })} /><ResearchField label="Assumptions (one per line)" value={a.assumptions.join('\n')} multiline onChange={value => patch({ analyses: spec.analyses.map(x => x.id === a.id ? { ...x, assumptions: value.split('\n') } : x) })} /><ResearchField label="Missing-data handling" value={a.missingDataHandling} onChange={missingDataHandling => patch({ analyses: spec.analyses.map(x => x.id === a.id ? { ...x, missingDataHandling } : x) })} /><label className="grid gap-1 text-sm text-slate-600">Strand<select className={inputClass} value={a.strand} onChange={e => patch({ analyses: spec.analyses.map(x => x.id === a.id ? { ...x, strand: e.target.value } : x) })}><option>Qualitative</option><option>Quantitative</option></select></label><button type="button" className="text-left text-sm text-red-700" onClick={() => patch({ analyses: spec.analyses.filter(x => x.id !== a.id) })}>Retire analysis</button></div>)}
      <button type="button" className="text-sm font-medium text-violet-700" onClick={() => patch({ analyses: [...spec.analyses, { id: crypto.randomUUID(), method: '', assumptions: [], missingDataHandling: '', strand: 'Quantitative' }] })}>Add analysis</button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold text-slate-900">Objectives and relationships</legend>
      {spec.objectives.map((o, i) => <div key={o.id} className="space-y-3 rounded-xl border p-4"><ResearchField label={`Objective ${i + 1} (${o.type})`} value={o.text} onChange={text => patch({ objectives: spec.objectives.map(x => x.id === o.id ? { ...x, text } : x) })} /><label className="grid gap-1 text-sm text-slate-600">Objective type<select className={inputClass} value={o.type} onChange={e => patch({ objectives: spec.objectives.map(x => x.id === o.id ? { ...x, type: e.target.value } : x) })}><option>General</option><option>Specific</option></select></label><div className="grid gap-3 md:grid-cols-2">{([
        ['questionIds', 'Questions answered', spec.questions], ['constructIds', 'Constructs measured', spec.constructs.map(c => ({ id: c.id, text: c.name }))], ['dataSourceIds', 'Data used', spec.dataSources.map(d => ({ id: d.id, text: d.name }))], ['analysisIds', 'Analyses used', spec.analyses.map(a => ({ id: a.id, text: a.method }))],
      ] as const).map(([key, label, options]) => <ResearchLinks key={key} label={label} options={[...options]} selected={o[key]} onChange={ids => patch({ objectives: spec.objectives.map(x => x.id === o.id ? { ...x, [key]: ids } : x) })} />)}</div><button type="button" className="text-sm text-red-700" onClick={() => patch({ objectives: spec.objectives.filter(x => x.id !== o.id) })}>Retire objective</button></div>)}
      <button type="button" className="text-sm font-medium text-violet-700" onClick={() => patch({ objectives: [...spec.objectives, { id: crypto.randomUUID(), text: '', type: 'Specific', questionIds: [], constructIds: [], dataSourceIds: [], analysisIds: [] }] })}>Add objective</button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold text-slate-900">Hypotheses</legend>
      <label className="grid gap-1 text-sm text-slate-600">Applicability<select className={inputClass} value={spec.hypothesisApplicability} onChange={e => patch({ hypothesisApplicability: e.target.value })}><option>Unknown</option><option>Applicable</option><option>NotApplicable</option></select></label>
      <ResearchField label="Reason for the applicability decision" value={spec.hypothesisRationale} multiline onChange={hypothesisRationale => patch({ hypothesisRationale })} />
      {spec.hypotheses.map((h, i) => <div key={h.id} className="space-y-3 rounded-xl border p-4">
        {(['nullHypothesis', 'alternativeHypothesis', 'plannedTest'] as const).map(key => <ResearchField key={key} label={`${i + 1}. ${key.replace(/([A-Z])/g, ' $1')}`} value={h[key]} onChange={value => patch({ hypotheses: spec.hypotheses.map(x => x.id === h.id ? { ...x, [key]: value } : x) })} />)}
        <label className="grid gap-1 text-sm text-slate-600">Significance level<input type="number" min={0.0001} max={0.9999} step="any" className={inputClass} value={h.significanceLevel} onChange={e => patch({ hypotheses: spec.hypotheses.map(x => x.id === h.id ? { ...x, significanceLevel: Number(e.target.value) } : x) })} /></label>
        <ResearchLinks label="Objectives tested" options={spec.objectives} selected={h.objectiveIds} onChange={objectiveIds => patch({ hypotheses: spec.hypotheses.map(x => x.id === h.id ? { ...x, objectiveIds } : x) })} />
        <ResearchLinks label="Constructs tested" options={spec.constructs.map(c => ({ id: c.id, text: c.name }))} selected={h.constructIds} onChange={constructIds => patch({ hypotheses: spec.hypotheses.map(x => x.id === h.id ? { ...x, constructIds } : x) })} />
        <button type="button" className="text-sm text-red-700" onClick={() => patch({ hypotheses: spec.hypotheses.filter(x => x.id !== h.id) })}>Retire hypothesis</button>
      </div>)}
      <button type="button" className="text-sm font-medium text-violet-700" onClick={() => patch({ hypotheses: [...spec.hypotheses, { id: crypto.randomUUID(), nullHypothesis: '', alternativeHypothesis: '', objectiveIds: [], constructIds: [], plannedTest: '', significanceLevel: 0.05 }] })}>Add hypothesis</button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold text-slate-900">Sampling and reproducible calculation</legend>
      <label className="grid gap-1 text-sm text-slate-600">Design<select className={inputClass} value={spec.sampling.design} onChange={e => sampling({ design: e.target.value })}><option value="">Choose a design</option><option value="ProportionPrecision">Proportion with precision target</option><option value="TwoIndependentMeans">Two independent means (balanced groups)</option><option value="Qualitative">Qualitative information power / saturation</option></select></label>
      <div className="grid gap-3 md:grid-cols-3">{(['confidence', 'margin', 'proportion', 'populationSize', 'effectSize', 'power', 'designEffect', 'responseRate'] as const).map(key => <label key={key} className="grid gap-1 text-sm text-slate-600">{key.replace(/([A-Z])/g, ' $1')}<input type="number" step="any" className={inputClass} value={spec.sampling[key] ?? ''} onChange={e => sampling({ [key]: e.target.value === '' ? null : Number(e.target.value) })} /></label>)}</div>
      <ResearchField label="Sampling frame" value={spec.sampling.frame} onChange={frame => sampling({ frame })} /><ResearchField label="Assumptions and justification for inputs / qualitative sample" value={spec.sampling.rationale} multiline onChange={rationale => sampling({ rationale })} />
      <p className="text-xs text-slate-500">Confidence: 0.90, 0.95 or 0.99. Power: 0.80, 0.90 or 0.95. Proportions and response rates use fractions. Calculation validity and methodological adequacy are reviewed separately.</p>
    </fieldset>
    {extraFields?.(spec, next => { setSpec(next); setReconciled(false) })}
    <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={reconciled} onChange={e => setReconciled(e.target.checked)} /><span>{draftMode ? "I have reviewed these proposed details and want the design checked again." : "I have reconciled imported values, reviewed the relationships and sampling assumptions, and confirm this research design."}</span></label>
    {shapeErrors.length > 0 && <div role="alert" className="space-y-1 text-sm">{shapeErrors.map(message => <p key={message}>{message}</p>)}</div>}
    <button disabled={!reconciled || pending} className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{pending ? (draftMode ? 'Saving...' : 'Accepting...') : draftMode ? 'Save details & check design' : 'Accept Research Revision'}</button>
    </fieldset>
  </form>
}

