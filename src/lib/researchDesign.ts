import type { DesignEvidence, ResearchDesignView } from '../types/researchDesign'

export const humanLabel = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
const stages: Record<string, string> = {
  Created: 'Your research design is queued', LoadingResearchState: 'Understanding your research questions', ClassifyingIntent: 'Understanding your research aims',
  GeneratingCandidates: 'Considering suitable approaches', EvaluatingCandidates: 'Comparing research approaches', BuildingDesign: 'Building your research design',
  ValidatingAlignment: 'Checking questions and objectives', ValidatingAnalysis: 'Checking your analysis plan', ValidatingFeasibility: 'Checking what is achievable', ValidatingEvidence: 'Reviewing academic evidence',
  RequiresInput: 'We need one detail', RequiresEvidence: 'Checking the evidence', ReadyForReview: 'Your research design is ready to review', Accepted: 'Research design accepted',
  AcceptedSpecification: 'Your accepted research design', NotStarted: 'Build your research design', Failed: "We couldn’t finish your research design", Cancelled: 'Research design stopped', BudgetExhausted: 'Research design needs attention', Superseded: 'This is an earlier research design',
}
export const stageLabel = (status: string) => stages[status] ?? 'Building your research design'
// Scheduling only: this never grants actions or reconstructs readiness.
export function pollInterval(view?: ResearchDesignView): number | false {
  if (!view || ['NotStarted', 'AcceptedSpecification', 'ReadyForReview', 'RequiresInput', 'Accepted', 'Failed', 'Cancelled', 'BudgetExhausted', 'Superseded'].includes(view.status)) return false
  if (view.status === 'RequiresEvidence' && !view.evidence.some(e => ['Queued', 'Investigating', 'ResolvingEvidence', 'AwaitingInvestigation', 'Waiting', 'Stopping'].includes(e.researchStatus))) return false
  return 8000
}
export function evidenceLabel(e: DesignEvidence): string {
  if (e.contradictionPresent) return 'Evidence is mixed'
  if (e.status === 'ProviderUnavailable') return 'We couldn’t complete the evidence check right now'
  if (e.status === 'InsufficientEvidence' || e.status === 'Insufficient' || e.status === 'Unresolved') return 'More evidence is needed'
  if (e.status === 'Supported') return 'Supported by academic evidence'
  if (e.status === 'Stale') return 'Evidence needs checking again'
  if (e.status === 'Contradicted') return 'Evidence challenges this choice'
  if (['Queued', 'Investigating', 'ResolvingEvidence'].includes(e.researchStatus)) return 'Checking academic sources'
  return 'Evidence check not yet complete'
}
export const severityLabel: Record<string, string> = { BLOCKER: 'Must fix', MAJOR: 'Important', MINOR: 'Suggested improvement', WARNING: 'Check', PASS: 'Complete' }
export function designError(error: unknown): { message: string; conflict: boolean; reference?: string } {
  const e = error as { code?: string; correlationId?: string; response?: { status?: number; data?: { error?: { code?: string; correlationId?: string } } } }
  const code = e?.code ?? e?.response?.data?.error?.code ?? ''
  const conflict = e?.response?.status === 409 || /STALE|CONCURRENCY|CONFLICT/.test(code)
  const message = conflict ? 'This research design changed since you opened it. Refresh the latest version before continuing.'
    : /NOT_FOUND/.test(code) || e?.response?.status === 404 ? 'This research design is unavailable or you do not have access.'
    : /CREDIT/.test(code) || e?.response?.status === 402 ? 'There are not enough credits to continue. Check your billing balance.'
    : /INPUT|VALIDATION|EVIDENCE|SCHEMA/.test(code) || e?.response?.status === 422 ? 'We couldn’t apply that action. Review the latest questions and issues before continuing.'
    : e?.response?.status === 429 ? 'Please wait before trying again.' : 'We couldn’t complete the request. Your saved work is safe. Please try again.'
  return { message, conflict, reference: e?.correlationId ?? e?.response?.data?.error?.correlationId }
}
