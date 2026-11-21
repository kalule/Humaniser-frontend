// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ProposalIdeaCheckResult } from '../../api/research'

const checkIdea = vi.fn<(topic: string, level: string, signal?: AbortSignal) => Promise<ProposalIdeaCheckResult>>()

vi.mock('../../api/research', async importOriginal => {
  const actual = await importOriginal<typeof import('../../api/research')>()
  return { ...actual, researchApi: { ...actual.researchApi, checkProposalIdea: (t: string, l: string, s?: AbortSignal) => checkIdea(t, l, s) } }
})

const { START_MODES, ProposalSetupDialog } = await import('./ProposalSetupDialog')

const IDEA = 'The effect of load-shedding on small retailers in Gauteng'
const tooBroad: ProposalIdeaCheckResult = {
  available: true, verdict: 'too_broad', evidenceHint: null,
  reasons: ['It covers every kind of retailer in a whole province.'],
  rewrites: ['How did load-shedding affect trading hours of spaza shops in Soweto?', 'How do small grocers in Tshwane cope with load-shedding?'],
}

function renderDialog(onCreate = vi.fn().mockResolvedValue(undefined), onAutomate = vi.fn()) {
  render(<StrictMode><ProposalSetupDialog onClose={() => {}} onCreate={onCreate} onAutomate={onAutomate} /></StrictMode>)
  return { onCreate, onAutomate, topic: () => screen.getByLabelText('Research topic or idea') as HTMLTextAreaElement }
}
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const checkLink = () => screen.getByRole('button', { name: 'Check my idea' }) as HTMLButtonElement
const startButton = () => screen.getByRole('button', { name: 'Start writing' }) as HTMLButtonElement

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ProposalSetupDialog', () => {
  it('offers exactly a manual proposal and an automated proposal, with no study-design step', () => {
    expect(START_MODES.map(m => m.value)).toEqual(['manual', 'automated'])
    expect(START_MODES.some(m => /design/i.test(m.title + m.hint))).toBe(false)
  })

  it('names modes by how much the student writes, with an action label per mode and Guided recommended', () => {
    expect(START_MODES.map(m => [m.title, m.action])).toEqual([['Guided', 'Start writing'], ['Automated', 'Generate proposal']])
    expect(START_MODES.filter(m => m.recommended).map(m => m.value)).toEqual(['manual'])
  })
})

describe('ProposalSetupDialog idea check', () => {
  it('keeps the link disabled for short topics', () => {
    const { topic } = renderDialog()
    expect(checkLink().disabled).toBe(true)
    type(topic(), 'Too short idea')             // 14 characters
    expect(checkLink().disabled).toBe(true)
    type(topic(), 'Load-shedding retail')
    expect(checkLink().disabled).toBe(false)
  })

  it('renders reasons and rewrite chips, and a chip replaces the topic and clears the card', async () => {
    checkIdea.mockResolvedValue(tooBroad)
    const { topic } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(checkIdea).toHaveBeenCalledWith(IDEA, 'MASTERS', expect.any(AbortSignal))

    expect(await screen.findByText('This may be too broad for a Masters study.')).toBeTruthy()
    expect(screen.getByText(tooBroad.reasons[0])).toBeTruthy()
    const chip = screen.getByRole('button', { name: tooBroad.rewrites[0] })
    fireEvent.click(chip)
    expect(topic().value).toBe(tooBroad.rewrites[0])
    expect(screen.queryByText('This may be too broad for a Masters study.')).toBeNull()
  })

  it('shows only a short positive line for a ready idea', async () => {
    checkIdea.mockResolvedValue({ available: true, verdict: 'ready', reasons: [], rewrites: [], evidenceHint: null })
    const { topic } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(await screen.findByText('This looks ready to start.')).toBeTruthy()
    expect(screen.queryByText(/sharper version/)).toBeNull()
  })

  it('hides a stale result when the topic changes, and drops a late answer for old text', async () => {
    let resolve!: (r: ProposalIdeaCheckResult) => void
    checkIdea.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const { topic } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(await screen.findByText('Checking your idea…')).toBeTruthy()
    const signal = checkIdea.mock.calls[0][2]!

    type(topic(), IDEA + ' and Limpopo')
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('Checking your idea…')).toBeNull()
    resolve(tooBroad)
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByText('This may be too broad for a Masters study.')).toBeNull()

    checkIdea.mockResolvedValue(tooBroad)
    fireEvent.click(checkLink())
    expect(await screen.findByText('This may be too broad for a Masters study.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'PhD' }))
    expect(screen.queryByText(/too broad/)).toBeNull()
  })

  it('renders no card for an unavailable result, only a quiet line', async () => {
    checkIdea.mockResolvedValue({ available: false, verdict: 'unavailable', reasons: [], rewrites: [], evidenceHint: null })
    const { topic } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(await screen.findByText('We could not check your idea just now. You can still start.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Idea check' })).toBeNull()
  })

  it('lets Start go ahead while a check is still running', async () => {
    checkIdea.mockImplementation(() => new Promise(() => {}))
    const { topic, onCreate } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(await screen.findByText('Checking your idea…')).toBeTruthy()
    expect(startButton().disabled).toBe(false)
    fireEvent.click(startButton())
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ topic: IDEA, academicLevel: 'MASTERS', citationStyle: 'harvard' }))
  })
})
