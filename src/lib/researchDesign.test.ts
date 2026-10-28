import { describe, expect, it } from 'vitest'
import { designError, evidenceLabel, pollInterval, stageLabel } from './researchDesign'
import type { DesignEvidence, ResearchDesignView } from '../types/researchDesign'

describe('Research Design student presentation', () => {
  it.each(['NotStarted', 'RequiresInput', 'ReadyForReview', 'Accepted', 'Cancelled', 'Failed', 'BudgetExhausted', 'Superseded'])('stops polling stable %s', status => {
    expect(pollInterval({ status } as ResearchDesignView)).toBe(false)
  })
  it('polls active work conservatively', () => expect(pollInterval({ status: 'GeneratingCandidates' } as ResearchDesignView)).toBe(8000))
  it('polls only active evidence investigation', () => {
    expect(pollInterval({ status: 'RequiresEvidence', evidence: [{ researchStatus: 'Investigating' }] } as ResearchDesignView)).toBe(8000)
    expect(pollInterval({ status: 'RequiresEvidence', evidence: [{ researchStatus: 'Unresolved' }] } as ResearchDesignView)).toBe(false)
  })
  it.each(['ResolvingEvidence', 'AwaitingInvestigation', 'Waiting', 'Stopping'])('keeps polling durable evidence %s', researchStatus => {
    expect(pollInterval({ status: 'RequiresEvidence', evidence: [{ researchStatus }] } as ResearchDesignView)).toBe(8000)
  })
  it('keeps contradictions visible even with supported evidence', () => expect(evidenceLabel({ status: 'Supported', contradictionPresent: true } as DesignEvidence)).toBe('Evidence is mixed'))
  it('never turns unavailable providers into evidence absence', () => expect(evidenceLabel({ status: 'ProviderUnavailable' } as DesignEvidence)).toContain('couldn’t complete'))
  it('never turns insufficient evidence into a research gap', () => expect(evidenceLabel({ status: 'InsufficientEvidence' } as DesignEvidence)).toBe('More evidence is needed'))
  it('does not describe stale support as current verification', () => expect(evidenceLabel({ status: 'Stale' } as DesignEvidence)).toContain('checking again'))
  it('translates backend stages without model terminology or invented progress', () => expect(stageLabel('GeneratingCandidates')).toBe('Considering suitable approaches'))
  it('handles normalized conflict errors from the shared client', () => expect(designError({ code: 'RESEARCH_DESIGN_STALE_REVISION' }).conflict).toBe(true))
  it('hides raw provider and exception bodies', () => expect(designError({ message: 'secret provider error' }).message).not.toContain('secret'))
})
