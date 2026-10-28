import type { ResearchSpecification, StudySpecification } from '../../types/proposalWorkflow'
import { PopulationDecisionsEditor } from './PopulationDecisionsEditor'
import { EligibilityDecisionsEditor } from './EligibilityDecisionsEditor'

const input = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm w-full'
const empty: StudySpecification = { schemaVersion: 2, methodologySubtype: '', samplePlan: null, eligibility: [], instruments: [], budget: null, timeline: [], dataLifecycle: [], decisions: {}, unresolvedNeeds: [] }
const list = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean)

export function StudyParametersEditor({ spec, onChange }: { spec: ResearchSpecification; onChange: (study: StudySpecification) => void }) {
  const study = spec.study ?? empty
  const patch = (value: Partial<StudySpecification>) => onChange({ ...study, ...value })
  const field = (label: string, value: string | number, change: (value: string) => void, numeric = false) => <label className="grid gap-1 text-xs text-slate-600">{label}<input className={input} type={numeric ? 'number' : 'text'} value={value} onChange={e => change(e.target.value)} /></label>
  const remove = (action: () => void) => <button type="button" className="text-sm text-red-600" onClick={action}>Remove</button>
  const add = (label: string, action: () => void) => <button type="button" className="text-sm font-medium text-violet-700" onClick={action}>{label}</button>
  const sample = study.samplePlan
  const budget = study.budget
  return <section className="space-y-5 rounded-xl border border-slate-200 p-4">
    <h3 className="font-semibold text-slate-900">Study parameters</h3>
    <p className="text-sm text-slate-600">These decisions govern every section. Leave undecided items pending; final submission requires them to be resolved.</p>
    {field('Methodological and analytic tradition', study.methodologySubtype, value => patch({ methodologySubtype: value }))}
    <PopulationDecisionsEditor value={study.populationDescription} onChange={populationDescription => patch({ populationDescription })} />
    {!study.design && field('Accessible population', study.decisions.accessiblePopulation ?? '', value => patch({ decisions: { ...study.decisions, accessiblePopulation: value } }))}
    <fieldset className="space-y-3"><legend className="font-medium text-sm">Sample plan</legend>
      {sample ? <div className="grid gap-3 md:grid-cols-3">
        {(['minimum', 'maximum', 'initialTarget', 'reviewTranscriptCount'] as const).map(key => field(({ minimum: 'Minimum', maximum: 'Maximum', initialTarget: 'Initial target', reviewTranscriptCount: 'Transcripts for second review' })[key], sample[key], value => patch({ samplePlan: { ...sample, [key]: Number(value) } }), true))}
        {field('Adaptive stopping rule', sample.adaptiveStoppingRule, value => patch({ samplePlan: { ...sample, adaptiveStoppingRule: value } }))}
        {remove(() => patch({ samplePlan: null }))}
      </div> : add('Define sample plan', () => patch({ samplePlan: { minimum: 0, maximum: 0, initialTarget: 0, adaptiveStoppingRule: '', reviewTranscriptCount: 0 } }))}
    </fieldset>
    <EligibilityDecisionsEditor study={study} onChange={patch} />
    <fieldset className="space-y-3"><legend className="font-medium text-sm">Interview or questionnaire items</legend>
      {study.instruments.map(item => {
        const change = (value: Partial<typeof item>) => patch({ instruments: study.instruments.map(row => row.id === item.id ? { ...row, ...value } : row) })
        return <div key={item.id} className="space-y-2 border-b pb-3">
          {field('Item or prompt', item.text, value => change({ text: value }))}
          <div className="grid gap-2 md:grid-cols-2">{([['Questions', spec.questions, 'questionIds'], ['Analyses', spec.analyses.map(a => ({ id: a.id, text: a.method })), 'analysisIds']] as const).map(([label, options, key]) => <fieldset key={key}><legend className="text-xs">{label}</legend>{options.map(option => <label key={option.id} className="block text-sm"><input type="checkbox" checked={item[key].includes(option.id)} onChange={e => change({ [key]: e.target.checked ? [...item[key], option.id] : item[key].filter(id => id !== option.id) })} /> {option.text}</label>)}</fieldset>)}</div>
          {remove(() => patch({ instruments: study.instruments.filter(row => row.id !== item.id) }))}
        </div>
      })}
      {add('Add instrument item', () => patch({ instruments: [...study.instruments, { id: crypto.randomUUID(), text: '', questionIds: [], analysisIds: [] }] }))}
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-medium text-sm">Budget estimates</legend>
      {budget ? <>
        <div className="grid gap-3 md:grid-cols-2">{field('Currency', budget.currency, value => patch({ budget: { ...budget, currency: value } }))}{field('Contingency (%)', budget.contingencyRate * 100, value => patch({ budget: { ...budget, contingencyRate: Number(value) / 100 } }), true)}</div>
        {budget.items.map(item => { const change = (value: Partial<typeof item>) => patch({ budget: { ...budget, items: budget.items.map(row => row.id === item.id ? { ...row, ...value } : row) } }); return <div key={item.id} className="grid gap-2 md:grid-cols-4">{field('Item', item.description, value => change({ description: value }))}{field('Quantity', item.quantity, value => change({ quantity: Number(value) }), true)}{field('Unit price', item.unitPrice, value => change({ unitPrice: Number(value) }), true)}{remove(() => patch({ budget: { ...budget, items: budget.items.filter(row => row.id !== item.id) } }))}</div> })}
        {add('Add cost', () => patch({ budget: { ...budget, items: [...budget.items, { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }] } }))}
        {remove(() => patch({ budget: null }))}
      </> : add('Define budget', () => patch({ budget: { currency: '', items: [], contingencyRate: 0 } }))}
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-medium text-sm">Timeline and approvals</legend>
      {study.timeline.map(task => { const change = (value: Partial<typeof task>) => patch({ timeline: study.timeline.map(row => row.id === task.id ? { ...row, ...value } : row) }); return <div key={task.id} className="space-y-2 border-b pb-3">
        <div className="grid gap-2 md:grid-cols-3">{field('Task', task.name, value => change({ name: value }))}{field('Start month', task.startMonth, value => change({ startMonth: Number(value) }), true)}{field('Duration in months', task.durationMonths, value => change({ durationMonths: Number(value) }), true)}</div>
        <div className="flex gap-3 text-sm"><label><input type="checkbox" checked={task.approval} onChange={e => change({ approval: e.target.checked })} /> Approval</label><label><input type="checkbox" checked={task.participantFacing} onChange={e => change({ participantFacing: e.target.checked })} /> Participant contact</label></div>
        <fieldset><legend className="text-xs">Must follow</legend>{study.timeline.filter(t => t.id !== task.id).map(t => <label key={t.id} className="block text-sm"><input type="checkbox" checked={task.dependencies.includes(t.id)} onChange={e => change({ dependencies: e.target.checked ? [...task.dependencies, t.id] : task.dependencies.filter(id => id !== t.id) })} /> {t.name || 'Unnamed task'}</label>)}</fieldset>
        {remove(() => patch({ timeline: study.timeline.filter(row => row.id !== task.id) }))}
      </div> })}
      {add('Add task', () => patch({ timeline: [...study.timeline, { id: crypto.randomUUID(), name: '', startMonth: 1, durationMonths: 1, dependencies: [], participantFacing: false, approval: false }] }))}
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-medium text-sm">Data lifecycle</legend>
      {study.dataLifecycle.map((asset, index) => { const change = (value: Partial<typeof asset>) => patch({ dataLifecycle: study.dataLifecycle.map((row, i) => i === index ? { ...row, ...value } : row) }); return <div key={index} className="grid gap-2 md:grid-cols-2 border-b pb-3">
        {field('Data asset', asset.asset, value => change({ asset: value }))}{field('Storage locations (comma separated)', asset.storageLocations.join(', '), value => change({ storageLocations: list(value) }))}{field('Access roles (comma separated)', asset.accessRoles.join(', '), value => change({ accessRoles: list(value) }))}{field('Retention months', asset.retentionMonths, value => change({ retentionMonths: Number(value) }), true)}{field('Retention starts at', asset.retentionTrigger, value => change({ retentionTrigger: value }))}{field('Withdrawal and deletion policy', asset.withdrawalRule, value => change({ withdrawalRule: value }))}
        <label className="grid gap-1 text-xs">Identity state<select className={input} value={asset.identityState} onChange={e => change({ identityState: e.target.value })}>{['Identifiable', 'Pseudonymized', 'Anonymized'].map(value => <option key={value}>{value}</option>)}</select></label>
        {remove(() => patch({ dataLifecycle: study.dataLifecycle.filter((_, i) => i !== index) }))}
      </div> })}
      {add('Add data asset', () => patch({ dataLifecycle: [...study.dataLifecycle, { asset: '', storageLocations: [], accessRoles: [], retentionMonths: 0, retentionTrigger: '', identityState: 'Identifiable', withdrawalRule: '' }] }))}
    </fieldset>
    <div className="grid gap-3 md:grid-cols-2">{['software', 'funding', 'conflictOfInterest'].map(key => field(({ software: 'Analysis software decision', funding: 'Funding decision', conflictOfInterest: 'Researcher conflict-of-interest declaration' })[key as 'software' | 'funding' | 'conflictOfInterest'], study.decisions[key] ?? '', value => { const decisions = { ...study.decisions }; if (value.trim()) decisions[key] = value; else delete decisions[key]; patch({ decisions }) }))}</div>
    <fieldset className="space-y-3"><legend className="font-medium text-sm">Unresolved decisions</legend>
      <p className="text-xs text-slate-500">Keep missing inputs explicit. Resolve each decision before final export.</p>
      {study.unresolvedNeeds.map((need, index) => {
        const change = (value: Partial<typeof need>) => patch({ unresolvedNeeds: study.unresolvedNeeds.map((row, i) => i === index ? { ...row, ...value } : row) })
        return <div key={index} className="grid gap-2 md:grid-cols-3 border-b pb-3">
          {field('Decision key', need.key, value => change({ key: value }))}
          {field('Missing information', need.reason, value => change({ reason: value }))}
          {field('Decision owner', need.owner, value => change({ owner: value }))}
          {remove(() => patch({ unresolvedNeeds: study.unresolvedNeeds.filter((_, i) => i !== index) }))}
        </div>
      })}
      {add('Add unresolved decision', () => patch({ unresolvedNeeds: [...study.unresolvedNeeds, { key: '', reason: '', owner: '' }] }))}
    </fieldset>
  </section>
}
