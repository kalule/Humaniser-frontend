import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResearchDesignDetailsEditor } from './ResearchDesignDetailsEditor'
import type { ResearchSpecification } from '../../types/proposalWorkflow'
const spec = {population:'Students',unitOfAnalysis:'Student',geography:'Campus',questions:[],objectives:[],constructs:[],dataSources:[],analyses:[],sampling:{designMetadata:null},study:{design:{$family:'Quantitative',design:'Correlational',safeguards:null,evidenceNeeds:[{id:'private-evidence',reason:'Private provenance'}]},instruments:[{id:'private-instrument',text:'Study questionnaire',design:null,safeguards:null}]}} as unknown as ResearchSpecification
describe('Study details presentation', () => {
 it('makes absent sample metadata editable without creating assumptions', () => {const html=renderToStaticMarkup(<ResearchDesignDetailsEditor spec={spec} onChange={()=>{}}/>);expect(html).toContain('Add design metadata');expect(html).toContain('Unconfirmed details remain unresolved.')})
 it('offers permission and metadata input for instruments with missing safeguards', () => {const html=renderToStaticMarkup(<ResearchDesignDetailsEditor spec={spec} onChange={()=>{}}/>);expect(html).toContain('Study questionnaire');expect(html).toContain('Add safeguards');expect(html).toContain('Add design')})
 it('protects evidence provenance and hides technical IDs', () => {const html=renderToStaticMarkup(<ResearchDesignDetailsEditor spec={spec} onChange={()=>{}}/>);expect(html).not.toContain('private-evidence');expect(html).not.toContain('Private provenance');expect(html).not.toContain('private-instrument')})
 it('explains that saving is separate from accepting', () => {const html=renderToStaticMarkup(<ResearchDesignDetailsEditor spec={spec} onChange={()=>{}}/>);expect(html).toContain('it does not accept the design');expect(html).not.toContain('Accept research design')})
})
