import { describe, expect, it } from 'vitest'
import { changedLines } from './proposalRepairDiff'

describe('changedLines', () => {
  it('lists only the lines that differ, removed first', () => {
    const d = changedLines('a\nTotal 10\nc', 'a\nTotal 12\nc')
    expect(d).toEqual([
      { kind: 'removed', text: 'Total 10' },
      { kind: 'added', text: 'Total 12' },
    ])
  })

  it('is empty for identical text, including different line endings', () => {
    expect(changedLines('x\r\ny', 'x\ny')).toEqual([])
  })

  it('shows a duplicated line that lost one copy', () => {
    expect(changedLines('a\na\nb', 'a\nb')).toEqual([{ kind: 'removed', text: 'a' }])
  })

  it('hides base64 chart payloads', () => {
    const img = '![Figure: Budget](data:image/png;base64,AAAA)'
    expect(changedLines(img, 'x')).toEqual([{ kind: 'removed', text: '[chart image]' }, { kind: 'added', text: 'x' }])
  })

  it('truncates very long lines', () => {
    const [line] = changedLines('x'.repeat(1000), '')
    expect(line.text.length).toBeLessThanOrEqual(241)
  })

  it('ignores blank-line-only changes', () => {
    expect(changedLines('a\n\nb', 'a\nb')).toEqual([])
  })
})
