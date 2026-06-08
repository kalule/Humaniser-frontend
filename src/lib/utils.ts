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
