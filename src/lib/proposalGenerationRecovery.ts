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
  let terminal: { project: ResearchProject; status: GenerationStatus } | null = null
  for (const project of candidates) {
    try {
      const status = await getStatus(project.id)
      if (!shouldRecoverGeneration(status, readDismissed(project.id))) continue
      // An older running job must remain visible even if a newer draft exists.
      if (status.status === 'Starting' || status.status === 'Generating') return { project, status }
      terminal ??= { project, status }
    } catch {
      // An unavailable project's status must not hide other recoverable jobs.
    }
  }
  return terminal
}
