import { describe, expect, it } from 'vitest'
import type { ResearchSpecification } from '../types/proposalWorkflow'
import { choicesForDetail, designDetailErrors, protectedDetail, replaceDesignDetail } from './researchDesignDetails'
const draft = () => ({ title: 'Study', questions: [{id:'q',text:'Question',design:{intent:'Associate',priority:'Primary'}}], objectives:[{id:'o',type:'Specific'}], analyses:[{id:'a',method:'Pearson correlation',design:{method:'Correlation'}}], sampling:{designMetadata:{method:'Correlation',parameters:null}}, study:{design:{$family:'Quantitative',design:'Correlational',evidenceNeeds:[{status:'Unresolved'}]}} } as unknown as ResearchSpecification)
describe('Structured design clarification', () => {
  it('keeps undecided population access and frame status without changing the accepted design', () => {
    const original = draft()
    const next = replaceDesignDetail(original, ['study','populationDescription'], { accessStatus:'NotDecided',samplingFrameDocumented:null,recordedCharacteristics:[] })
    expect(next.study?.populationDescription?.samplingFrameDocumented).toBeNull()
    expect(next.study?.design).toEqual(original.study?.design)
    expect(original.study?.populationDescription).toBeUndefined()
    expect(designDetailErrors(next)).toEqual([])
  })
  it('flags conflicting roles for a recorded population characteristic', () => {
    const spec = draft()
    spec.study!.eligibility = [{field:' GENDER ',operator:'eq',value:'female',unit:'',exclusion:false}]
    spec.study!.populationDescription = {accessStatus:'Proposed',samplingFrameDocumented:null,recordedCharacteristics:[{name:'gender',categoryLabels:['female','male']}]}
    expect(designDetailErrors(spec)).toContain('gender cannot be both recorded-only and eligibility-defining.')
  })
  it('distinguishes study subject from construct kind', () => {
    expect(choicesForDetail({},['study','subject'],'kind')).toContain('SoftwareSystemExperiment')
    expect(choicesForDetail({},['constructs',0,'design'],'kind')).not.toContain('SoftwareSystemExperiment')
  })
  it('preserves experiment details and canonical IDs on edits', () => {
    const original = draft()
    original.study!.subject = {kind:'SoftwareSystemExperiment',confirmed:false,experiment:{experimentalUnit:'Execution trial',conditions:['baseline','fenced'],independentRepetitions:null,independenceRationale:'',telemetrySourceIds:['s1'],allocationPlan:''}}
    const next = replaceDesignDetail(original,['study','subject','experiment','independentRepetitions'],10)
    expect(next.study?.subject?.experiment?.independentRepetitions).toBe(10)
    expect(original.study?.subject?.experiment?.independentRepetitions).toBeNull()
    expect(next.questions).toEqual(original.questions)
    expect(next.study?.subject?.experiment?.telemetrySourceIds).toEqual(['s1'])
  })
  it('preserves stable IDs and evidence while editing an independent copy', () => {
    const original = draft(), next = replaceDesignDetail(original,['title'],'Revised')
    expect(original.title).toBe('Study'); expect(next.questions).toEqual(original.questions)
    expect(next.study).toEqual(original.study); expect(next).not.toBe(original)
  })
  it('does not treat legacy objective types or free-text analysis as closed enums', () => { expect(designDetailErrors(draft())).toEqual([]) })
  it('requires a selected typed method instead of inventing a default', () => { expect(designDetailErrors(replaceDesignDetail(draft(),['sampling','designMetadata','method'],null))).toContain('Choose method in Sampling.') })
  it('rejects missing required numeric JSON values', () => { const s=replaceDesignDetail(draft(),['sampling','designMetadata','parameters'],{alpha:null,power:.8,allocationRatio:1,attritionRate:0,nonresponseRate:0}); expect(designDetailErrors(s)).toContain('Enter alpha for sample planning.') })
  it('rejects nonfinite numeric values', () => { expect(designDetailErrors(replaceDesignDetail(draft(),['totalWords'],NaN))).toContain('Total Words must be a finite number.') })
  it('leaves methodological compatibility to the server', () => { const s=replaceDesignDetail(draft(),['analyses',0,'design','method'],'ThematicAnalysis'); expect(designDetailErrors(s)).toEqual([]) })
  it('hides authority and evidence fields from generic editing', () => { for(const key of ['id','$family','schemaVersion','evidenceNeeds','evidenceDecisions','validationEvidenceIds','claimsValidated']) expect(protectedDetail(key)).toBe(true) })
  it('uses mixed priority options only within mixed safeguards', () => { expect(choicesForDetail({},['study','design','safeguards','mixed'],'priority')).toEqual(['Equal','Quantitative','Qualitative']) })
})

