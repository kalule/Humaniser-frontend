import client from './client'
import type { ConfirmGapScopePayload, GapRun, UseGapResult } from '../types/gapFinder'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

const base = '/api/v1/research/gap-finder'

export const gapFinderApi = {
  /** Queues scope inference only; level and methodology come from the project. */
  start: async (projectId: string, topic: string): Promise<GapRun> =>
    unwrap(await client.post<Wrap<GapRun>>(base, { projectId, topic })),

  get: async (runId: string): Promise<GapRun> =>
    unwrap(await client.get<Wrap<GapRun>>(`${base}/${runId}`)),

  listForProject: async (projectId: string, take = 5): Promise<GapRun[]> =>
    unwrap(await client.get<Wrap<GapRun[]>>(`${base}/projects/${projectId}`, { params: { take } })),

  confirmScope: async (runId: string, payload: ConfirmGapScopePayload): Promise<GapRun> =>
    unwrap(await client.post<Wrap<GapRun>>(`${base}/${runId}/scope`, payload)),

  cancel: async (runId: string): Promise<GapRun> =>
    unwrap(await client.post<Wrap<GapRun>>(`${base}/${runId}/cancel`)),

  retry: async (runId: string): Promise<GapRun> =>
    unwrap(await client.post<Wrap<GapRun>>(`${base}/${runId}/retry`)),

  editCorpus: async (runId: string, removeWorkIds: string[], addDois: string[]): Promise<GapRun> =>
    unwrap(await client.post<Wrap<GapRun>>(`${base}/${runId}/corpus`, { removeWorkIds, addDois })),

  selectGap: async (runId: string, gapId: string, researchQuestion?: string): Promise<UseGapResult> =>
    unwrap(await client.post<Wrap<UseGapResult>>(`${base}/${runId}/use`, { gapId, researchQuestion })),
}
