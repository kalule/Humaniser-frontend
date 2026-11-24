// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BudgetCostEditor } from './BudgetCostEditor'

const content = '| Item | Quantity | Unit Cost | Line Total |\n|---|---|---|---|\n| Airtime | 200 | Not yet costed | Not yet costed |\n| Printing | 100 | 2.00 | 200.00 |'

describe('BudgetCostEditor', () => {
  afterEach(cleanup)

  it('shows the computed total and applies the costs the student types', async () => {
    const onApply = vi.fn().mockResolvedValue(true)
    render(<BudgetCostEditor content={content} stored={undefined} onApply={onApply} />)
    expect(screen.getByTestId('budget-total').textContent).toBe('200.00')
    fireEvent.click(screen.getByRole('button', { name: 'Add your costs' }))
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'ZAR' } })
    fireEvent.change(screen.getByLabelText('Unit cost of Airtime'), { target: { value: '1.5' } })
    expect(screen.getByTestId('budget-preview-total').textContent).toBe('ZAR 500.00')
    fireEvent.click(screen.getByRole('button', { name: 'Apply costs' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    const [written, costs] = onApply.mock.calls[0]
    expect(written).toContain('| Airtime | 200 | 1.50 | 300.00 |')
    expect(costs).toMatchObject({ currency: 'ZAR', lines: expect.arrayContaining([{ category: null, item: 'Airtime', unitCost: 1.5 }]) })
  })

  it('says "Add your costs" as the total when nothing is costed, and hides without a table', () => {
    render(<BudgetCostEditor content={'| Item | Quantity | Unit Cost | Line Total |\n|---|---|---|---|\n| Airtime | 200 | Not yet costed | Not yet costed |'} stored={undefined} onApply={vi.fn()} />)
    expect(screen.getByTestId('budget-total').textContent).toBe('Add your costs')
    cleanup()
    const { container } = render(<BudgetCostEditor content="No table." stored={undefined} onApply={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
