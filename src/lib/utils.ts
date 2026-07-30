import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─── Tailwind class merging ───────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── Number formatting ────────────────────────────────────────────────────────

/**
 * Format a number with locale-aware thousands separators.
 * e.g. 10000 -> "10,000"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Format an ISO date string to a human-readable short date.
 * e.g. "2026-06-01T00:00:00Z" -> "Jun 1, 2026"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Text utilities ───────────────────────────────────────────────────────────

/**
 * Truncate a string to `maxLen` characters, appending "…" when trimmed.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

/**
 * Count words in a string. Returns 0 for empty/whitespace-only strings.
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Extract plain text from a TipTap document JSON string (as stored by the
 * document editor), joining block nodes with blank lines. Falls back to
 * returning the input unchanged if it isn't valid TipTap JSON.
 */
export function tiptapJsonToText(json: string): string {
  let doc: unknown
  try {
    doc = JSON.parse(json)
  } catch {
    return json
  }

  const blocks: string[] = []
  const walk = (node: unknown): string => {
    if (node == null || typeof node !== 'object') return ''
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (n.type === 'text') return n.text ?? ''
    return (n.content ?? []).map(walk).join('')
  }

  const root = doc as { content?: unknown[] }
  for (const node of root.content ?? []) {
    const text = walk(node)
    if (text.trim()) blocks.push(text)
  }
  return blocks.join('\n\n')
}

/**
 * Map each item's id to its label, appending " (1)", " (2)", etc. when multiple
 * items resolve to the same label — e.g. two eligibility criteria both left
 * named "Intervention" by the user. Labels that are already unique are left as-is.
 */
export function disambiguateLabels<T extends { id: string }>(
  items: T[],
  getLabel: (item: T) => string,
): Map<string, string> {
  const labels = items.map(getLabel)
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)

  const seen = new Map<string, number>()
  const result = new Map<string, string>()
  items.forEach((item, i) => {
    const label = labels[i]
    if ((counts.get(label) ?? 0) <= 1) {
      result.set(item.id, label)
    } else {
      const n = (seen.get(label) ?? 0) + 1
      seen.set(label, n)
      result.set(item.id, `${label} (${n})`)
    }
  })
  return result
}

// ─── Word-limit colour ────────────────────────────────────────────────────────

/**
 * Return a Tailwind text-colour class reflecting how close the user is to
 * their word limit.
 *
 * < 50 % used  -> green
 * 50-80 % used -> yellow
 * 80-95 % used -> orange
 * > 95 % used  -> red
 */
export function getWordLimitColor(used: number, limit: number): string {
  if (limit <= 0) return 'text-gray-400'
  const pct = used / limit

  if (pct >= 0.95) return 'text-red-500'
  if (pct >= 0.8) return 'text-orange-500'
  if (pct >= 0.5) return 'text-yellow-500'
  return 'text-green-500'
}

// ─── Shared primary CTA button ────────────────────────────────────────────────

/**
 * Classes for a tool page's primary submit action (Analyse, Paraphrase, Check
 * grammar, Check sources, etc.) — kept in one place so every "Check & Improve"
 * tool renders the same purple primary button as Rewrite.
 */
export function primaryButtonClass(enabled: boolean): string {
  return cn(
    'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors',
    enabled
      ? 'bg-purple-accent text-white hover:bg-purple-deep'
      : 'bg-[#c4b5fd] text-white cursor-not-allowed',
  )
}

// ─── Duration formatting ──────────────────────────────────────────────────────

/**
 * Format a millisecond duration as a human-legible string.
 * e.g. 850 -> "850ms", 1717 -> "1.7s", 12000 -> "12s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`
}

// ─── File download ────────────────────────────────────────────────────────────

/**
 * Trigger a browser download for an in-memory Blob (e.g. a file fetched from
 * the API as `responseType: 'blob'`) without navigating away from the page.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ─── Plan badge colour ────────────────────────────────────────────────────────

/**
 * Return a Tailwind colour class suitable for a plan badge.
 *
 * Free      -> gray
 * Pro       -> violet/purple
 * Unlimited -> amber/gold
 */
export function getPlanColor(plan: string): string {
  switch (plan) {
    case 'Pro':
      return 'text-violet-600'
    case 'Unlimited':
      return 'text-amber-500'
    case 'Free':
    default:
      return 'text-gray-500'
  }
}
