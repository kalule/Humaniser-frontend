import { describe, expect, it } from 'vitest'
import { isInformational, triageIssues } from './proposalIssueTriage'
import { issueLabel } from '../components/research-agent/FixIssuesPanel'
import type { ProposalIssue } from '../types/research'

const issue = (type: string, severity: 'Blocking' | 'Warning', sectionKey = '1.0'): ProposalIssue =>
  ({ type, severity, sectionKey, evidence: type + sectionKey, repairKind: 'HumanRequired', message: `${type} in ${sectionKey}` })

describe('triageIssues', () => {
  it('keeps notes out of the open count', () => {
    const t = triageIssues([
      issue('section_rule_abstract_optional', 'Warning', '0.0'),
      issue('quality_br58', 'Warning', 'document'),
      issue('quality_br56', 'Blocking', '5.11'),
      issue('section_rule_causal_wording', 'Warning', '1.0'),
    ])
    expect(t.openCount).toBe(2)
    expect(t.notes.map(n => n.type)).toEqual(['section_rule_abstract_optional', 'quality_br58'])
  })

  it('groups repeats of one check, in first-seen order, without dropping any', () => {
    const t = triageIssues([
      issue('section_rule_repetition', 'Warning', '1.2'),
      issue('section_rule_causal_wording', 'Warning', '3.2'),
      issue('section_rule_repetition', 'Warning', '3.3'),
      issue('section_rule_repetition', 'Warning', '5.7'),
    ])
    expect(t.review.map(g => [g.type, g.issues.length])).toEqual([['section_rule_repetition', 3], ['section_rule_causal_wording', 1]])
    expect(t.openCount).toBe(4)
  })

  it('never treats a blocking issue as a note', () => {
    expect(isInformational(issue('quality_br58', 'Blocking'))).toBe(false)
  })
})

describe('issueLabel for section rules', () => {
  it('names the section-rule checks', () => {
    expect(issueLabel('section_rule_circular_measurement')).toBe('Circular measurement')
    expect(issueLabel('section_rule_repetition')).toBe('Repeated sentence')
    expect(issueLabel('section_rule_abstract_r3')).toBe('Abstract')
    expect(issueLabel('section_rule_brand_new')).toBe('brand new')
  })
})
