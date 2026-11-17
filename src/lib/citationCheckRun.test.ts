import { describe, expect, it } from 'vitest'
import { forgetRun, MAX_AGE_MS, recallRun, rememberRun } from './citationCheckRun'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v },
    removeItem: (k: string) => { delete data[k] },
  }
}

describe('remembered run', () => {
  it('returns the run that was remembered', () => {
    const s = memoryStorage()
    rememberRun('run-1', 1_000, s)
    expect(recallRun(2_000, s)).toBe('run-1')
  })

  it('keeps only the most recent run', () => {
    const s = memoryStorage()
    rememberRun('old', 1_000, s)
    rememberRun('new', 2_000, s)
    expect(recallRun(3_000, s)).toBe('new')
  })

  it('forgets a run older than the server keeps anything', () => {
    const s = memoryStorage()
    rememberRun('run-1', 0, s)
    expect(recallRun(MAX_AGE_MS, s)).toBe('run-1')
    expect(recallRun(MAX_AGE_MS + 1, s)).toBeNull()
  })

  it('returns nothing when nothing was saved', () => {
    expect(recallRun(1, memoryStorage())).toBeNull()
  })

  it('ignores corrupt or wrongly shaped saved data instead of throwing', () => {
    for (const bad of ['{not json', 'null', '[]', '{"id":5,"savedAt":1}', '{"id":"x"}', '{"savedAt":1}', '"text"']) {
      expect(recallRun(2, memoryStorage({ 'citationCheck.lastRun': bad }))).toBeNull()
    }
  })

  it('forgets on request', () => {
    const s = memoryStorage()
    rememberRun('run-1', 1, s)
    forgetRun(s)
    expect(recallRun(2, s)).toBeNull()
  })

  it('never throws when storage is unavailable, full, or blocked', () => {
    expect(() => rememberRun('x', 1, null)).not.toThrow()
    expect(recallRun(1, null)).toBeNull()
    expect(() => forgetRun(null)).not.toThrow()

    const hostile = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('blocked') },
    }
    expect(() => rememberRun('x', 1, hostile)).not.toThrow()
    expect(recallRun(1, hostile)).toBeNull()
    expect(() => forgetRun(hostile)).not.toThrow()
  })
})
