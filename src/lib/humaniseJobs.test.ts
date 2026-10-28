import { describe, expect, it } from 'vitest'
import { applicableSuggestions, humaniseBlocks } from './humaniseJobs'
import type { HumaniseJobResult } from '../api/humaniseJobs'

describe('validated humaniser review', () => {
  it('round-trips all paragraph separators without normalising CRLF', () => {
    const text = ' First.\r\n\r\n \r\nSecond.\n\nThird. '
    const blocks = humaniseBlocks(text)
    expect(blocks.map(b => b.text).join('')).toBe(text)
    expect(new Set(blocks.map(b => b.id)).size).toBe(blocks.length)
  })
  it('offers only changed accepted suggestions in a partial result', () => {
    const result = { outcome: 'partially_changed', blocks: [
      { id: 'p1', original: 'old', text: 'new', accepted: true },
      { id: 'p2', original: 'same', text: 'same', accepted: true },
      { id: 'p3', original: 'bad', text: 'bad', accepted: false },
    ] } as HumaniseJobResult
    expect(applicableSuggestions(result)).toEqual(['p1'])
    expect(applicableSuggestions({ ...result, outcome: 'validation_failed' })).toEqual([])
    expect(applicableSuggestions({ ...result, outcome: 'cancelled' })).toEqual([])
  })
})
