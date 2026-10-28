import type { ResearchSpecification } from '../../types/proposalWorkflow'
import { ResearchField, ResearchLinks } from '../research-agent/ResearchSpecificationEditor'
import { Button } from '../ui/Button'
import { PopulationDecisionsEditor } from '../research-agent/PopulationDecisionsEditor'
import { EligibilityDecisionsEditor } from '../research-agent/EligibilityDecisionsEditor'
import { choicesForDetail, detailLabel, detailTemplates, protectedDetail, replaceDesignDetail, type DetailRecord } from '../../lib/researchDesignDetails'
const input = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm'
export function ResearchDesignDetailsEditor({ spec, onChange }: { spec: ResearchSpecification; onChange: (spec: ResearchSpecification) => void }) {
  const nodes = [...spec.questions.map(x => ({id:x.id,text:x.text})), ...spec.constructs.map(x => ({id:x.id,text:x.name})), ...spec.analyses.map(x => ({id:x.id,text:x.method})), ...spec.dataSources.map(x => ({id:x.id,text:x.name})), ...(spec.study?.instruments ?? []).map(x => ({id:x.id,text:x.text}))]
  const template = (key: string, path: (string | number)[]): DetailRecord | undefined => {
    if (key === 'design' && path.includes('instruments')) return {claimsValidated:false,validationEvidenceIds:[],version:'',context:''}
    if (key === 'safeguards' && path.includes('instruments')) return {constructIds:[],claimsReliability:false,reliabilityEvidenceIds:[],adapted:false,adaptationStatus:'',permissionRequired:false,permissionResolved:false,available:false,scoreScale:null}
    if (key === 'design' && path[0] === 'questions') return { intent:'',priority:'',dataRequired:'',expectedOutput:'',population:spec.population,unitOfAnalysis:spec.unitOfAnalysis,geography:spec.geography }
    if (key === 'design' && path[0] === 'objectives') return { instrumentIds:[],expectedOutput:'',instrumentRequired:false,intent:null }
    if (key === 'design' && path[0] === 'constructs') return { kind:'',variableRole:null,measurementScale:null,operationalisation:'',justification:'',evidenceIds:[] }
    if (key === 'design' && path[0] === 'dataSources') return { answerableQuestionIds:[],population:spec.population,unitOfAnalysis:spec.unitOfAnalysis,geography:spec.geography,accessRationale:'' }
    if (key === 'design' && path[0] === 'analyses') return { method:'',constructIds:[],dataSourceIds:[],missingDataJustification:'',isPrimary:false }
    if (key === 'methodology' && path[0] === 'questions') return { longitudinal:false,requiredParticipantCharacteristics:[] }
    if (key === 'safeguards' && path[0] === 'analyses') return { observations:'',clusterAware:false,predictiveModel:false,interactionConstructIds:[],adjustmentConstructIds:[],groupComparison:'',missingData:{expectedItemMissingFraction:null,expectedUnitNonresponseFraction:null,mechanism:'Uncertain',assessment:'',strategy:'',assumptionRationale:'',sensitivity:''},temporalJustification:'',theoreticalJustification:'' }
    return detailTemplates[key]
  }
  const change = (path: (string | number)[], value: unknown) => onChange(replaceDesignDetail(spec, path, value))
  const fields = (record: DetailRecord, path: (string | number)[]): React.ReactNode => Object.entries(record).filter(([key]) => !protectedDetail(key)).map(([key,value]) => {
    const at = [...path,key], label = detailLabel(key), identity = at.join('.')
    const choices = choicesForDetail(record,path,key)
    if (key === 'primaryAnalysisId' || key === 'fromConstructId' || key === 'toConstructId') return <label key={identity} className="grid gap-1 text-sm">{key === 'primaryAnalysisId' ? 'Primary analysis' : label}<select className={input} value={String(value ?? '')} onChange={e => change(at,e.target.value || null)}><option value="">Choose an analysis</option>{(key === 'primaryAnalysisId' ? spec.analyses.map(a => ({id:a.id,text:a.method})) : spec.constructs.map(c => ({id:c.id,text:c.name}))).map(a => <option key={a.id} value={a.id}>{a.text}</option>)}</select></label>
    if (choices) return <label key={identity} className="grid gap-1 text-sm">{label}<select className={input} value={String(value ?? '')} onChange={e => change(at,e.target.value || null)}><option value="">Not specified</option>{choices.map(v => <option key={v} value={v}>{detailLabel(v)}</option>)}</select></label>
    if (typeof value === 'boolean') return <label key={identity} className="grid gap-1 text-sm">{label}<select className={input} value={String(value)} onChange={e => change(at,e.target.value === 'true')}><option value="false">No / not yet confirmed</option><option value="true">Yes</option></select></label>
    if (typeof value === 'number' || value === null && ['independentRepetitions','alpha','power','effect','proportion1','proportion2','allocationRatio','attritionRate','nonresponseRate','predictorCount','retentionMonths','expectedItemMissingFraction','expectedUnitNonresponseFraction'].includes(key)) return <label key={identity} className="grid gap-1 text-sm">{label}<input className={input} type="number" step="any" value={typeof value === 'number' ? value : ''} onChange={e => change(at,e.target.value === '' ? null : Number(e.target.value))} /></label>
    if (typeof value === 'string') return <ResearchField key={identity} label={label} value={value} onChange={v => change(at,v)} multiline />
    if (Array.isArray(value)) {
      if (key === 'sensitivity' || key === 'ethicsDecisions' || key === 'frameworkRelationships' || key === 'ethics') return <fieldset key={identity} className="space-y-3 border border-border rounded-lg p-3"><legend>{label}</legend>{value.map((v,i) => <div key={i} className="space-y-3">{fields(v as DetailRecord,[...at,i])}<Button type="button" variant="ghost" onClick={() => change(at,value.filter((_,index) => index !== i))}>Remove item {i+1}</Button></div>)}<Button type="button" variant="secondary" disabled={value.length >= 10} onClick={() => change(at,[...value,structuredClone(key === 'sensitivity' ? detailTemplates.parameters : key === 'ethicsDecisions' ? {type:'',plan:''} : key === 'ethics' ? {risk:'',mitigation:'',approvalPrerequisite:''} : {fromConstructId:null,toConstructId:null})])}>Add {key === 'sensitivity' ? 'sensitivity scenario' : key === 'ethicsDecisions' ? 'ethical safeguard' : key === 'ethics' ? 'ethical risk' : 'framework relationship'}</Button></fieldset>

      if (key.endsWith('Ids')) return <ResearchLinks key={identity} label={label} options={key === 'telemetrySourceIds' ? spec.dataSources.map(x => ({id:x.id,text:x.name})) : nodes} selected={value as string[]} onChange={v => change(at,v)} />
      if (value.every(v => typeof v === 'string')) return <ResearchField key={identity} label={`${label} (one per line)`} value={value.join('\n')} multiline onChange={v => change(at,v.split('\n').map(x => x.trim()).filter(Boolean))} />
      return <fieldset key={identity} className="space-y-4"><legend>{label}</legend>{value.map((v,i) => v && typeof v === 'object' ? <div key={i} className="space-y-3">{fields(v as DetailRecord,[...at,i])}</div> : null)}</fieldset>
    }
    if (value && typeof value === 'object') return <fieldset key={identity} className="space-y-3 rounded-lg border border-border p-4"><legend className="px-1 font-medium">{label}</legend>{fields(value as DetailRecord,at)}</fieldset>
    if (value === null && template(key,path)) return <div key={identity}><Button type="button" variant="secondary" onClick={() => change(at,structuredClone(template(key,path)!))}>Add {label.toLowerCase()}</Button><p className="mt-1 text-xs text-text-secondary">Enter your own information. Unconfirmed details remain unresolved.</p></div>
    return null
  })
  const raw = spec as unknown as DetailRecord
  const sections = ['questions','objectives','constructs','dataSources','analyses'] as const
  const design = (spec.study as unknown as DetailRecord | null)?.design as DetailRecord | undefined
  const sampling = spec.sampling as unknown as DetailRecord
  return <section className="space-y-5" aria-label="Study design details">
    <h3 className="font-semibold">Details needed to check your study</h3><p className="text-sm text-text-secondary">Review the findings below and complete the relevant details. Saving asks us to check your draft; it does not accept the design.</p>
    {spec.study && <PopulationDecisionsEditor value={spec.study.populationDescription} onChange={populationDescription => change(['study', 'populationDescription'], populationDescription)} />}
    {spec.study && <EligibilityDecisionsEditor study={spec.study} onChange={patch => onChange({ ...spec, study: { ...spec.study!, ...patch } })} />}
    <details open><summary className="font-medium cursor-pointer">What your study examines</summary><p className="mt-3 text-sm text-text-secondary">For software experiments, specify independent experimental units and conditions. Logs and token records are measurements, not separate experimental repetitions. Repetitions do not establish statistical power.</p><div className="mt-4 space-y-4">{fields({ subject: spec.study?.subject ?? null },['study'])}</div></details>
    <details open><summary className="font-medium cursor-pointer">Access, resources and ethical safeguards</summary><div className="mt-4 space-y-4">{design && fields(design,['study','design'])}</div></details>
    <details open><summary className="font-medium cursor-pointer">Sample planning</summary><div className="mt-4 space-y-4">{fields({designMetadata: sampling.designMetadata ?? null},['sampling'])}</div></details>
    {sections.map(section => <details key={section}><summary className="font-medium cursor-pointer">{detailLabel(section)}: measurement and analysis details</summary><div className="mt-4 space-y-4">{(raw[section] as DetailRecord[]).map((node,i) => <fieldset key={String(node.id)} className="space-y-3 rounded-lg border border-border p-4"><legend>{String(node.text ?? node.name ?? node.method ?? `Item ${i+1}`)}</legend>{fields(Object.fromEntries(['design','methodology','measurement','safeguards','adjustment'].filter(k => k in node || ['design','methodology','safeguards','measurement'].includes(k) && (k === 'design' || k === 'methodology' && ['questions','dataSources'].includes(section) || k === 'safeguards' && section === 'analyses' || k === 'measurement' && section === 'constructs')).map(k => [k,node[k] ?? null])),[section,i])}</fieldset>)}</div></details>)}
    <details><summary className="font-medium cursor-pointer">Instrument permissions and availability</summary><div className="mt-4 space-y-4">{(spec.study?.instruments ?? []).map((node,i) => <fieldset key={node.id} className="space-y-3"><legend>{node.text}</legend>{fields({design:(node as unknown as DetailRecord).design ?? null,safeguards:(node as unknown as DetailRecord).safeguards ?? null},['study','instruments',i])}</fieldset>)}</div></details>
  </section>
}

