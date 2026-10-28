import { describe, expect, it } from 'vitest'
import {
  buildProgressRows, estimateRemainingMs, formatClock, progressPercent, summarizeRows,
} from './proposalGenerationProgress'

const steps = [
  { id: 'research-topic', label: 'Research Topic' },                       // setup step: no sectionKey
  { id: '1.0', label: '1.0 Introduction', sectionKey: '1.0' },
  { id: '1.2', label: '1.2 Background',   sectionKey: '1.2' },
  { id: '2.0', label: '2.0 Literature Review', sectionKey: '2.0' },
  { id: '3.1', label: '3.1 Problem Statement', sectionKey: '3.1' },
]

const sec = (code: string, status: 'NotStarted' | 'Generating' | 'Draft' | 'Edited' | 'Approved', wordCount = 0, generationError: string | null = null) =>
  ({ code, status, wordCount, generationError })

describe('buildProgressRows', () => {
  it('lists only chapter sections, in outline order', () => {
    const rows = buildProgressRows({ steps, sections: [], currentSection: null, phase: 'Starting', targetWords: 500 })
    expect(rows.map(r => r.code)).toEqual(['1.0', '1.2', '2.0', '3.1'])
  })

  it('marks finished sections complete with their real word count', () => {
    const rows = buildProgressRows({
      steps, currentSection: '2.0', phase: 'Generating', targetWords: 500,
      sections: [sec('1.0', 'Draft', 607), sec('1.2', 'Approved', 649)],
    })
    expect(rows.find(r => r.code === '1.0')).toMatchObject({ state: 'complete', words: 607, target: 500 })
    expect(rows.find(r => r.code === '1.2')).toMatchObject({ state: 'complete', words: 649 })
  })

  it('marks only the current section as drafting while active, with no invented word count', () => {
    const rows = buildProgressRows({
      steps, currentSection: '2.0', phase: 'Generating', targetWords: 500,
      sections: [sec('1.0', 'Draft', 607)],
    })
    expect(rows.find(r => r.code === '2.0')).toMatchObject({ state: 'drafting', words: 0 })
    expect(rows.find(r => r.code === '3.1')?.state).toBe('queued')
  })

  it('treats a server-side Generating section as drafting even if currentSection lags', () => {
    const rows = buildProgressRows({
      steps, currentSection: '1.2', phase: 'Generating', targetWords: 500,
      sections: [sec('2.0', 'Generating')],
    })
    expect(rows.find(r => r.code === '2.0')?.state).toBe('drafting')
  })

  it('shows nothing as drafting once the run has finished', () => {
    const rows = buildProgressRows({
      steps, currentSection: '3.1', phase: 'Completed', targetWords: 500,
      sections: [sec('3.1', 'Draft', 410)],
    })
    expect(rows.find(r => r.code === '3.1')?.state).toBe('complete')
    expect(rows.some(r => r.state === 'drafting')).toBe(false)
  })

  it('reports a section whose generation failed instead of leaving it queued', () => {
    const rows = buildProgressRows({
      steps, currentSection: '3.1', phase: 'Generating', targetWords: 500,
      sections: [sec('2.0', 'NotStarted', 0, 'Generation produced no verified in-text citations.')],
    })
    expect(rows.find(r => r.code === '2.0')?.state).toBe('failed')
  })

  it('does not count an empty Draft as complete', () => {
    const rows = buildProgressRows({
      steps, currentSection: null, phase: 'Cancelled', targetWords: 500, sections: [sec('1.0', 'Draft', 0)],
    })
    expect(rows.find(r => r.code === '1.0')?.state).toBe('queued')
  })
})

describe('summarizeRows', () => {
  it('counts completed, in-progress, pending and failed separately', () => {
    const rows = buildProgressRows({
      steps, currentSection: '2.0', phase: 'Generating', targetWords: 500,
      sections: [sec('1.0', 'Draft', 600), sec('1.2', 'NotStarted', 0, 'x')],
    })
    expect(summarizeRows(rows)).toEqual({ completed: 1, inProgress: 1, pending: 1, failed: 1 })
  })
})

describe('progressPercent', () => {
  it('is words-based', () => {
    expect(progressPercent('Generating', 3676, 10_000)).toBe(37)
  })
  it('never reaches 100 until the job completes, even if sections run long', () => {
    expect(progressPercent('Generating', 10_267, 10_000)).toBe(99)
    expect(progressPercent('Completed', 10_267, 10_000)).toBe(100)
  })
  it('does not report a partial completed run as fully generated', () => {
    expect(progressPercent('Completed', 7, 25)).toBe(28)
  })
  it('is 0 without a target', () => {
    expect(progressPercent('Starting', 0, 0)).toBe(0)
  })
})

describe('estimateRemainingMs', () => {
  it('is null until there is enough signal', () => {
    expect(estimateRemainingMs({ elapsedMs: 5_000, wordsWritten: 100, totalTargetWords: 10_000 })).toBeNull()
    expect(estimateRemainingMs({ elapsedMs: 60_000, wordsWritten: 50, totalTargetWords: 10_000 })).toBeNull()
  })
  it('extrapolates from words per millisecond', () => {
    // 2,000 words in 100 s => 50 ms/word; 8,000 words left => 400 s.
    expect(estimateRemainingMs({ elapsedMs: 100_000, wordsWritten: 2_000, totalTargetWords: 10_000 })).toBe(400_000)
  })
  it('is zero when the target has been reached', () => {
    expect(estimateRemainingMs({ elapsedMs: 100_000, wordsWritten: 10_500, totalTargetWords: 10_000 })).toBe(0)
  })
})

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(411_000)).toBe('6:51')
  })
  it('adds hours past an hour', () => {
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })
  it('clamps negatives', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})

describe('saved checkpoint precedence', () => {
  it('shows saved draft words when the current-section pointer lags', () => {
    const rows = buildProgressRows({ steps, currentSection: '1.0', phase: 'Generating', targetWords: 308,
      sections: [sec('1.0', 'Draft', 366)] })
    expect(rows.find(r => r.code === '1.0')).toMatchObject({ state: 'complete', words: 366 })
  })
})
