export interface DiffLine {
  kind: 'removed' | 'added'
  text: string
}

const MAX_LINE = 240

/** Embedded charts are base64 data URIs thousands of characters long; show a marker instead of the payload. */
function display(line: string): string {
  const t = line.trim()
  if (t.includes('data:image/')) return '[chart image]'
  return t.length > MAX_LINE ? `${t.slice(0, MAX_LINE)}…` : t
}

/**
 * The lines a repair removed and added, in document order. Lines present on both sides (counted as a multiset, so a
 * duplicated line that lost one copy still shows) are omitted. This is a review aid, not a patch: it never needs to be
 * applied, because undo restores the stored "before" text.
 */
export function changedLines(before: string, after: string): DiffLine[] {
  const norm = (s: string) => s.replace(/\r\n/g, '\n').split('\n')
  const b = norm(before)
  const a = norm(after)

  const remaining = new Map<string, number>()
  for (const line of a) remaining.set(line, (remaining.get(line) ?? 0) + 1)

  const removed: DiffLine[] = []
  const kept = new Map<string, number>()
  for (const line of b) {
    const n = remaining.get(line) ?? 0
    if (n > 0) {
      remaining.set(line, n - 1)
      kept.set(line, (kept.get(line) ?? 0) + 1)
    } else if (line.trim()) {
      removed.push({ kind: 'removed', text: display(line) })
    }
  }

  const added: DiffLine[] = []
  const alreadyMatched = new Map(kept)
  for (const line of a) {
    const n = alreadyMatched.get(line) ?? 0
    if (n > 0) alreadyMatched.set(line, n - 1)
    else if (line.trim()) added.push({ kind: 'added', text: display(line) })
  }
  return [...removed, ...added]
}
