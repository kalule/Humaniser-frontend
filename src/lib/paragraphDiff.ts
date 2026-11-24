/**
 * Paragraph-level diff between the student's text and a rewrite, for "Rewrite" over a section the
 * student has edited: each changed run of paragraphs is one change the student accepts or rejects,
 * and nothing of theirs is replaced without that choice.
 */

export type DiffPart =
  | { kind: 'same'; text: string[] }
  | { kind: 'change'; id: number; before: string[]; after: string[] }

export const splitParagraphs = (text: string): string[] =>
  text.replace(/\r\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)

const key = (p: string) => p.replace(/\s+/g, ' ').trim()

/** Longest-common-subsequence diff over paragraphs, grouped into same/change runs. */
export function diffParagraphs(before: string, after: string): DiffPart[] {
  const a = splitParagraphs(before), b = splitParagraphs(after)
  const n = a.length, m = b.length
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = key(a[i]) === key(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const parts: DiffPart[] = []
  let id = 0
  let pendingBefore: string[] = [], pendingAfter: string[] = []
  const flushChange = () => {
    if (pendingBefore.length || pendingAfter.length) parts.push({ kind: 'change', id: id++, before: pendingBefore, after: pendingAfter })
    pendingBefore = []; pendingAfter = []
  }
  const pushSame = (p: string) => {
    flushChange()
    const last = parts[parts.length - 1]
    if (last?.kind === 'same') last.text.push(p)
    else parts.push({ kind: 'same', text: [p] })
  }
  let i = 0, j = 0
  while (i < n || j < m) {
    if (i < n && j < m && key(a[i]) === key(b[j])) { pushSame(a[i]); i++; j++ }
    else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) { pendingAfter.push(b[j]); j++ }
    else { pendingBefore.push(a[i]); i++ }
  }
  flushChange()
  return parts
}

export const changeCount = (parts: readonly DiffPart[]) => parts.filter(p => p.kind === 'change').length

/** The merged text: for each change, the rewrite when its id is in `accepted`, else the student's text. */
export function mergeDiff(parts: readonly DiffPart[], accepted: ReadonlySet<number>): string {
  const out: string[] = []
  for (const p of parts) {
    if (p.kind === 'same') out.push(...p.text)
    else out.push(...(accepted.has(p.id) ? p.after : p.before))
  }
  return out.join('\n\n')
}
