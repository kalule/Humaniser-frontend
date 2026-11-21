/** Placeholder title the workspace shows before the student has one. Never written over a real title. */
export const UNTITLED_PROJECT = 'Untitled Research Project'

/** A title the student actually has (not empty and not the placeholder). */
export function hasRealProjectTitle(title: string | null | undefined): boolean {
  const trimmed = title?.trim() ?? ''
  return trimmed.length > 0 && trimmed !== UNTITLED_PROJECT
}

/**
 * Title suggestions are generated automatically only when there are none cached yet and the project has no title of
 * its own. A proposal created from "Start your proposal" already carries the student's topic as its title, so the
 * Title step does not spend a model call (or replace that title) unless the student asks for suggestions.
 */
export function shouldAutoGenerateTitles(
  cachedTitleCount: number,
  projectTitle: string | null | undefined,
  topic: string | null | undefined,
): boolean {
  return cachedTitleCount === 0 && !hasRealProjectTitle(projectTitle) && Boolean(topic?.trim())
}
