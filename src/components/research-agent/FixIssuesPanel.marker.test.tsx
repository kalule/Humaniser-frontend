// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { inlineInputFor } from './FixIssuesPanel'
import type { ProposalIssue } from '../../types/research'

const marker = (type: string, extra: Partial<ProposalIssue> = {}): ProposalIssue => ({
  type, severity: 'Blocking', sectionKey: '5.11', evidence: 'The status of ethics approval is not yet confirmed.',
  repairKind: 'HumanRequired', message: 'Open point.', ...extra,
})

describe('unresolved markers in Fix issues (PR 12b)', () => {
  afterEach(() => undefined)

  it('offers the decided-sentence form for open points, not for other checks or dismissed ones', () => {
    expect(inlineInputFor(marker('section_rule_unresolved_wording'))).toBe('marker')
    expect(inlineInputFor(marker('section_rule_decision_needed'))).toBe('marker')
    expect(inlineInputFor(marker('section_rule_unresolved_wording', { dismissed: true }))).toBeNull()
    expect(inlineInputFor(marker('section_rule_causal_wording'))).toBeNull()
  })
})
