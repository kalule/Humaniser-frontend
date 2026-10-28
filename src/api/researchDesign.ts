import client from './client'
import type { DesignCommandResult, DesignHistory, DesignInputCommand, DesignStartCommand, DesignVersionCommand, ResearchDesignView } from '../types/researchDesign'

const base = (projectId: string) => `/api/v1/research/projects/${encodeURIComponent(projectId)}/design`
// The shared authenticated client unwraps the platform success envelope.
export const researchDesignApi = {
  current: async (projectId: string, signal?: AbortSignal) => (await client.get<ResearchDesignView>(base(projectId), { signal })).data,
  run: async (projectId: string, runId: string, signal?: AbortSignal) => (await client.get<ResearchDesignView>(`${base(projectId)}/runs/${encodeURIComponent(runId)}`, { signal })).data,
  history: async (projectId: string, cursor?: string, signal?: AbortSignal) => (await client.get<DesignHistory>(`${base(projectId)}/history`, { params: { take: 20, cursor }, signal })).data,
  start: async (projectId: string, command: DesignStartCommand) => (await client.post<DesignCommandResult>(`${base(projectId)}/runs`, command)).data,
  input: async (projectId: string, runId: string, command: DesignInputCommand) => (await client.post<DesignCommandResult>(`${base(projectId)}/runs/${encodeURIComponent(runId)}/input`, command)).data,
  accept: async (projectId: string, runId: string, command: DesignVersionCommand) => (await client.post<DesignCommandResult>(`${base(projectId)}/runs/${encodeURIComponent(runId)}/accept`, command)).data,
  revise: async (projectId: string, runId: string, command: DesignVersionCommand) => (await client.post<DesignCommandResult>(`${base(projectId)}/runs/${encodeURIComponent(runId)}/revisions`, command)).data,
  cancel: async (projectId: string, runId: string, command: DesignVersionCommand) => (await client.post<DesignCommandResult>(`${base(projectId)}/runs/${encodeURIComponent(runId)}/cancel`, command)).data,
}
