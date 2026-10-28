import client from './client'

export interface HumaniseBlock { id: string; text: string; kind: string; lockedSpans?: { start: number; length: number }[] | null }
export interface EditingSettings {
  strength: 'light' | 'substantial'
  genre: 'general' | 'academic' | 'technical' | 'business' | 'personal'
  voice: 'preserve' | 'professional' | 'casual' | 'warm' | 'blunt'
  englishVariant: 'preserve' | 'en-GB' | 'en-US' | 'en-ZA'
}
export interface BlockSuggestion { id: string; original: string; text: string; accepted: boolean; reasonCode: string | null }
export interface HumaniseJobResult {
  jobId: string
  outcome: 'cancelled' | 'validation_failed' | 'partially_changed' | 'changed' | 'provider_failed' | 'unchanged'
  sourceVersion: string
  blocks: BlockSuggestion[]
  warnings: { code: string; blockId: string | null }[]
  usageUncertain: boolean
}
export interface HumaniseJobView { jobId: string; state: string; createdAt: string; result: HumaniseJobResult | null }
export interface HumaniseJobRequest { idempotencyKey: string; blocks: HumaniseBlock[]; settings: EditingSettings; format: 'plain_text' }
const base = '/api/v1/humanise/jobs'
export const humaniseJobs = {
  capabilities: async () => (await client.get<{ enabled: boolean }>(`${base}/capabilities`)).data,
  start: async (request: HumaniseJobRequest) => (await client.post<HumaniseJobView>(base, request)).data,
  get: async (id: string, signal?: AbortSignal) => (await client.get<HumaniseJobView>(`${base}/${encodeURIComponent(id)}`, { signal })).data,
  cancel: async (id: string) => (await client.post<HumaniseJobView>(`${base}/${encodeURIComponent(id)}/cancel`)).data,
  apply: async (id: string, sourceVersion: string, currentBlocks: HumaniseBlock[], selectedBlockIds: string[]) =>
    (await client.post<{ outcome: string; version: string; blocks: HumaniseBlock[] }>(`${base}/${encodeURIComponent(id)}/apply`, { sourceVersion, currentBlocks, selectedBlockIds }, { timeout: 480_000 })).data,
  delete: async (id: string) => client.delete(`${base}/${encodeURIComponent(id)}`),
}
