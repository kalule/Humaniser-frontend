import type { ProjectSection } from '../types/research'
import type { OutlineChapter } from './documentOutline'
import { canDraft, documentStatus, type DraftContext, type DraftDecision } from './sectionWorkflow'

/**
 * The next drafting step the agent panel offers: the next chapter that still has sections to
 * draft (drafted one after another, each stopping at needs review), or a single section for the
 * Abstract and appendix. Never more than one chapter at a time: there is deliberately no
 * "write the rest" across unapproved work.
 */
export interface DraftAction {
  label:    string
  codes:    string[]
  words:    number
  decision: DraftDecision
}

function sectionsToDraft(chapter: OutlineChapter, ctx: DraftContext): ProjectSection[] {
  return chapter.sections.filter(s => s.isApplicableForMethodology !== false && documentStatus(s, ctx) === 'queued')
}

export function nextDraftAction(outline: OutlineChapter[], ctx: DraftContext, wordsPerSection: number): DraftAction | null {
  const units = [
    ...outline.filter(c => c.number !== null && !c.lockedReason),
    ...outline.filter(c => c.number === null && !c.lockedReason),
  ]
  for (const chapter of units) {
    const todo = sectionsToDraft(chapter, ctx)
    if (todo.length === 0) continue
    const decision = canDraft(todo[0], ctx)
    const words = todo.length * wordsPerSection
    const about = `about ${words.toLocaleString()} words`
    const label = chapter.number !== null && todo.length > 1
      ? `Draft Chapter ${chapter.number} · ${todo.length} sections, ${about}`
      : `Draft ${todo[0].displayCode || todo[0].code} ${todo[0].title} · ${about}`
    return { label, codes: todo.map(s => s.code), words, decision }
  }
  return null
}
