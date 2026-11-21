import type { GenerationStatus, ResearchProject } from '../types/research'

export function generationSignature(status: Pick<GenerationStatus, 'status' | 'completedCount'>): string {
  return `${status.status}|${status.completedCount}`
}

export function shouldRecoverGeneration(status: GenerationStatus, dismissed: string | null): boolean {
  if (status.status === 'Starting' || status.status === 'Generating') return true
  // A completed writing count says nothing about evidence review or acceptance.
  // Closing a review panel must never hide an unresolved review on the next visit.
  if (status.status === 'NeedsReview') return true
  const incomplete = status.completedCount < status.totalCount || status.failedCount > 0
  return incomplete && ['Error', 'Cancelled', 'Completed'].includes(status.status)
    && dismissed !== generationSignature(status)
}

export async function recoverProposalGeneration(
  projects: ResearchProject[],
  getStatus: (id: string) => Promise<GenerationStatus>,
  readDismissed: (id: string) => string | null,
) {
  const candidates = projects
    .filter(p => p.generatorMode === 'AGENT' && p.documentMode === 'PROPOSAL')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  // Statuses are fetched a few at a time instead of strictly one after another; the choice below still walks them in
  // newest-first order, so the result is the same as the sequential version.
  const statuses = await mapWithConcurrency(candidates, RECOVERY_STATUS_CONCURRENCY, async project => {
    try {
      return await getStatus(project.id)
    } catch {
      // An unavailable project's status must not hide other recoverable jobs.
      return null
    }
  })
  let terminal: { project: ResearchProject; status: GenerationStatus } | null = null
  for (let i = 0; i < candidates.length; i++) {
    const project = candidates[i], status = statuses[i]
    if (!status || !shouldRecoverGeneration(status, readDismissed(project.id))) continue
    // An older running job must remain visible even if a newer draft exists.
    if (status.status === 'Starting' || status.status === 'Generating') return { project, status }
    terminal ??= { project, status }
  }
  return terminal
}

/** At most this many generation-status requests run at once while recovering. */
export const RECOVERY_STATUS_CONCURRENCY = 4

/** Maps items with at most `limit` calls in flight, keeping results in input order. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker))
  return results
}
