import { describe, expect, it, vi } from 'vitest'
import type { GenerationPhase, GenerationStatus } from '../types/research'
import { autonomousStatusBadge, resumeOnOpen } from './proposalResume'

const checkpoint = (status: GenerationPhase): GenerationStatus => ({
  status, completedCount: 7, totalCount: 25, currentSection: '3.1', wordsWritten: 3427, failedCount: 0,
})

describe('autonomous reopen', () => {
  it.each(['Cancelled', 'Error', 'Completed'] as const)('resumes %s checkpoints with saved settings', async status => {
    const api = { getGenerationStatus: vi.fn().mockResolvedValue(checkpoint(status)),
      generateAutonomous: vi.fn().mockResolvedValue(checkpoint('Starting')) }
    expect((await resumeOnOpen('proposal', 308, api)).status).toBe('Starting')
    expect(api.generateAutonomous).toHaveBeenCalledExactlyOnceWith('proposal', 308)
  })
  it.each(['Generating', 'Starting', 'NeedsReview', 'NotStarted'] as const)('does not enqueue %s on open', async status => {
    const api = { getGenerationStatus: vi.fn().mockResolvedValue(checkpoint(status)), generateAutonomous: vi.fn() }
    expect((await resumeOnOpen('proposal', 308, api)).status).toBe(status)
    expect(api.generateAutonomous).not.toHaveBeenCalled()
  })
  it('opens a complete proposal without regenerating', async () => {
    const api = { getGenerationStatus: vi.fn().mockResolvedValue({ ...checkpoint('Completed'), completedCount: 25 }), generateAutonomous: vi.fn() }
    await resumeOnOpen('proposal', 308, api)
    expect(api.generateAutonomous).not.toHaveBeenCalled()
  })
  it('shows saved progress and stopped state independently', () => {
    expect(autonomousStatusBadge(checkpoint('Cancelled'))).toMatchObject({ label: '28% · Stopped', progressPct: 28 })
    expect(autonomousStatusBadge(checkpoint('NeedsReview')).label).toBe('28% · Needs review')
    expect(autonomousStatusBadge(checkpoint('Completed')).label).toBe('28% · Incomplete')
  })
})
