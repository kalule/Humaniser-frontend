import { describe, expect, it } from 'vitest'
import type { DeepResearchSession, EvidenceSource } from '../api/deepResearch'
import { activeSessionFor, apiErrorMessage, authorLine, timeAgo, groupSources, isQuestionValid, progressPercent, shouldPoll, strengthLabel } from './deepResearch'

const session = (over: Partial<DeepResearchSession['progress']> = {}, finished = false): DeepResearchSession => ({
  id: 's', projectId: 'p', researchQuestion: 'q', mode: 'TopicExploration', status: finished ? 'Completed' : 'Running',
  isFinished: finished, completionNote: null, createdAt: '', updatedAt: '', result: null,
  progress: { phase: 'Researching', message: '', evidenceQuestions: 4, questionsAnswered: 0, sourcesDiscovered: 0, sourcesRelevant: 0, sourcesVerified: 0, searchesRun: 0, ...over },
})

describe('deep research helpers', () => {
  it('validates question length', () => {
    expect(isQuestionValid('too short')).toBe(false)
    expect(isQuestionValid('Does LMS usability influence satisfaction?')).toBe(true)
    expect(isQuestionValid('x'.repeat(1501))).toBe(false)
  })

  it('polls only while unfinished', () => {
    expect(shouldPoll(null)).toBe(false)
    expect(shouldPoll(session())).toBe(true)
    expect(shouldPoll(session({}, true))).toBe(false)
  })

  it('derives progress from answered questions, never past 92 before the end', () => {
    expect(progressPercent(session({ phase: 'Queued' }))).toBe(2)
    expect(progressPercent(session({ phase: 'Planning' }))).toBe(8)
    expect(progressPercent(session({ questionsAnswered: 2 }))).toBe(51)
    expect(progressPercent(session({ questionsAnswered: 4 }))).toBe(92)
    expect(progressPercent(session({}, true))).toBe(100)
  })

  it('labels strength in plain words and passes unknown values through', () => {
    expect(strengthLabel('Conflicting')).toBe('Conflicting evidence')
    expect(strengthLabel('Whatever')).toBe('Whatever')
  })

  it('formats authors and groups sources by decision', () => {
    expect(authorLine({ authors: ['A', 'B', 'C', 'D'], year: 2020 })).toBe('A, B, C et al. (2020)')
    expect(authorLine({ authors: [], year: null })).toBe('Unknown authors')
    const mk = (decision: EvidenceSource['decision']) => ({ decision }) as EvidenceSource
    const g = groupSources([mk('Accepted'), mk('Rejected'), mk('Pending')])
    expect([g.accepted.length, g.rejected.length]).toEqual([1, 1])
  })

  it('reads the reason from the normalised ApiError the shared client rejects with', () => {
    expect(apiErrorMessage({ code: 'ERROR', message: 'A research session is already running for this project.' }, 'fallback'))
      .toBe('A research session is already running for this project.')
  })

  it('reads raw axios error shapes and ignores the generic status text', () => {
    expect(apiErrorMessage({ message: 'Request failed with status code 400', response: { data: { error: 'Choose a valid research type.' } } }, 'fallback'))
      .toBe('Choose a valid research type.')
    expect(apiErrorMessage({ response: { data: { error: { message: 'Nested reason' } } } }, 'fallback')).toBe('Nested reason')
    expect(apiErrorMessage({ response: { data: { message: 'Top-level reason' } } }, 'fallback')).toBe('Top-level reason')
  })

  it('falls back only when the server gave no reason', () => {
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(apiErrorMessage({ message: 'Request failed with status code 500' }, 'fallback')).toBe('fallback')
    expect(apiErrorMessage({ message: '   ' }, 'fallback')).toBe('fallback')
  })
})

describe('my research helpers', () => {
  const now = new Date('2026-10-05T12:00:00Z').getTime()

  it('describes how long ago in plain words', () => {
    expect(timeAgo('2026-10-05T11:59:40Z', now)).toBe('just now')
    expect(timeAgo('2026-10-05T11:55:00Z', now)).toBe('5 min ago')
    expect(timeAgo('2026-10-05T09:00:00Z', now)).toBe('3 h ago')
    expect(timeAgo('2026-10-03T12:00:00Z', now)).toBe('2 d ago')
    expect(timeAgo('not a date', now)).toBe('')
  })

  it('finds the one unfinished session for a project', () => {
    const rows = [
      { id: 'a', projectId: 'p1', isFinished: true },
      { id: 'b', projectId: 'p1', isFinished: false },
      { id: 'c', projectId: 'p2', isFinished: false },
    ]
    expect(activeSessionFor(rows, 'p1')?.id).toBe('b')
    expect(activeSessionFor(rows, 'p3')).toBeUndefined()
  })
})
