import { describe, expect, it } from 'vitest'
import type { ProjectSection } from '../types/research'
import { canDraft, DECISIONS_REASON, needsKeyDecisions, type DraftContext } from './sectionWorkflow'

let order = 0
const s = (code: string, displayCode = code): ProjectSection => ({
  code, displayCode, title: `T ${code}`, order: order++, content: '', status: 'NotStarted', wordCount: 0,
  isApplicableForMethodology: true,
} as unknown as ProjectSection)

const sections = [s('1.0'), s('1.2', '1.1'), s('2.0'), s('3.1')]
const ctx = (decisionsReady: boolean | undefined): DraftContext => ({
  sections, documentType: 'Proposal', methodologyConfirmed: true, chapterOrder: false, decisionsReady,
})

describe('key study decisions gate (canDraft)', () => {
  it('Introduction and Background (shown as 1.1) never wait for the decisions', () => {
    expect(needsKeyDecisions(sections[0])).toBe(false)
    expect(needsKeyDecisions(sections[1])).toBe(false)
    expect(canDraft(sections[1], ctx(false)).allowed).toBe(true)
  })

  it('pauses every later section while a key decision is unset', () => {
    for (const later of sections.slice(2)) {
      expect(canDraft(later, ctx(false))).toEqual({ allowed: false, reason: DECISIONS_REASON, blocker: 'decisions' })
    }
  })

  it('lets them through once the decisions are set, and does not apply where the view does not check (Guided)', () => {
    expect(canDraft(sections[2], ctx(true)).allowed).toBe(true)
    expect(canDraft(sections[2], ctx(undefined)).allowed).toBe(true)
  })
})
