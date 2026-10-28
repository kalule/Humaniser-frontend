import { describe, expect, it, vi } from 'vitest'
import type { GenerationStatus, ResearchProject } from '../types/research'
import { recoverProposalGeneration, shouldRecoverGeneration } from './proposalGenerationRecovery'

const status = (overrides: Partial<GenerationStatus> = {}): GenerationStatus => ({
  status: 'Completed', completedCount: 20, totalCount: 20,
  currentSection: null, wordsWritten: 6000, failedCount: 0, ...overrides,
})
const project = (id: string, updatedAt: string, overrides: Partial<ResearchProject> = {}) =>
  ({ id, updatedAt, generatorMode: 'AGENT', documentMode: 'PROPOSAL', ...overrides } as ResearchProject)

describe('proposal generation recovery', () => {
  it('keeps review visible with every section written, even after dismissal', () => {
    expect(shouldRecoverGeneration(status({ status: 'NeedsReview' }), 'NeedsReview|20')).toBe(true)
  })
  it('does not resurrect a successfully generated draft', () => {
    expect(shouldRecoverGeneration(status(), null)).toBe(false)
  })
  it('recovers completed runs with failed sections', () => {
    expect(shouldRecoverGeneration(status({ failedCount: 1 }), null)).toBe(true)
  })
  it('respects dismissal of an unchanged incomplete terminal result', () => {
    expect(shouldRecoverGeneration(status({ status: 'Error', completedCount: 5 }), 'Error|5')).toBe(false)
    expect(shouldRecoverGeneration(status({ status: 'Error', completedCount: 6 }), 'Error|5')).toBe(true)
  })
  it('reattaches active generation regardless of dismissal', () => {
    expect(shouldRecoverGeneration(status({ status: 'Generating' }), 'Generating|20')).toBe(true)
  })
  it('finds an older running job behind a newer review or completed draft', async () => {
    const projects = [project('older', '2026-10-01'), project('newer', '2026-10-02')]
    const getStatus = vi.fn(async (id: string) => status({ status: id === 'older' ? 'Generating' : 'NeedsReview' }))
    const result = await recoverProposalGeneration(projects, getStatus, () => null)
    expect(result?.project.id).toBe('older')
    expect(projects[0].id).toBe('older')
  })
  it('continues when the newest project status is unavailable', async () => {
    const getStatus = vi.fn(async (id: string) => {
      if (id === 'newer') throw new Error('Unavailable')
      return status({ status: 'NeedsReview' })
    })
    const result = await recoverProposalGeneration([
      project('older', '2026-10-01'), project('newer', '2026-10-02'),
    ], getStatus, () => null)
    expect(result?.project.id).toBe('older')
  })
  it('does not query guided projects or dissertations', async () => {
    const getStatus = vi.fn()
    expect(await recoverProposalGeneration([
      project('guided', '2026-10-01', { generatorMode: 'GENERATOR' }),
      project('thesis', '2026-10-02', { documentMode: 'DISSERTATION' }),
    ], getStatus, () => null)).toBeNull()
    expect(getStatus).not.toHaveBeenCalled()
  })
})
