import type { QualMethod, QualSegment } from '../api/qualitativeAnalysis'

// Pure helpers for the Qualitative Analysis screens. Wording follows principle Q6 of the backend spec: themes and
// codes are the researcher's constructions; nothing "emerges"; counts describe this coding of this data only.

export const METHOD_LABELS: Record<QualMethod, string> = {
  ReflexiveTA: 'Reflexive thematic analysis',
  CodebookTA: 'Codebook thematic analysis',
  ContentAnalysis: 'Qualitative content analysis',
  Framework: 'Framework analysis',
  GroundedTheory: 'Grounded theory',
  IPA: 'Interpretative phenomenological analysis',
}

/** One line per method, shown when choosing it. Says what the tool will and will not do for that method. */
export const METHOD_NOTES: Record<QualMethod, string> = {
  ReflexiveTA: 'Your interpretation is the analysis. Coding agreement between coders is not used for this method.',
  CodebookTA: 'A structured codebook, developed as you go. Agreement between coders can be reported.',
  ContentAnalysis: 'Categories and coding rules applied across the data. Agreement between coders can be reported.',
  Framework: 'A matrix of cases against themes. Agreement between coders can be reported.',
  GroundedTheory: 'Constant comparison and memo writing. Coding agreement between coders is not used for this method.',
  IPA: 'Close reading of each person’s account. Coding agreement between coders is not used for this method.',
}

export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa' },
  { code: 'nso', label: 'Sepedi' },
  { code: 'st', label: 'Sesotho' },
  { code: 'tn', label: 'Setswana' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'other', label: 'Another language' },
]

export const languageLabel = (code: string) => LANGUAGES.find(l => l.code === code)?.label ?? code

/** A share shown as a whole-number percentage, or a dash when there is nothing to divide by. */
export function percent(share: number | null | undefined): string {
  if (share === null || share === undefined || Number.isNaN(share)) return '—'
  return `${Math.round(share * 100)}%`
}

export interface Mark { start: number; end: number; kind: 'code' | 'language' | 'selected' | 'evidence' }

/** A stretch of the transcript with the same segment and the same marks. Runs tile [0, length) with no gaps. */
export interface Run { start: number; end: number; segmentId: string | null; codes: number; language: boolean; selected: boolean; evidence: boolean }

/**
 * Splits the transcript into runs at every segment edge and every mark edge, so each run can be one text node with
 * a known start offset. Text outside every segment (speaker labels, blank lines) gets segmentId null.
 */
export function buildRuns(length: number, segments: Pick<QualSegment, 'id' | 'start' | 'end'>[], marks: Mark[]): Run[] {
  const clamp = (n: number) => Math.max(0, Math.min(length, n))
  const cuts = new Set<number>([0, length])
  for (const s of segments) { cuts.add(clamp(s.start)); cuts.add(clamp(s.end)) }
  for (const m of marks) { cuts.add(clamp(m.start)); cuts.add(clamp(m.end)) }
  const points = [...cuts].sort((a, b) => a - b)
  const ordered = [...segments].sort((a, b) => a.start - b.start)
  const runs: Run[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const start = points[i], end = points[i + 1]
    if (end <= start) continue
    const segment = ordered.find(s => s.start <= start && end <= s.end)
    const over = marks.filter(m => m.start <= start && end <= m.end)
    runs.push({
      start, end, segmentId: segment?.id ?? null,
      codes: over.filter(m => m.kind === 'code').length,
      language: over.some(m => m.kind === 'language'),
      selected: over.some(m => m.kind === 'selected'),
      evidence: over.some(m => m.kind === 'evidence'),
    })
  }
  return runs
}

/**
 * Turns a point in the rendered transcript (a DOM node and an offset in it) into a transcript offset. Every run is
 * rendered as an element with data-offset holding its start and a single text node, so the offset is that start
 * plus the offset inside the text node. Returns null outside the transcript.
 */
export function offsetFromPoint(node: Node | null, offset: number, root: Element): number | null {
  if (!node || !root.contains(node)) return null
  if (node.nodeType === Node.TEXT_NODE) {
    const host = node.parentElement?.closest<HTMLElement>('[data-offset]')
    if (!host || !root.contains(host)) return null
    return Number(host.dataset.offset) + offset
  }
  // An element boundary: the point is before its offset-th child.
  const element = node as Element
  const child = element.childNodes[offset] ?? null
  if (child) {
    const host = (child.nodeType === Node.ELEMENT_NODE ? child as Element : child.parentElement)?.closest<HTMLElement>('[data-offset]')
      ?? (child.nodeType === Node.ELEMENT_NODE ? (child as Element).querySelector<HTMLElement>('[data-offset]') : null)
    if (host && root.contains(host)) return Number(host.dataset.offset)
  }
  const hosts = element.querySelectorAll<HTMLElement>('[data-offset]')
  const last = hosts[hosts.length - 1]
  return last ? Number(last.dataset.offset) + (last.textContent?.length ?? 0) : null
}

/** The current selection inside root as transcript offsets, start before end, or null when nothing is selected there. */
export function selectionOffsets(root: Element): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  const a = offsetFromPoint(range.startContainer, range.startOffset, root)
  const b = offsetFromPoint(range.endContainer, range.endOffset, root)
  if (a === null || b === null || a === b) return null
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

/**
 * A selection without the spaces or line breaks at its ends. A double-click on Windows selects the word and the space after it,
 * which would otherwise end up in the quote, the coded passage and the replace prompt. Null when only whitespace is selected.
 */
export function trimSelection(text: string, sel: { start: number; end: number }): { start: number; end: number } | null {
  let { start, end } = sel
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  return start < end ? { start, end } : null
}

/** Short words for audit event types; unknown types are shown as they are. */
export const AUDIT_LABELS: Record<string, string> = {
  StudyCreated: 'Study created', StudyChanged: 'Study settings changed', TranscriptImported: 'Transcript imported', DeidentificationConfirmed: 'De-identification confirmed', TranscriptDeleted: 'Transcript deleted', IdentifierKeyDiscarded: 'Identifier key discarded',
  CodeCreated: 'Code created', CodeChanged: 'Code changed', CodeMerged: 'Codes merged', CodeDeleted: 'Code deleted', CodeApplied: 'Code applied',
  CodeApplicationRemoved: 'Coded passage removed', MemoWritten: 'Memo written', MemoChanged: 'Memo changed', MemoDeleted: 'Memo deleted',
  TranscriptRedacted: 'Text replaced after confirming', EvidenceQuoteAdded: 'Evidence quote added', EvidenceQuoteRemoved: 'Evidence quote removed',
  AiRunStarted: 'AI suggestion run started', AiRunFinished: 'AI suggestion run finished', SuggestionAccepted: 'Suggestion accepted',
  SuggestionEdited: 'Suggestion edited and accepted', SuggestionRejected: 'Suggestion rejected',
  ThemeCreated: 'Theme created', ThemeChanged: 'Theme changed', ThemeCodesChanged: 'Codes under a theme changed', ThemeDeleted: 'Theme deleted',
  ThemeSuggestionAccepted: 'Theme suggestion accepted', ThemeSuggestionEdited: 'Theme suggestion edited and accepted', ThemeSuggestionRejected: 'Theme suggestion rejected',
  ChecklistAnswered: 'Checklist item answered', ExportProduced: 'File downloaded',
  CodingFinished: 'Coding marked finished', CodingReopened: 'Coding reopened',
  CoderInvited: 'Second coder invited', CoderImported: 'Second coder\'s coding imported', CoderRemoved: 'Second coder removed',
}

export const PROVENANCE_LABELS: Record<string, string> = {
  Human: 'Yours',
  AiSuggestedAccepted: 'AI suggestion, accepted',
  AiSuggestedEdited: 'AI suggestion, edited',
}

/** Words for a run failure code; the server's refusals carry their own message, run records only a code. */
export const RUN_FAILURES: Record<string, string> = {
  QUAL_ALL_BATCHES_FAILED: 'No batch produced usable suggestions. Nothing was charged.',
  QUAL_TRANSCRIPT_CHANGED: 'The transcript changed before the run started. Nothing was charged.',
  QUAL_PROVIDER_CHANGED: 'The AI provider setting changed before the run started. Nothing was charged.',
  QUAL_IDENTIFIER_IN_OUTBOUND: 'Something that looks like an identifier was found in the text, so nothing more was sent.',
  QUAL_QUEUE_UNAVAILABLE: 'The run could not be queued. Nothing was charged.',
  QUAL_RUN_ERROR: 'The run stopped with an error. Only batches already finished were charged.',
}
