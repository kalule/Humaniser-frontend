import type { CoWriteSection, CoWriteSession } from '../types/workbench'
import type { Editor } from '@tiptap/core'
import type { FormatStyle } from '../types/citation'
import type { EssayCitationStyleName } from './citationFormat'
import { interactiveCitationTokens } from './editorCitations'
import { resolveEssayCitationTokens } from './essayCitationTokens'

export type CoWriteProgress = Record<string, 'accepted' | 'skipped'>

export const FORMAT_STYLE_OF: Record<EssayCitationStyleName, FormatStyle> = {
  Harvard: 'harvard', Apa7: 'apa7', Ieee: 'ieee', Chicago: 'chicago', Vancouver: 'vancouver',
}

export const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length

/** Starting an essay is a replacement; continuing that same essay is an append. */
export function insertCoWriteSection(editor: Editor, html: string, firstAcceptedSection: boolean): void {
  if (firstAcceptedSection) editor.commands.setContent(html, { emitUpdate: true })
  else editor.chain().focus('end').insertContent(html).run()
}

/** The section to work on next: the first one not yet accepted or skipped, searching on from `afterId` and then from the start. */
export function nextPendingSection(session: CoWriteSession, progress: CoWriteProgress, afterId?: string): CoWriteSection | null {
  const sections = session.sections
  const start = afterId ? sections.findIndex(s => s.id === afterId) + 1 : 0
  const ordered = [...sections.slice(start), ...sections.slice(0, start)]
  return ordered.find(s => !progress[s.id]) ?? null
}

export const isFinished = (session: CoWriteSession, progress: CoWriteProgress): boolean => session.sections.every(s => progress[s.id])

/** The paragraph as the student reads it: tokens become "(Author, Year)" in the essay's citation style. */
export function displayText(text: string, session: CoWriteSession): string {
  return resolveEssayCitationTokens(text, session.references, session.citationStyle)
}

/**
 * The HTML inserted when a section is accepted: the section's heading when it opens the introduction, the body or the conclusion, then its
 * paragraphs with interactive citations. Text is escaped first, so what the model or student wrote can never become markup.
 */
export function sectionHtml(section: CoWriteSection, text: string, session: CoWriteSession, progress: CoWriteProgress): string {
  const bodyAlreadyStarted = session.sections.some(s => s.kind === 'body' && progress[s.id] === 'accepted')
  const heading = section.kind === 'intro' ? '<h2>INTRODUCTION</h2>'
    : section.kind === 'conclusion' ? '<h2>CONCLUSION</h2>'
    : bodyAlreadyStarted ? '' : '<h2>MAIN BODY</h2>'
  const style = FORMAT_STYLE_OF[session.citationStyle]
  const paragraphs = escapeHtml(text.trim()).split(/\n\n+/).filter(p => p.trim())
    .map(p => `<p>${interactiveCitationTokens(p.replace(/\n/g, ' '), session.references, style, session.sessionId)}</p>`)
    .join('')
  return heading + paragraphs
}

/** For each source the paragraph cites: its reference and the verbatim passages that support it, so the student can check the grounding. */
export function groundingFor(session: CoWriteSession, sourceIds: string[], evidenceIds: string[]) {
  return sourceIds.map(id => ({
    sourceId: id,
    reference: session.references.find(r => r.sourceId === id) ?? null,
    passages: session.passages.filter(p => p.sourceId === id && evidenceIds.includes(p.id)),
  }))
}
