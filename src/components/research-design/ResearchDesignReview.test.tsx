import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResearchDesignReview } from './ResearchDesignReview'
import { ResearchDesignQuestion } from './ResearchDesignQuestion'
import fixture from './fixtures/lms-design.json'
import type { ResearchDesignView } from '../../types/researchDesign'
const view = fixture as ResearchDesignView
describe('Research Design review and clarification', () => {
  it('shows experiment units and conditions separately from systems in scope', () => {
    const html = renderToStaticMarkup(<ResearchDesignReview view={{...view,subject:{kind:'SoftwareSystemExperiment',confirmed:true,experiment:{experimentalUnit:'Execution trial',conditions:['baseline','fenced'],independentRepetitions:10,independenceRationale:'Fresh independently assigned trials',telemetrySourceIds:[],allocationPlan:'Randomized order'}}}} />)
    expect(html).toContain('Systems in scope'); expect(html).toContain('Experimental unit')
    expect(html).toContain('Execution trial'); expect(html).toContain('baseline, fenced')
    expect(html).toContain('Repetitions and telemetry counts do not establish sample adequacy.')
  })
  it('does not claim there are no issues when budget stopped validation', () => {const html=renderToStaticMarkup(<ResearchDesignReview view={{...view,status:'BudgetExhausted',findings:[],readiness:{...view.readiness,status:'NotAssessed'}}}/>);expect(html).toContain('Design checks have not completed yet.');expect(html).not.toContain('No issues reported.')})
  it('distinguishes the remaining problem from population in older saved runs', () => { const html = renderToStaticMarkup(<ResearchDesignQuestion question={{ id:'saved-question',question:'Specify the research problem and eligible target population.',reason:'Scope',field:'ResearchProblem',valueType:'Text',answerable:true,maxLength:4000 }} busy={false} onSubmit={()=>{}} />); expect(html).toContain('What specific research problem will your study address?'); expect(html).toContain('Your study target was saved separately.'); expect(html).not.toContain('Specify the research problem and eligible target population.') })
  it('presents LMS alignment using canonical labels, not identifiers or invented aligned certification', () => { const html = renderToStaticMarkup(<ResearchDesignReview view={view} />); expect(html).toContain('Usability and satisfaction scores'); expect(html).toContain('Association estimate with uncertainty'); expect(html).not.toContain('Question: q1'); expect(html).not.toContain('100%') })
  it('keeps alternatives secondary and shows trade-offs', () => { const html = renderToStaticMarkup(<ResearchDesignReview view={view} />); expect(html).toContain('<details'); expect(html).toContain('Compare alternatives'); expect(html).toContain('Requires more time') })
  it('reports conflicting support and limitations without inventing citations', () => { const html = renderToStaticMarkup(<ResearchDesignReview view={{ ...view, evidence: [{ ...view.evidence[0], contradictionPresent: true }] }} />); expect(html).toContain('Evidence is mixed'); expect(html).toContain('Transferability'); expect(html).not.toContain('doi.org') })
  it('keeps unsupported specialist questions visible without a submit action', () => { const html = renderToStaticMarkup(<ResearchDesignQuestion question={{ id: 'q', question: 'Review primary analysis', reason: 'Method needs review', field: null, valueType: 'Unknown', answerable: false, maxLength: null }} busy={false} onSubmit={() => {}} />); expect(html).toContain('needs review'); expect(html).not.toContain('Continue') })
  it('renders typed boolean choices including no, not a free-text patch', () => { const html = renderToStaticMarkup(<ResearchDesignQuestion question={{ id: 'q', question: 'Confirm access', reason: 'Feasibility', field: 'ResearchAccess', valueType: 'AccessConfirmation', answerable: true, maxLength: null }} busy={false} onSubmit={() => {}} />); expect(html.match(/<select/g)).toHaveLength(3); expect(html).toContain('value="no"'); expect(html).not.toContain('<textarea') })
  it('gives contextual answers a labelled bounded textarea', () => { const html = renderToStaticMarkup(<ResearchDesignQuestion question={{ id: 'q', question: 'What is the problem?', reason: 'Scope', field: 'ResearchProblem', valueType: 'Text', answerable: true, maxLength: 4000 }} busy={false} onSubmit={() => {}} />); expect(html).toContain('maxLength="4000"'); expect(html).toContain('aria-describedby="question-reason"'); expect(html).toContain('for="design-answer"') })
})
