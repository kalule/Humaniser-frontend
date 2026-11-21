// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AutonomousProposalModal } from './AutonomousProposalTools'

// Audit 2026-11-21 (P2): the Automated flow confirmed only the methodology type, so every methodology chapter was written
// with data collection unknown. It now requires how data will be collected and passes it to the confirmation.

afterEach(cleanup)

describe('AutonomousProposalModal data collection', () => {
  it('requires how data will be collected before generating, and passes it on', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<AutonomousProposalModal initialTitle="The effect of load-shedding on small retailers in Gauteng" onClose={() => {}} onCreate={onCreate} />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    const generate = () => screen.getByRole('button', { name: /Generate Proposal/ }) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText(/Research approach/), { target: { value: 'Quantitative' } })
    expect(generate().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/How data will be collected/), {
      target: { value: 'Software, system runs or simulation (no participants)' },
    })
    expect(generate().disabled).toBe(false)
    fireEvent.click(generate())
    await vi.waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      methodologyType: 'Quantitative',
      dataCollectionApproach: 'Software, system runs or simulation (no participants)',
    })
  })
})
