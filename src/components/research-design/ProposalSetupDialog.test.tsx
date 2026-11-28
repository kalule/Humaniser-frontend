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
const EMPTY: Omit<ProposalIdeaCheckResult, 'available' | 'verdict'> = {
  topFixes: [], titleRewrite: null, parsed: null, assumptions: [], constructs: [], quality: [], feasibility: null, design: null, searchPlan: null,
}
const needsChanges: ProposalIdeaCheckResult = {
  ...EMPTY,
  available: true, verdict: 'proceed_with_changes',
  topFixes: ['Replace "effect of" with "relationship between".', 'Name one outcome measure.'],
  titleRewrite: 'The relationship between load-shedding and trading hours of small retailers in Gauteng',
  parsed: { exposure: 'Load-shedding', outcome: 'Trading hours', population: 'Small retailers', region: 'Gauteng', setting: 'Township retail' },
  assumptions: ['Assumed owner-managed shops with fewer than 50 staff.'],
  constructs: [{ name: 'Load-shedding', definition: 'Planned rotational power cuts.', synonyms: ['power cuts', 'rolling blackouts', 'outages'] }],
  quality: [
    { key: 'researchable', score: 2, reason: 'Retailers can report outages.' },
    { key: 'causal_wording', score: 1, reason: '"Effect of" implies causation.' },
  ],
  feasibility: { samplingFrame: 'Municipal trading licences.', access: 'Retail associations.', sampleSize: 'n = 150', ethics: 'Business data only.', ethicsComplexity: 'low' },
  design: { approach: 'Cross-sectional survey.', claimType: 'association', canClaim: 'Associations.', cannotClaim: 'That load-shedding caused the changes.' },
  searchPlan: { tiers: [{ tier: 1, purpose: 'Core', query: '("load-shedding" OR "power cuts") AND "small retailers"' }], include: ['Empirical studies'], exclude: ['Large firms'] },
}
const HEADLINE = 'This topic is workable with a few changes.'

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

  it('renders fixes, design and the full assessment, and the suggested title replaces the topic and clears the card', async () => {
    checkIdea.mockResolvedValue(needsChanges)
    const { topic } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(checkIdea).toHaveBeenCalledWith(IDEA, 'MASTERS', expect.any(AbortSignal))

    expect(await screen.findByText(HEADLINE)).toBeTruthy()
    expect(screen.getByText(needsChanges.topFixes[1])).toBeTruthy()
    expect(screen.getByText(/can show associations, but cannot show that load-shedding caused the changes/)).toBeTruthy()
    expect(screen.getByText('Needs work (1/2)')).toBeTruthy()
    expect(screen.getByText('Also: power cuts, rolling blackouts, outages')).toBeTruthy()
    expect(screen.getByText(needsChanges.searchPlan!.tiers[0].query)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: needsChanges.titleRewrite! }))
    expect(topic().value).toBe(needsChanges.titleRewrite)
    expect(screen.queryByText(HEADLINE)).toBeNull()
  })

  it('shows a positive line and no fixes or title for a topic ready to proceed', async () => {
    checkIdea.mockResolvedValue({ ...EMPTY, available: true, verdict: 'proceed' })
    const { topic } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(await screen.findByText('This topic looks ready to start.')).toBeTruthy()
    expect(screen.queryByText('Top fixes')).toBeNull()
    expect(screen.queryByText(/Suggested title/)).toBeNull()
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
    resolve(needsChanges)
    await new Promise(r => setTimeout(r, 0))
    expect(screen.queryByText(HEADLINE)).toBeNull()

    checkIdea.mockResolvedValue(needsChanges)
    fireEvent.click(checkLink())
    expect(await screen.findByText(HEADLINE)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'PhD' }))
    expect(screen.queryByText(HEADLINE)).toBeNull()
  })

  it('renders no card for an unavailable result, only a quiet line', async () => {
    checkIdea.mockResolvedValue({ ...EMPTY, available: false, verdict: 'unavailable' })
    const { topic } = renderDialog()
    type(topic(), IDEA)
    fireEvent.click(checkLink())
    expect(await screen.findByText('We could not check your idea just now. You can still start.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Idea check' })).toBeNull()
  })

  it('checks by itself once typing pauses, and reuses the result for the same text', async () => {
    checkIdea.mockResolvedValue(needsChanges)
    const { topic } = renderDialog()
    type(topic(), IDEA)
    expect(checkIdea).not.toHaveBeenCalled()
    expect(await screen.findByText(HEADLINE, {}, { timeout: 3000 })).toBeTruthy()
    expect(checkIdea).toHaveBeenCalledTimes(1)

    type(topic(), IDEA + ' and Limpopo')
    expect(screen.queryByText(HEADLINE)).toBeNull()
    type(topic(), IDEA)                                  // back to the checked wording: no second call
    expect(await screen.findByText(HEADLINE, {}, { timeout: 3000 })).toBeTruthy()
    expect(checkIdea).toHaveBeenCalledTimes(1)
  })

  it('does not retry a failed check in a loop', async () => {
    checkIdea.mockResolvedValue({ ...EMPTY, available: false, verdict: 'unavailable' })
    const { topic } = renderDialog()
    type(topic(), IDEA)
    expect(await screen.findByText(/could not check your idea/, {}, { timeout: 3000 })).toBeTruthy()
    await new Promise(r => setTimeout(r, 1800))
    expect(checkIdea).toHaveBeenCalledTimes(1)
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
