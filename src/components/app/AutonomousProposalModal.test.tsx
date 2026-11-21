// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AutonomousProposalModal } from './AutonomousProposalTools'

// The Automated flow must not ask again for the topic and level the student already gave in "Start your proposal".

afterEach(cleanup)

const TOPIC = 'The effect of load-shedding on small retailers in Gauteng'

describe('AutonomousProposalModal', () => {
  it('shows the carried-over topic and level as a summary instead of asking for them again', () => {
    render(<AutonomousProposalModal initialTitle={TOPIC} initialLevel="PHD" onClose={() => {}} onCreate={vi.fn()} />)

    expect(screen.getByTestId('carried-over-basics')).toBeTruthy()
    expect(screen.getByText(TOPIC)).toBeTruthy()
    expect(screen.getByText(/Level: PhD/)).toBeTruthy()
    expect(screen.queryByPlaceholderText(/Impact of AI on Healthcare/)).toBeNull()
  })

  it('lets the student change the carried-over topic', () => {
    render(<AutonomousProposalModal initialTitle={TOPIC} onClose={() => {}} onCreate={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Change' }))

    const input = screen.getByPlaceholderText(/Impact of AI on Healthcare/) as HTMLInputElement
    expect(input.value).toBe(TOPIC)
  })

  it('asks for the topic when nothing was carried over', () => {
    render(<AutonomousProposalModal onClose={() => {}} onCreate={vi.fn()} />)

    expect(screen.queryByTestId('carried-over-basics')).toBeNull()
    expect(screen.getByPlaceholderText(/Impact of AI on Healthcare/)).toBeTruthy()
  })
})
