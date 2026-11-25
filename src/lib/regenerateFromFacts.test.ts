import { describe, expect, it } from 'vitest'
import { canRegenerateFromFacts, regenerationInstructions } from './regenerateFromFacts'
import type { ProposalIssue } from '../types/research'

const issue = (type: string, sectionKey = '5.6', extra: Partial<ProposalIssue> = {}): ProposalIssue => ({
  type, severity: 'Warning', sectionKey, evidence: 'x', repairKind: 'HumanRequired', message: 'The sample is people but the study has none.', ...extra,
})

describe('regenerate from facts (PR 13b)', () => {
  it('is offered for conflicts in a section, not for other checks, the whole document or dismissed issues', () => {
    expect(canRegenerateFromFacts(issue('section_rule_participant_language'))).toBe(true)
    expect(canRegenerateFromFacts(issue('contradiction_compensation', '5.11'))).toBe(true)
    expect(canRegenerateFromFacts(issue('section_rule_causal_wording'))).toBe(false)
    expect(canRegenerateFromFacts(issue('fact_conflict', 'document'))).toBe(false)
    expect(canRegenerateFromFacts(issue('section_rule_participant_language', '5.6', { dismissed: true }))).toBe(false)
  })

  it('asks for the corrected design from the facts and forbids narrating the conflict', () => {
    const text = regenerationInstructions(issue('section_rule_participant_language'))
    expect(text).toContain('The sample is people but the study has none.')
    expect(text).toContain('stored facts and study decisions')
    expect(text).toContain('Do not mention the conflict')
  })
})
