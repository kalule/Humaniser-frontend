import { describe, expect, it } from 'vitest'
import type { ProjectSection } from '../types/research'
import { canDraft, type DraftContext } from './sectionWorkflow'

let order = 0
const s = (code: string, displayCode = code): ProjectSection => ({
  code, displayCode, title: `T ${code}`, order: order++, content: '', status: 'NotStarted', wordCount: 0,
  isApplicableForMethodology: true,
} as unknown as ProjectSection)

const sections = [s('1.0'), s('1.2', '1.1'), s('2.0'), s('3.1'), s('5.6')]
const ctx: DraftContext = { sections, documentType: 'Proposal', methodologyConfirmed: true, chapterOrder: false }

// Silent study decisions (2026-11-27): the server plans the ten decisions from the topic before drafting, so no section
// waits for the student to set them (the old "Set the key study decisions first" gate is gone).
describe('study decisions never hold drafting (canDraft)', () => {
  it('lets every section be drafted with no design contract at all', () => {
    for (const section of sections) expect(canDraft(section, ctx)).toEqual({ allowed: true, reason: null, blocker: null })
  })
})
