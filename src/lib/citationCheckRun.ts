// Remembers which check the user was looking at, so a refresh or a return visit lands back on it instead of on an empty page.
// A convenience only: the check itself lives on the server. If storage is unavailable, or the remembered id has since been deleted
// or has expired, the page simply starts empty (the server's 404 is what actually settles that).

const KEY = 'citationCheck.lastRun'

/** The server deletes runs after 30 days; a remembered id older than that cannot still exist. */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): KV | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function rememberRun(id: string, now: number = Date.now(), storage: KV | null = defaultStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify({ id, savedAt: now })) } catch { /* storage full or blocked */ }
}

export function recallRun(now: number = Date.now(), storage: KV | null = defaultStorage()): string | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: unknown; savedAt?: unknown }
    if (typeof parsed.id !== 'string' || typeof parsed.savedAt !== 'number') return null
    return now - parsed.savedAt > MAX_AGE_MS ? null : parsed.id
  } catch {
    return null
  }
}

export function forgetRun(storage: KV | null = defaultStorage()): void {
  try { storage?.removeItem(KEY); storage?.removeItem(META_KEY) } catch { /* nothing to do */ }
}

// What the page knows about the run that the server does not store: the uploaded file's name and how well it was read.
// A convenience only; without it the page just shows no file name.
const META_KEY = 'citationCheck.lastRunMeta'
export interface RunMeta { id: string; fileName: string | null; warnings: string[] }

export function rememberRunMeta(meta: RunMeta, storage: KV | null = defaultStorage()): void {
  try { storage?.setItem(META_KEY, JSON.stringify(meta)) } catch { /* storage full or blocked */ }
}

export function recallRunMeta(id: string, storage: KV | null = defaultStorage()): RunMeta | null {
  try {
    const raw = storage?.getItem(META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RunMeta>
    if (parsed.id !== id) return null
    return {
      id,
      fileName: typeof parsed.fileName === 'string' ? parsed.fileName : null,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((w): w is string => typeof w === 'string') : [],
    }
  } catch { return null }
}
