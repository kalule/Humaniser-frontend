import { describe, expect, it } from 'vitest'
import { essayStageLabel } from './essayProgress'

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

  it('leaves every other stage to the caller', () => {
    expect(essayStageLabel('drafting')).toBeNull()
    expect(essayStageLabel(null)).toBeNull()
    expect(essayStageLabel('')).toBeNull()
  })
})
