import type { EligibilityPlan, EligibilityPredicate, StudySpecification } from '../../types/proposalWorkflow'

const input = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm'
export function EligibilityDecisionsEditor({ study, onChange }: { study: StudySpecification; onChange: (patch: Partial<StudySpecification>) => void }) {
  const plan = study.eligibilityPlan
  const criteria = study.eligibility ?? []
  const patchPlan = (patch: Partial<EligibilityPlan>) => plan && onChange({ eligibilityPlan: { ...plan, ...patch } })
  const field = (label: string, value: string | null | undefined, change: (value: string) => void) => <label className="grid gap-1 text-sm">{label}<textarea className={input} value={value ?? ''} onChange={e => change(e.target.value)} /></label>
  const list = (label: string, values: string[], change: (values: string[]) => void) => <label className="grid gap-1 text-sm">{label} (one per line)<textarea className={input} value={values.join('\n')} onChange={e => change(e.target.value.split('\n'))} onBlur={e => change(e.target.value.split('\n').map(v => v.trim()).filter(Boolean))} /></label>
  const decision = (label: string, value: boolean | null, change: (value: boolean | null) => void) => <label className="grid gap-1 text-sm">{label}<select className={input} value={value === null ? '' : String(value)} onChange={e => change(e.target.value === '' ? null : e.target.value === 'true')}><option value="">Not yet decided</option><option value="true">Yes</option><option value="false">No</option></select></label>
  return <fieldset className="space-y-4 rounded-lg border border-border p-4"><legend className="px-1 font-medium">Eligibility criteria and screening</legend>
    <p className="text-sm text-text-secondary">Record the conditions you have decided, how they will be screened, and the decision rules. Saving a draft does not confirm undecided items. Consent and response-quality rules should usually be recorded in their own sections.</p>
    {criteria.map((criterion, index) => {
      const change = (patch: Partial<EligibilityPredicate>) => onChange({ eligibility: criteria.map((row, i) => i === index ? { ...row, ...patch } : row) })
      const details = criterion.details
      const detail = (patch: Partial<NonNullable<EligibilityPredicate['details']>>) => change({ details: { requiresRecordAccess: false, ...details, ...patch } })
      return <fieldset key={index} className="space-y-3 border-t border-border pt-3"><legend className="font-medium text-sm">Criterion {index + 1}</legend>
        <div className="grid gap-3 md:grid-cols-2">{field('Characteristic', criterion.field, value => change({ field: value }))}
          <label className="grid gap-1 text-sm">Condition<select className={input} value={criterion.operator} onChange={e => change({ operator: e.target.value })}>{[['eq','Equals'],['in','One of'],['gte','At least'],['lte','At most']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {field('Accepted value or threshold', criterion.value, value => change({ value }))}{field('Unit or reference period', criterion.unit, value => change({ unit: value }))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={criterion.exclusion} onChange={e => change({ exclusion: e.target.checked })} />Exclusion criterion</label>
        <details><summary className="cursor-pointer text-sm">Group, operational definition and screening</summary><div className="mt-3 space-y-3">
          {field('Group or phase (optional)', details?.group, value => detail({ group: value || null }))}
          {field('Operational definition (optional for an already precise condition)', details?.operationalDefinition, value => detail({ operationalDefinition: value || null }))}
          {field('Screening method (leave blank to use the shared procedure)', details?.screeningMethod, value => detail({ screeningMethod: value || null }))}
          <label className="grid gap-1 text-sm">Verification<select className={input} value={details?.verification ?? ''} onChange={e => detail({ verification: e.target.value as 'SelfReported' | 'Verified' || null })}><option value="">Use shared setting</option><option value="SelfReported">Self-reported</option><option value="Verified">Independently verified</option></select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={details?.requiresRecordAccess ?? false} onChange={e => detail({ requiresRecordAccess: e.target.checked })} />Verification requires access to records</label>
          {field('Accepted rationale (optional)', details?.rationale, value => detail({ rationale: value || null }))}
        </div></details>
        <button type="button" className="text-sm text-red-600" onClick={() => onChange({ eligibility: criteria.filter((_, i) => i !== index) })}>Remove criterion {index + 1}</button>
      </fieldset>
    })}
    <button type="button" className="text-sm font-medium text-violet-700" onClick={() => onChange({ eligibility: [...criteria, { field:'',operator:'eq',value:'',unit:'',exclusion:false }] })}>Add criterion</button>
    {plan ? <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Screening and decision rules</legend>
      {(criteria.some(c => c.details?.group) || plan.groupLogic) && field('Approved rules for separate groups or phases (replaces shared decision rules)', plan.groupLogic, groupLogic => patchPlan({ groupLogic: groupLogic || null }))}
      {!plan.groupLogic?.trim() && <>
        {decision('Must all inclusion criteria be met?', plan.allInclusionRequired, allInclusionRequired => patchPlan({ allInclusionRequired }))}
        {plan.allInclusionRequired === false && list('Approved alternative eligibility routes', plan.alternativeRoutes, alternativeRoutes => patchPlan({ alternativeRoutes }))}
        {criteria.some(c => c.exclusion) && <>{decision('Is any exclusion criterion sufficient for exclusion?', plan.anyExclusionSufficient, anyExclusionSufficient => patchPlan({ anyExclusionSufficient }))}{plan.anyExclusionSufficient === false && field('Approved exclusion decision rule', plan.exclusionRule, exclusionRule => patchPlan({ exclusionRule }))}</>}
      </>}
      {field('Approved screening procedure', plan.screeningProcedures, screeningProcedures => patchPlan({ screeningProcedures }))}
      <label className="grid gap-1 text-sm">Shared verification setting<select className={input} value={plan.verification ?? ''} onChange={e => patchPlan({ verification: e.target.value as EligibilityPlan['verification'] || null })}><option value="">Not yet decided</option><option value="SelfReported">Self-reported</option><option value="Verified">Independently verified</option></select></label>
      {decision('Is access to screening records authorised?', plan.recordAccessAuthorised, recordAccessAuthorised => patchPlan({ recordAccessAuthorised }))}
      {decision('Are participants without prior exposure included?', plan.includesUnexposedParticipants, includesUnexposedParticipants => patchPlan({ includesUnexposedParticipants }))}
      {field('Handling of unknown eligibility information (optional)', plan.unknownHandling, unknownHandling => patchPlan({ unknownHandling: unknownHandling || null }))}
      {list('Accepted accommodations', plan.accommodations, accommodations => patchPlan({ accommodations }))}
    </fieldset> : <button type="button" className="text-sm font-medium text-violet-700" onClick={() => onChange({ eligibilityPlan: { allInclusionRequired:null,anyExclusionSufficient:null,alternativeRoutes:[],exclusionRule:null,unknownHandling:null,screeningProcedures:null,verification:null,recordAccessAuthorised:null,includesUnexposedParticipants:null,accommodations:[] } })}>Define screening and eligibility logic</button>}
  </fieldset>
}
