import client from './client'
import type { ProposalJourneySummary, ProposalJourneyView, WritingExperience } from '../types/proposalJourney'
const base = '/api/v1/research/proposal-journeys'
// The shared authenticated client has already unwrapped the platform envelope.
const list = (data: ProposalJourneySummary[]): ProposalJourneySummary[] => {
  if (!Array.isArray(data)) throw new Error('Proposal state is unavailable.')
  return data
}
const view = (data: ProposalJourneyView): ProposalJourneyView => {
  if (!data?.summary || !Array.isArray(data.summary.allowedActions)) throw new Error('Proposal state is unavailable.')
  return data
}
export const proposalJourneyApi = {
  list: async (signal?: AbortSignal): Promise<ProposalJourneySummary[]> => list((await client.get<ProposalJourneySummary[]>(base, { signal })).data),
  current: async (id: string, signal?: AbortSignal): Promise<ProposalJourneyView> => view((await client.get<ProposalJourneyView>(`${base}/${id}`, { signal })).data),
  writing: async (id: string, mode: WritingExperience, expectedRevisionId: string, idempotencyKey: string): Promise<ProposalJourneyView> => view((await client.post<ProposalJourneyView>(`${base}/${id}/writing-experience`, { mode, expectedRevisionId, idempotencyKey })).data),
}
