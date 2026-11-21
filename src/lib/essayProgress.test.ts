import { describe, expect, it } from 'vitest'
import { ESSAY_COVERAGE_TEXT, essayCoverageState, essayPhase, essayStageDetail, essayStageLabel, nextEssayPhase, parseEssayCoverage, parseEssayParts, visibleSources } from './essayProgress'

describe('essayStageLabel', () => {
  it('numbers the research steps and uses the counts the backend reports', () => {
    expect(essayStageLabel('planning-question')).toBe('Step 1 of 5 · Breaking your question into parts…')
    expect(essayStageLabel('searching-sources:9')).toBe('Step 2 of 5 · Searching academic databases (9 searches)…')
    expect(essayStageLabel('assessing-evidence:62')).toBe('Step 3 of 5 · Checking 62 sources against each part of your question…')
    expect(essayStageLabel('searching-gaps:2')).toBe('Step 4 of 5 · Looking for more evidence on 2 parts still missing…')
    expect(essayStageLabel('building-outline')).toBe('Step 5 of 5 · Planning your sections…')
  })

  it('handles one item, a missing count and a stage outside the numbered steps', () => {
    expect(essayStageLabel('searching-sources:1')).toContain('(1 search)')
    expect(essayStageLabel('assessing-evidence')).toBe('Step 3 of 5 · Checking sources against each part of your question…')
    expect(essayStageLabel('searching-gaps:abc')).toBe('Step 4 of 5 · Looking for more evidence on the parts still missing…')
    expect(essayStageLabel('checking-thesis')).toBe('Checking your thesis against the evidence found…')
  })

  it('distinguishes review, actual repair and finalisation', () => {
    expect(essayStageLabel('checking-claims')).toBe('Checking claims and citations…')
    expect(essayStageLabel('reviewing-answer')).toBe('Checking your argument…')
    expect(essayStageLabel('repairing-draft-format')).toBe('Repairing draft format…')
    expect(essayStageLabel('repairing-passages')).toBe('Repairing affected passages…')
    expect(essayStageLabel('validating-repair')).toBe('Validating the repaired passages…')
    expect(essayStageLabel('finalising')).toBe('Finalising your essay…')
  })

  it('leaves every other stage to the caller', () => {
    expect(essayStageLabel('drafting')).toBeNull()
    expect(essayStageLabel(null)).toBeNull()
    expect(essayStageLabel('')).toBeNull()
  })
})

describe('essay phases', () => {
  // Regression 2026-11-20: "drafting" has no essay label and fell back to phase 0, so mid-run the modal showed
  // "Understanding your question" again and looked restarted.
  it('puts every stage after research in the writing phase', () => {
    expect(essayPhase('planning-question')).toBe(0)
    expect(essayPhase('assessing-evidence:12')).toBe(1)
    expect(essayPhase('drafting')).toBe(2)
    expect(essayPhase('repairing-draft-format')).toBe(2)
    expect(essayPhase('incomplete')).toBe(2)
    expect(essayPhase(null)).toBeNull()
  })

  it('never moves back', () => {
    expect(nextEssayPhase(2, 'planning-question')).toBe(2)
    expect(nextEssayPhase(1, 'drafting')).toBe(2)
    expect(nextEssayPhase(1, null)).toBe(1)
    expect(nextEssayPhase(0, 'searching-sources:3')).toBe(1)
  })
})

describe('essayStageDetail (the status line under the current phase)', () => {
  it('uses the counts the stage carries', () => {
    expect(essayStageDetail('searching-sources:9')).toBe('Running 9 searches across academic databases…')
    expect(essayStageDetail('searching-sources:1')).toBe('Running 1 search across academic databases…')
    expect(essayStageDetail('assessing-evidence:18')).toBe('Checking 18 sources against your question…')
    expect(essayStageDetail('searching-gaps:2')).toBe('Searching again for 2 parts that need more evidence…')
    expect(essayStageDetail('searching-gaps:1')).toBe('Searching again for the part that needs more evidence…')
  })

  it('says the same thing without a number when the count is missing or not a number', () => {
    expect(essayStageDetail('searching-sources')).toBe('Searching academic databases…')
    expect(essayStageDetail('assessing-evidence:abc')).toBe('Checking sources against your question…')
    expect(essayStageDetail('searching-gaps')).toBe('Searching again for the parts that need more evidence…')
    expect(essayStageDetail('searching-gaps:0')).toBe('Searching again for the parts that need more evidence…')
  })

  it('describes planning and outlining plainly', () => {
    expect(essayStageDetail('planning-question')).toBe('Breaking your question into the parts it asks you to answer…')
    expect(essayStageDetail('building-outline')).toBe('Planning your sections from the evidence found…')
  })

  it('keeps the existing wording for later stages and drops the step prefix', () => {
    expect(essayStageDetail('checking-claims')).toBe('Checking claims and citations…')
    expect(essayStageDetail('checking-thesis')).toBe('Checking your thesis against the evidence found…')
    expect(essayStageDetail('checking-claims')).not.toMatch(/^Step /)
  })

  it('returns null for an unknown or empty stage so the caller keeps its own label', () => {
    expect(essayStageDetail('drafting')).toBeNull()
    expect(essayStageDetail('something-new:4')).toBeNull()
    expect(essayStageDetail('')).toBeNull()
    expect(essayStageDetail(null)).toBeNull()
    expect(essayStageDetail(undefined)).toBeNull()
  })
})

describe('parts of the question and their coverage', () => {
  it('shows "supported" only for the backend state "supported"', () => {
    expect(essayCoverageState('supported')).toBe('supported')
    expect(essayCoverageState('partial')).toBe('partial')
    expect(essayCoverageState('unsupported')).toBe('unsupported')
    for (const other of ['conflicting', 'Supported', 'strong', '', null, undefined, 1, {}])
      expect(essayCoverageState(other)).toBe('unknown')
  })

  it('has calm text for every state, none of it alarming', () => {
    expect(ESSAY_COVERAGE_TEXT).toEqual({
      supported: 'Evidence found',
      partial: 'Some evidence found',
      unsupported: 'Little evidence found so far',
      unknown: 'Not checked yet',
    })
    for (const text of Object.values(ESSAY_COVERAGE_TEXT)) expect(text).not.toMatch(/fail|error|missing|warning/i)
  })

  it('reads a parts list and drops malformed entries', () => {
    expect(parseEssayParts([{ id: 'C1', label: ' Causes of the rise ' }, { id: '', label: 'x' }, { id: 'C2' }, 'junk', null, { id: 'C3', label: 'Effects' }]))
      .toEqual([{ id: 'C1', label: 'Causes of the rise' }, { id: 'C3', label: 'Effects' }])
    expect(parseEssayParts('not a list')).toBeNull()
    expect(parseEssayParts(undefined)).toBeNull()
  })

  it('reads a coverage list and maps every state safely', () => {
    expect(parseEssayCoverage([{ id: 'C1', state: 'supported' }, { id: 'C2', state: 'conflicting' }, { id: 'C3' }, { state: 'supported' }]))
      .toEqual([{ id: 'C1', state: 'supported' }, { id: 'C2', state: 'unknown' }, { id: 'C3', state: 'unknown' }])
    expect(parseEssayCoverage({ C1: 'supported' })).toBeNull()
  })
})

describe('visibleSources', () => {
  it('shows everything up to the cap', () => {
    expect(visibleSources([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 })
    expect(visibleSources([1, 2, 3, 4, 5, 6])).toEqual({ shown: [1, 2, 3, 4, 5, 6], more: 0 })
  })

  it('shows the latest six and counts the rest', () => {
    expect(visibleSources([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ shown: [4, 5, 6, 7, 8, 9], more: 3 })
  })
})
