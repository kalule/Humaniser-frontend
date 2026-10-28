import { beforeEach, describe, expect, it } from 'vitest'
import type { DeepResearchSession } from '../api/deepResearch'
import { finishedNotice, unwatchSession, watchSession, watchedSessionIds } from './deepResearchWatch'

// A minimal in-memory localStorage: the module must work with whatever the browser offers, and keep working without it.
function installStorage(broken = false) {
  const data = new Map<string, string>()
  const storage = broken
    ? { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
    : { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = storage
}

describe('watching sessions', () => {
  beforeEach(() => installStorage())

  it('remembers a session once and forgets it when told', () => {
    watchSession('a'); watchSession('a'); watchSession('b')
    expect(watchedSessionIds()).toEqual(['a', 'b'])
    unwatchSession('a')
    expect(watchedSessionIds()).toEqual(['b'])
  })

  it('keeps only the most recent ten', () => {
    for (let i = 0; i < 14; i++) watchSession(`s${i}`)
    expect(watchedSessionIds()).toHaveLength(10)
    expect(watchedSessionIds()[9]).toBe('s13')
  })

  it('does not throw when storage is blocked', () => {
    installStorage(true)
    expect(() => watchSession('a')).not.toThrow()
    expect(watchedSessionIds()).toEqual([])
  })
})

describe('finishedNotice', () => {
  const base = { researchQuestion: 'Does LMS usability influence satisfaction?', result: { acceptedSources: 7 } } as unknown as Pick<DeepResearchSession, 'researchQuestion' | 'result'>

  it('says what happened in plain words', () => {
    expect(finishedNotice({ ...base, status: 'Completed' }).title).toBe('Your research is ready')
    expect(finishedNotice({ ...base, status: 'Completed' }).body).toContain('7 sources')
    expect(finishedNotice({ ...base, status: 'Stopped' }).tone).toBe('warning')
    expect(finishedNotice({ ...base, status: 'Cancelled' }).title).toBe('Your research was stopped')
    expect(finishedNotice({ ...base, status: 'Failed' }).tone).toBe('error')
  })

  it('uses the singular and trims a very long question', () => {
    const one = finishedNotice({ researchQuestion: 'x'.repeat(200), status: 'Completed', result: { acceptedSources: 1 } } as never)
    expect(one.body.startsWith('1 source found')).toBe(true)
    expect(one.body.length).toBeLessThan(130)
  })

  it('never uses internal vocabulary', () => {
    for (const status of ['Completed', 'Stopped', 'Cancelled', 'Failed'] as const) {
      const n = finishedNotice({ ...base, status })
      expect(`${n.title} ${n.body}`).not.toMatch(/agent|iteration|budget|tool call/i)
    }
  })
})
