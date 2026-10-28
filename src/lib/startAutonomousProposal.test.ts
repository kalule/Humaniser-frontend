import { beforeEach, describe, expect, it, vi } from 'vitest'
import { researchApi } from '../api/research'
import { startAutonomousProposal } from './startAutonomousProposal'

vi.mock('../api/research', () => ({ researchApi: {
  confirmMethodology: vi.fn(), generateAutonomous: vi.fn(),
} }))

describe('autonomous proposal prerequisites', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not start generation before methodology confirmation completes', async () => {
    let confirm!: () => void
    vi.mocked(researchApi.confirmMethodology).mockImplementation(() => new Promise(resolve => {
      confirm = () => resolve({} as never)
    }))
    const result = { status: 'Starting' } as never
    vi.mocked(researchApi.generateAutonomous).mockResolvedValue(result)
    const pending = startAutonomousProposal('project-1', { methodologyType: 'Qualitative' }, 350)
    expect(researchApi.generateAutonomous).not.toHaveBeenCalled()
    confirm()
    expect(await pending).toBe(result)
    expect(researchApi.confirmMethodology).toHaveBeenCalledWith('project-1', { methodologyType: 'Qualitative' })
    expect(researchApi.generateAutonomous).toHaveBeenCalledWith('project-1', 350)
  })

  it('preserves a confirmation failure without enqueueing a job', async () => {
    const error = new Error('Methodology confirmation failed')
    vi.mocked(researchApi.confirmMethodology).mockRejectedValue(error)
    await expect(startAutonomousProposal('project-1', { methodologyType: 'Quantitative' }, 350)).rejects.toBe(error)
    expect(researchApi.generateAutonomous).not.toHaveBeenCalled()
  })
})
