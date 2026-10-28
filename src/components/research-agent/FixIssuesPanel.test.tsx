import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RepairResult, issueLabel } from './FixIssuesPanel'
import type { RepairReport } from '../../types/research'

const report: RepairReport = {
  runId: 'run-1',
  createdAt: '2026-10-11T08:00:00Z',
  fixed: [
    { repairId: 'r1', issueType: 'budget_total_mismatch', sectionKey: '6.2', description: 'Recomputed the budget arithmetic.', before: 'Total 10', after: 'Total 12', undone: false },
    { repairId: 'r2', issueType: 'citation_stray_year_suffix', sectionKey: '3.1', description: 'Changed (Kim, 2026a) to (Kim, 2026).', before: 'a', after: 'b', undone: true },
  ],
  needsUser: [
    { issue: { type: 'placeholder_citation_needed', severity: 'Blocking', sectionKey: '2.0', evidence: 'x', repairKind: 'HumanRequired', message: 'A claim has no supporting citation.' }, reason: 'This needs your decision; it is never filled in or guessed.' },
  ],
  unchangedSections: ['1.0', '5.1'],
  passes: 1, blockingRemaining: 1, skipped: false, skippedReason: null,
}

const render = (canJump: (k: string) => boolean) => renderToStaticMarkup(
  <RepairResult report={report} undoing={null} openDiff={null} onToggleDiff={() => {}} onUndo={() => {}} canJump={canJump} onJump={() => {}} />,
)

describe('RepairResult', () => {
  it('shows fixed, needs-attention and unchanged groups', () => {
    const html = render(() => true)
    expect(html).toContain('Fixed (2)')
    expect(html).toContain('Needs your attention (1)')
    expect(html).toContain('Unchanged (2)')
    expect(html).toContain('1.0, 5.1')
  })

  it('offers Undo only for a repair that has not been undone', () => {
    const html = render(() => true)
    expect(html.split('Undo</button>').length - 1).toBe(1)
    expect(html).toContain('Undone')
  })

  it('offers Jump only when the section has a step to jump to', () => {
    expect(render(() => true)).toContain('Jump to 2.0')
    expect(render(() => false)).not.toContain('Jump to 2.0')
  })

  it('never claims the document is validated', () => {
    expect(render(() => true)).toContain('does not validate the document for submission')
  })
})

describe('issueLabel', () => {
  it('labels known types, contradictions and unknown types readably', () => {
    expect(issueLabel('budget_total_mismatch')).toBe('Budget total')
    expect(issueLabel('contradiction_human_participants_study_claims_no_human_subjects')).toBe('Contradiction')
    expect(issueLabel('some_new_type')).toBe('some new type')
  })
})

describe('inline inputs', () => {
  const base = { severity: 'Warning' as const, sectionKey: '5.8', evidence: '[x]', repairKind: 'HumanRequired' as const, message: 'm' }

  it('offers a text box only for placeholders, and a year box only for an undated source', async () => {
    const { inlineInputFor } = await import('./FixIssuesPanel')
    expect(inlineInputFor({ ...base, type: 'placeholder_unresolved' })).toBe('placeholder')
    expect(inlineInputFor({ ...base, type: 'citation_matches_undated_source', literatureId: 'l1' })).toBe('year')
    expect(inlineInputFor({ ...base, type: 'citation_matches_undated_source' })).toBeNull()
    expect(inlineInputFor({ ...base, type: 'placeholder_citation_needed' })).toBeNull()
    expect(inlineInputFor({ ...base, type: 'citation_unresolved' })).toBeNull()
  })

  it('accepts only a plausible four-digit year', async () => {
    const { parseYear } = await import('./FixIssuesPanel')
    expect(parseYear('2026')).toBe(2026)
    expect(parseYear(' 1999 ')).toBe(1999)
    for (const bad of ['', '26', '20266', 'abcd', '1066', '2999', '2026a']) expect(parseYear(bad)).toBeNull()
  })

  it('exports the panel and labels the undated-source issue', async () => {
    const { FixIssuesPanel } = await import('./FixIssuesPanel')
    expect(typeof FixIssuesPanel).toBe('function')
    expect(issueLabel('citation_matches_undated_source')).toBe('Source has no year')
  })
})

describe('quality-rule labels', () => {
  it('labels the business-rule issue types readably', () => {
    expect(issueLabel('quality_br49')).toBe('Source concentration')
    expect(issueLabel('quality_br05')).toBe('Objective / question mapping')
    expect(issueLabel('quality_br02')).toBe('Unconfirmed study fact')
    expect(issueLabel('quality_br99')).toBe('Quality check')
  })
})
