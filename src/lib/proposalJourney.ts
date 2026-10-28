import type { ProposalJourneySummary } from '../types/proposalJourney'
export type ProposalFilter = 'all' | 'inProgress' | 'attention' | 'reviewed'
const stages: Record<string, string> = {
  SettingUp: 'Setting up', Designing: 'Designing study', NeedsInput: 'Needs your input', CheckingEvidence: 'Checking evidence',
  DesignReady: 'Design ready to review', ReadyToWrite: 'Ready to write', Writing: 'Writing proposal', NeedsAttention: 'Needs attention',
  ReadyForReview: 'Ready for review', CompletedVersionAvailable: 'Completed version available',
}
const actions: Record<string, string> = { CompleteDesign: 'Continue design', ReviewChanges: 'Review changes', ChooseWritingMode: 'Start writing', ContinueWriting: 'Continue writing', ReviewProposal: 'Review proposal', ContinueLegacy: 'Open proposal' }
// Presentation only. These labels never grant a domain command.
export const proposalStageLabel = (stage?: string) => stage ? stages[stage] ?? 'Open proposal to check status' : 'Open proposal to check status'
export const proposalNextLabel = (action?: string) => action ? actions[action] ?? 'Open' : 'Open'
export function matchesProposalFilter(view: ProposalJourneySummary | undefined, filter: ProposalFilter): boolean {
  if (filter === 'all') return true
  if (!view) return false
  if (filter === 'attention') return ['NeedsInput', 'NeedsAttention'].includes(view.stage)
  if (filter === 'reviewed') return view.stage === 'CompletedVersionAvailable'
  return view.stage !== 'CompletedVersionAvailable'
}
export const workspaceTab = (action: string): 'design' | 'sections' | 'review' => action === 'CompleteDesign' ? 'design' : ['ReviewProposal'].includes(action) ? 'review' : 'sections'
export function proposalError(error: unknown): string {
  const e = error as { code?: string; response?: { status?: number; data?: { code?: string } } }
  const status = e?.response?.status
  if (status === 502 || status === 503 || status === 504 || (!status && ['ERR_NETWORK', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT'].includes(e?.code ?? ''))) return 'The server is unavailable. Check that the API is running, then try again.'
  if (status === 401 || status === 403 || status === 404) return 'This proposal is unavailable or you do not have access. Sign in again or return to your proposals.'
  if (status === 409) return 'Your proposal or research design changed. Refresh the latest version before continuing.'
  if (status === 402) return 'There are not enough credits to continue. Check your balance.'
  if (status === 400 || status === 422) return 'Review the required research details before continuing.'
  return 'We could not complete that request. Your saved work is safe. Please try again.'
}

// Store only an opaque digest and command ID, never the student's research text.
export async function proposalCommandKey(payload: unknown): Promise<{ key: string; storageKey: string }> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))
  const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
  const storageKey = `proposal-command:${hash}`
  let key: string | null = null
  try { key = sessionStorage.getItem(storageKey) } catch { /* storage may be disabled */ }
  key ??= crypto.randomUUID()
  try { sessionStorage.setItem(storageKey, key) } catch { /* callers retain the key in memory */ }
  return { key, storageKey }
}
export function forgetProposalCommand(storageKey: string) {
  try { sessionStorage.removeItem(storageKey) } catch { /* storage may be disabled */ }
}
