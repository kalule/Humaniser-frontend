import { describe, expect, it } from 'vitest'
import { ADD_YOUR_COSTS, amount, applyBudget, parseBudget } from './budgetTable'
import { buildIssueReport } from './issueReport'

const budget = [
  'All figures in ZAR.',
  '',
  '| Category | Item | Unit | Quantity | Unit Cost | Line Total | Basis |',
  '|---|---|---|---|---|---|---|',
  '| Fieldwork | Printing | page | 400 | 1.50 | 999.00 | Quote |',
  '| Fieldwork | Travel | km | 300 | Not yet costed | Not yet costed | Rate to be confirmed |',
  '| **Subtotal** | | | | | **5.00** | |',
  '| **Total** | | | | | **5.00** | |',
  '',
  "The budget excludes the researcher's time.",
].join('\n')

describe('budget table (same rules as the server)', () => {
  it('reads the cost lines without the summary rows', () => {
    const lines = parseBudget(budget)!
    expect(lines.map(l => l.item)).toEqual(['Printing', 'Travel'])
    expect(lines[0]).toMatchObject({ quantity: 400, unitCost: 1.5 })
    expect(lines[1].unitCost).toBeNull()
    expect(parseBudget('No table here.')).toBeNull()
  })

  it('recomputes line totals, subtotal, contingency and total from the student costs', () => {
    const r = applyBudget(budget, { currency: 'ZAR', contingencyPercent: 10, lines: [{ category: 'Fieldwork', item: 'Travel', unitCost: 4.2 }] })
    expect(r.total).toBeCloseTo(2046)
    expect(r.content).toContain('| Fieldwork | Printing | page | 400 | 1.50 | 600.00 | Quote |')
    expect(r.content).toContain('| Fieldwork | Travel | km | 300 | 4.20 | 1,260.00 |')
    expect(r.content).toContain('| **Contingency (10%)** | | | | | **186.00** | |')
    expect(r.content).toContain('| **Total** | | | | | **2,046.00** | |')
    expect(r.content.endsWith("The budget excludes the researcher's time.")).toBe(true)
  })

  it('shows "Add your costs" instead of a zero total when nothing is costed', () => {
    const uncosted = '| Item | Quantity | Unit Cost | Line Total |\n|---|---|---|---|\n| Airtime | 200 | Not yet costed | Not yet costed |\n| **Total** | | | **0.00** |'
    const r = applyBudget(uncosted, null)
    expect(r.total).toBeNull()
    expect(r.content).toContain(`**${ADD_YOUR_COSTS}**`)
    expect(r.content).not.toContain('0.00')
  })

  it('parses only plain amounts', () => {
    expect(amount('R 1,200.50')).toBe(1200.5)
    expect(amount('500 ZAR')).toBe(500)
    expect(amount('1,000–2,000')).toBeNull()
    expect(amount('Not yet costed')).toBeNull()
  })
})

describe('issue report', () => {
  it('lists open issues by severity and dismissed ones apart, without claiming validation', () => {
    const text = buildIssueReport({
      blockingCount: 1, repairsAvailable: false, repairsUnavailableReason: null, notApplicable: ['section_rule_power_mismatch'],
      issues: [
        { type: 'section_rule_measurement_source_missing', severity: 'Blocking', sectionKey: '5.7', evidence: 'Construct B', repairKind: 'HumanRequired', message: 'Name the source.' },
        { type: 'section_rule_feasibility_risk', severity: 'Warning', sectionKey: '6.1', evidence: '', repairKind: 'HumanRequired', message: 'Tight timeline.' },
        { type: 'section_rule_repetition', severity: 'Warning', sectionKey: '1.0', evidence: 'x', repairKind: 'HumanRequired', message: 'Repeated.', dismissed: true },
      ],
    }, 'A study', new Date('2026-11-24T10:00:00Z'))
    expect(text).toContain('# Issue report: A study')
    expect(text).toContain('2 open issues (1 blocking, 1 to review), 1 dismissed.')
    expect(text).toContain('## Blocking (1)')
    expect(text).toContain('- **5.7** · measurement source missing: Name the source.')
    expect(text).toContain('## Dismissed after a repair attempt (1)')
    expect(text).toContain('not a validation')
    expect(text).toContain('Not applicable to this design: power mismatch.')
  })
})
