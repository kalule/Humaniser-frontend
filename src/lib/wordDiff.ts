export type DiffToken = { type: 'equal' | 'added' | 'removed'; text: string }

// Cap on token-pair comparisons before falling back to a no-op diff (treat
// everything as unchanged) — protects against O(n*m) blowing up on very
// long inputs instead of freezing the render.
const MAX_DIFF_CELLS = 4_000_000

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0)
}

/** Word-level diff between `original` and `revised`, merged into contiguous runs by type. */
export function computeWordDiff(original: string, revised: string): DiffToken[] {
  const a = tokenize(original)
  const b = tokenize(revised)
  const n = a.length
  const m = b.length

  if (n * m > MAX_DIFF_CELLS) {
    return [{ type: 'equal', text: revised }]
  }

  const dp: Uint32Array[] = new Array(n + 1)
  for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const tokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ type: 'equal', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ type: 'removed', text: a[i] })
      i++
    } else {
      tokens.push({ type: 'added', text: b[j] })
      j++
    }
  }
  while (i < n) {
    tokens.push({ type: 'removed', text: a[i] })
    i++
  }
  while (j < m) {
    tokens.push({ type: 'added', text: b[j] })
    j++
  }

  const merged: DiffToken[] = []
  for (const t of tokens) {
    const last = merged[merged.length - 1]
    if (last && last.type === t.type) {
      last.text += t.text
    } else {
      merged.push({ ...t })
    }
  }
  return merged
}
