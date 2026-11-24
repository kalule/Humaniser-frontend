// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../api/qualityReport', () => ({
  getQualityReport: vi.fn(async () => ({
    version: 'quality-estimate.v1', total: 52, rawTotal: 67.1, dismissedCount: 1, notApplicable: [],
    criteria: [{ id: 'methodology', label: 'Methodology', score: 7.5, max: 25, issues: 33 }, { id: 'framework', label: 'Conceptual framework', score: 10, max: 10, issues: 0 }],
    failedChecks: [
      { type: 'section_rule_causal_wording', severity: 'Blocking', sectionKey: '1.0', evidence: 'x', repairKind: 'HumanRequired', message: 'Causal wording.' },
      { type: 'quality_br20', severity: 'Warning', sectionKey: '6.1', evidence: 'y', repairKind: 'HumanRequired', message: 'Timeline.' },
    ],
    calibration: { examples: 6, meanAbsError: 3.8, leaveOneOutError: 4.5, rankCorrelation: 0.67, note: 'Estimated from the automatic checks, not marked.' },
  })),
}))

import { QualityReportCard } from './QualityReportCard'

describe('QualityReportCard (PR 11)', () => {
  afterEach(cleanup)

  it('shows the estimate, the criteria, that it is not a mark, and the failed checks on request', async () => {
    render(<QualityReportCard projectId="p1" />)
    expect((await screen.findByTestId('quality-total')).textContent).toBe('52')
    expect(screen.getByText('Estimated from the automatic checks, not marked.')).toBeTruthy()
    expect(screen.getByText('7.5 / 25')).toBeTruthy()
    expect(screen.getByText(/1 blocking and 1 to review, 1 dismissed/)).toBeTruthy()
    expect(screen.queryByLabelText('Failed checks')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show failed checks' }))
    expect(screen.getByLabelText('Failed checks').textContent).toContain('Causal wording.')
  })
})
