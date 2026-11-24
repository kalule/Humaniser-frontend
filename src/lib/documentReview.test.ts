import { describe, expect, it } from 'vitest'
import type { ProposalIssue } from '../types/research'
import { contractIssues, fromServerIssues, openIssueCount, placeholderIssues, runDocumentReview, variableRoleIssues } from './documentReview'

const s = (code: string, content: string) => ({ code, displayCode: code, title: `Section ${code}`, content, status: 'Draft' as const })

describe('placeholders', () => {
  it('finds TBD, internal field names (with or without a space), template tokens and draft banners', () => {
    const issues = placeholderIssues([
      s('5.7', 'Exposure is defined in (PrimaryExposure Definition) and (PrimaryExposureDefinition). Duration is TBD.'),
      s('6.2', 'DRAFT - not final\n\nCosts are {{budget_total}}.'),
      s('1.2', 'South Africa (South Africa) has many SMEs (Small Business Development).'),
    ])
    const texts = issues.map(i => i.evidence)
    expect(texts).toContain('(PrimaryExposure Definition)')
    expect(texts).toContain('(PrimaryExposureDefinition)')
    expect(texts).toContain('TBD')
    expect(texts).toContain('{{budget_total}}')
    expect(texts.some(t => t?.startsWith('DRAFT'))).toBe(true)
    expect(issues.filter(i => i.sectionCode === '1.2')).toEqual([])
    expect(issues.every(i => i.blocking && i.kind === 'placeholder')).toBe(true)
  })

  it('ignores the trailing References block', () => {
    expect(placeholderIssues([s('2.0', 'Body.\n\nReferences\n\nSmith, J. (n.d.) Title TBD.')])).toEqual([])
  })
})

describe('contract mismatches', () => {
  const doc = [
    s('5.2', 'An explanatory sequential design: a questionnaire survey followed by semi-structured interviews.'),
    s('5.5', 'A sample of 300 SMEs is required.'),
    s('5.8', 'Data are collected with a questionnaire and interviews by trained research assistants.'),
    s('5.10', 'Quantitative data are analysed in Stata and qualitative data in NVivo.'),
    s('6.1', 'Months 1-3: ethics. Months 4-6: survey fieldwork.'),
    s('6.2', 'Printing questionnaires: R2 000.'),
  ]
  const contract = { software: 'SPSS for the survey, NVivo for interviews', dataCollector: 'The researcher, personally', sampleSize: '384 SMEs' }

  it('flags software, collector and sample size that differ from the contract', () => {
    const issues = contractIssues(doc, contract)
    expect(issues.find(i => i.id.startsWith('ct:software:5.10:Stata'))?.message).toMatch(/names Stata/)
    expect(issues.some(i => i.id.startsWith('ct:software') && i.id.endsWith(':NVivo'))).toBe(false)
    expect(issues.find(i => i.id === 'ct:collector:5.8')?.evidence).toMatch(/research assistants/)
    expect(issues.find(i => i.id === 'ct:sample:5.5:300')).toBeDefined()
  })

  it('flags a method named in the design but missing from the timeline or budget', () => {
    const ids = contractIssues(doc, contract).map(i => i.id)
    expect(ids).toContain('ct:method:6.1:interviews')
    expect(ids).toContain('ct:method:6.2:interviews')
    expect(ids).not.toContain('ct:method:5.8:interviews')
    expect(ids).not.toContain('ct:method:6.1:a questionnaire survey')
  })

  it('says nothing about fields the contract leaves open', () => {
    expect(contractIssues(doc, {}).filter(i => !i.id.startsWith('ct:method'))).toEqual([])
  })
})

describe('variable roles', () => {
  it('flags an IV also listed as a control, mediator = moderator, and missing model terms', () => {
    const issues = variableRoleIssues([
      s('5.7', 'Digital adoption is the IV. Control variables include firm size and digital adoption.'),
      s('5.10', 'Multiple regression will be used.'),
    ], {
      independentVariables: 'Digital adoption', controls: 'Firm size, digital adoption', mediators: 'Process efficiency', moderators: 'Process efficiency, Firm age',
    })
    const ids = issues.map(i => i.id)
    expect(ids).toContain('vr:ivcontrol:Digital adoption')
    expect(ids).toContain('vr:medmod:Process efficiency')
    expect(ids).toContain('vr:text:Digital adoption')
    expect(ids).toContain('vr:mediation-term')
    expect(ids).toContain('vr:moderation-term')
  })

  it('accepts an analysis plan that has the matching terms', () => {
    const issues = variableRoleIssues([s('5.10', 'Mediation is tested via the indirect effect; moderation via an interaction term (adoption × size).')],
      { mediators: 'Efficiency', moderators: 'Size' })
    expect(issues).toEqual([])
  })
})

describe('server issues and merge', () => {
  const server = (type: string, sectionKey: string, severity: 'Blocking' | 'Warning', evidence = ''): ProposalIssue =>
    ({ type, severity, sectionKey, evidence, message: `${type} in ${sectionKey}`, repairKind: 'HumanRequired' })

  it('keeps only placeholder, contract and variable-role checks from the server', () => {
    const out = fromServerIssues([
      server('section_rule_software_conflict', '5.10', 'Warning'),
      server('section_rule_placeholder_token', '5.7', 'Blocking', '(PrimaryExposureDefinition)'),
      server('spelling', '1.0', 'Warning'),
      server('section_rule_process_note', '2.0', 'Warning'),
    ])
    expect(out.map(i => i.kind)).toEqual(['contract', 'placeholder', 'placeholder'])
    expect(out.find(i => i.sectionCode === '2.0')?.blocking).toBe(false) // advisory placeholder warning is listed, not counted
    expect(openIssueCount(out)).toBe(2)
  })

  it('lists a placeholder found by both the server and the client once, in document order', () => {
    const issues = runDocumentReview(
      [s('1.0', 'Fine.'), s('5.7', 'Uses (PrimaryExposureDefinition).')], {},
      [server('section_rule_placeholder_token', '5.7', 'Blocking', '(PrimaryExposureDefinition)'), server('section_rule_software_conflict', '1.0', 'Warning')],
    )
    expect(issues.filter(i => i.kind === 'placeholder')).toHaveLength(1)
    expect(issues.map(i => i.sectionCode)).toEqual(['1.0', '5.7'])
  })
})
