/**
 * A rewrite started over text the student edited. `before` is their text when the rewrite began;
 * `after` is the rewrite once it lands (null while the agent is still writing). The student's text
 * is put back and the rewrite held here until they accept or reject each change.
 *
 * Kept in this browser's storage per project, so a reload does not lose the pending decision. If
 * storage is unavailable it lives for the session only; the server's section History still has
 * the replaced draft either way.
 */
export interface RewriteReview {
  before:    string
  after:     string | null
  startedAt: string
}

const key = (projectId: string) => `dm.rewriteReviews.${projectId}`

export function readRewriteReviews(projectId: string): Record<string, RewriteReview> {
  try {
    const raw = localStorage.getItem(key(projectId))
    const parsed = raw ? JSON.parse(raw) as Record<string, RewriteReview> : {}
    const out: Record<string, RewriteReview> = {}
    for (const [code, r] of Object.entries(parsed ?? {})) {
      if (r && typeof r.before === 'string' && (typeof r.after === 'string' || r.after === null)) out[code] = r
    }
    return out
  } catch {
    return {}
  }
}

export function writeRewriteReviews(projectId: string, reviews: Record<string, RewriteReview>): void {
  try {
    if (Object.keys(reviews).length) localStorage.setItem(key(projectId), JSON.stringify(reviews))
    else localStorage.removeItem(key(projectId))
  } catch { /* session-only then */ }
}

/**
 * Whether a pending rewrite has finished while this page was not watching it (reload, other tab):
 * the section is no longer being written and was generated after the rewrite started.
 */
export function rewriteLanded(review: RewriteReview, section: { status: string; generatedAt: string | null; content: string } | undefined): boolean {
  if (!section || review.after !== null || section.status === 'Generating' || !section.generatedAt) return false
  return Date.parse(section.generatedAt) > Date.parse(review.startedAt) && section.content !== review.before
}
