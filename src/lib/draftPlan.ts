import type { ProjectSection } from '../types/research'
import type { OutlineChapter } from './documentOutline'
import { canDraft, DRAFT_AHEAD_LAST_CHAPTER, documentStatus, type DraftContext, type DraftDecision } from './sectionWorkflow'

/**
 * The next drafting step the agent panel offers: the next chapter that still has sections to
 * draft (drafted one after another, each stopping at needs review), or a single section for the
 * Abstract and appendix. Never more than one chapter at a time: there is deliberately no
 * "write the rest" across unapproved work. The one exception is the opt-in "draft ahead" setting,
 * which runs Chapters 1-3 as one sequence; nothing from Chapter 4 on is ever included.
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
  // Draft ahead: Chapters 1-3 run as one sequence (still one section at a time, each stopping at
  // needs review). Everything after works exactly as without the setting.
  if (ctx.draftAhead) {
    const early = outline.filter(c => c.number !== null && c.number <= DRAFT_AHEAD_LAST_CHAPTER && !c.lockedReason)
    const todo = early.flatMap(c => sectionsToDraft(c, ctx))
    const allowedTodo = todo.filter(s => canDraft(s, ctx).allowed)
    if (todo.length > 1) {
      const first = allowedTodo[0] ?? todo[0]
      const codes = allowedTodo.length ? allowedTodo.map(s => s.code) : todo.map(s => s.code)
      const words = codes.length * wordsPerSection
      return {
        label: `Draft ahead: Chapters 1–${DRAFT_AHEAD_LAST_CHAPTER} · ${codes.length} sections, about ${words.toLocaleString()} words`,
        codes, words, decision: canDraft(first, ctx),
      }
    }
  }

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
