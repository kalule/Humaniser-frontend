import { describe, expect, it } from 'vitest'
import { changeCount, diffParagraphs, mergeDiff } from './paragraphDiff'

const mine = ['Intro stays.', 'My edited claim about SMEs.', 'Middle stays.', 'My closing line.'].join('\n\n')
const rewrite = ['Intro stays.', 'A rewritten claim about SMEs.', 'Middle stays.', 'A new closing line.', 'An added paragraph.'].join('\n\n')

describe('regenerate diff', () => {
  it('groups changed paragraphs into separate changes between unchanged ones', () => {
    const parts = diffParagraphs(mine, rewrite)
    expect(changeCount(parts)).toBe(2)
    expect(parts.map(p => p.kind)).toEqual(['same', 'change', 'same', 'change'])
    const last = parts[3]
    expect(last.kind === 'change' && last.before).toEqual(['My closing line.'])
    expect(last.kind === 'change' && last.after).toEqual(['A new closing line.', 'An added paragraph.'])
  })

  it('keeps the student text for every change nobody accepted (nothing is overwritten silently)', () => {
    const parts = diffParagraphs(mine, rewrite)
    expect(mergeDiff(parts, new Set())).toBe(mine)
  })

  it('applies only the accepted changes', () => {
    const parts = diffParagraphs(mine, rewrite)
    const merged = mergeDiff(parts, new Set([0]))
    expect(merged).toBe(['Intro stays.', 'A rewritten claim about SMEs.', 'Middle stays.', 'My closing line.'].join('\n\n'))
    expect(mergeDiff(parts, new Set([0, 1]))).toBe(rewrite)
  })

  it('treats whitespace-only differences as unchanged and handles empty sides', () => {
    expect(changeCount(diffParagraphs('A  b.\n\nC.', 'A b.\n\n\nC.'))).toBe(0)
    expect(changeCount(diffParagraphs('', 'New.'))).toBe(1)
    expect(mergeDiff(diffParagraphs('Old.', ''), new Set([0]))).toBe('')
  })
})
