import type { GenerationStatus } from '../types/research'

export async function resumeOnOpen(projectId: string, target: number, api: {
  getGenerationStatus: (id: string) => Promise<GenerationStatus>
  generateAutonomous: (id: string, target: number) => Promise<GenerationStatus>
}): Promise<GenerationStatus> {
  const status = await api.getGenerationStatus(projectId)
  const incomplete = status.completedCount < status.totalCount || status.failedCount > 0
  if (status.status === 'Cancelled' || status.status === 'Error' || (status.status === 'Completed' && incomplete)) {
    return api.generateAutonomous(projectId, target)
  }
  return status
}

export function autonomousStatusBadge(status: GenerationStatus) {
  const complete = status.totalCount > 0 && status.completedCount >= status.totalCount && !status.failedCount
  const pct = status.totalCount > 0
    ? Math.min(complete && status.status === 'Completed' ? 100 : 99, Math.round(status.completedCount / status.totalCount * 100)) : 0
  const label = status.status === 'NeedsReview' ? 'Needs review'
    : status.status === 'Cancelled' ? 'Stopped'
    : status.status === 'Error' ? 'Failed'
    : status.status === 'Completed' ? (complete ? 'Complete' : 'Incomplete')
    : status.status === 'NotStarted' ? 'Not started'
    : status.status === 'Starting' ? 'Starting' : 'Generating'
  return {
    label: label === 'Complete' || label === 'Not started' ? label : `${pct}% · ${label}`,
    className: label === 'Complete' ? 'bg-emerald-50 text-emerald-700'
      : ['Stopped', 'Failed', 'Needs review', 'Incomplete'].includes(label) ? 'bg-amber-50 text-amber-700'
      : 'bg-[var(--color-purple-tint)] text-[var(--color-purple-text)]',
    progressPct: pct,
  }
}
