import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EligibilityDecisionsEditor } from './EligibilityDecisionsEditor'
import type { StudySpecification } from '../../types/proposalWorkflow'

const study: StudySpecification = { schemaVersion:2,methodologySubtype:'',samplePlan:null,eligibility:[],instruments:[],budget:null,timeline:[],dataLifecycle:[],decisions:{},unresolvedNeeds:[] }
describe('Eligibility decision controls', () => {
  it('does not invent screening or decision rules for an existing study', () => {
    const html = renderToStaticMarkup(<EligibilityDecisionsEditor study={study} onChange={() => {}} />)
    expect(html).toContain('Define screening and eligibility logic')
    expect(study.eligibilityPlan).toBeUndefined()
  })
  it('keeps unknown verification and record permissions visibly undecided', () => {
    const plan = {allInclusionRequired:null,anyExclusionSufficient:null,alternativeRoutes:[],exclusionRule:null,unknownHandling:null,screeningProcedures:null,verification:null,recordAccessAuthorised:null,includesUnexposedParticipants:null,accommodations:[]}
    const html = renderToStaticMarkup(<EligibilityDecisionsEditor study={{...study,eligibilityPlan:plan}} onChange={() => {}} />)
    expect(html).toContain('Shared verification setting')
    expect(html).toContain('Is access to screening records authorised?')
    expect(html).toContain('<option value="" selected="">Not yet decided</option>')
  })
})
