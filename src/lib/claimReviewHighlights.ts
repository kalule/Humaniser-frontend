import type { WriteWithAiResponse } from '../types/workbench'

/**
 * Sentences whose claims failed checking, highlighted in the editor instead of the whole essay being marked "incomplete".
 * The backend reports each failed claim (evidenceIssues) and the essay's own wording of it (claimAudit.claims[].originalSpan, with
 * [S1]-style source tokens). The editor shows formatted citations instead of tokens, so the text between tokens is what is searched.
 */
export interface ClaimReviewItem {
  /** Text to find in the editor: the longest run of the claim's sentence between citation tokens. */
  needle: string
  /** Why it was flagged, for the tooltip. */
  message: string
}

const SOURCE_TOKEN = /\[(?:N:)?S\d+[^\]]*\]/g
const MIN_NEEDLE = 20

/** The longest stretch of the sentence between source tokens, trimmed of joining punctuation, or null when none is long enough to find reliably. */
export function needleFor(span: string | null | undefined): string | null {
  if (!span) return null
  const parts = span.split(SOURCE_TOKEN)
    .map(part => part.replace(/\s+/g, ' ').trim().replace(/^[,;:.\s]+|[,;:\s]+$/g, ''))
    .filter(part => part.length >= MIN_NEEDLE)
  return parts.sort((a, b) => b.length - a.length)[0] ?? null
}

const REASON_LABELS: Record<string, string> = {
  missing_citation: 'This claim needs a citation.',
  causal_overstatement: 'This states a cause more strongly than the source does.',
  population_mismatch: 'The source studied a different population.',
  unsupported_magnitude: 'The source does not report this size of effect.',
  construct_mismatch: 'The source measured something different.',
  outcome_mismatch: 'The source reports a different outcome.',
}

/** One item per distinct sentence; several failed claims in one sentence share a tooltip. */
export function reviewItems(result: Pick<WriteWithAiResponse, 'evidenceIssues' | 'claimAudit'>): ClaimReviewItem[] {
  const claims = new Map((result.claimAudit?.claims ?? []).map(c => [c.id, c]))
  const byNeedle = new Map<string, string[]>()
  for (const issue of result.evidenceIssues ?? []) {
    const needle = needleFor(claims.get(issue.passageId)?.originalSpan ?? issue.claim)
    if (!needle) continue
    const reason = REASON_LABELS[issue.category] ?? 'The cited source does not clearly support this.'
    const messages = byNeedle.get(needle) ?? []
    if (!messages.includes(reason)) messages.push(reason)
    byNeedle.set(needle, messages)
  }
  return [...byNeedle].map(([needle, messages]) => ({ needle, message: `Needs review: ${messages.join(' ')} Edit or remove this sentence.` }))
}

/** Where `needle` occurs in `text`, ignoring differences in whitespace, or null. */
export function locate(text: string, needle: string): [number, number] | null {
  const pattern = needle.split(' ').map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
  const match = new RegExp(pattern).exec(text)
  return match ? [match.index, match.index + match[0].length] : null
}
