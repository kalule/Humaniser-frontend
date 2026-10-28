import type { HumaniseBlock, HumaniseJobResult } from '../api/humaniseJobs'

// Mirrors server paragraph separators without normalising CRLF, whitespace or source text.
export function humaniseBlocks(text: string): HumaniseBlock[] {
  const blocks: HumaniseBlock[] = []
  const add = (value: string, kind = 'paragraph') => blocks.push({ id: `p${blocks.length + 1}`, text: value, kind })
  let cursor = 0
  for (const match of text.matchAll(/(?:\r?\n)[\t ]*(?:\r?\n)+/g)) {
    if (match.index! > cursor) add(text.slice(cursor, match.index))
    add(match[0], 'separator')
    cursor = match.index! + match[0].length
  }
  if (cursor < text.length) add(text.slice(cursor))
  return blocks
}
export const humaniseOutcomeLabels: Record<HumaniseJobResult['outcome'], string> = {
  changed: 'Validated suggestions ready to review',
  partially_changed: 'Some regions could not be rewritten safely. Review accepted suggestions below.',
  unchanged: 'No validated changes were needed.',
  validation_failed: 'Validation failed. Your original is preserved.',
  provider_failed: 'The writing provider was unavailable. Your original is preserved.',
  cancelled: 'Cancelled. No changes were applied.',
}
export function applicableSuggestions(result: HumaniseJobResult): string[] {
  if (!['changed', 'partially_changed'].includes(result.outcome)) return []
  return result.blocks.filter(b => b.accepted && b.text !== b.original).map(b => b.id)
}
