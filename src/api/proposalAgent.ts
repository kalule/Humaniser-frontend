import axios from 'axios'
import client from './client'
import type { AgentActivity, AgentEvidenceAcceptResult, AgentEvidenceState } from '../types/proposalAgent'

const project = (id: string) => `/api/v1/research/projects/${id}`
// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data

/** An older API that 404s is treated as "agent off". Current APIs answer "off" with 200 and an empty or Unavailable body. */
const offWhenNotFound = async <T>(call: () => Promise<T>): Promise<T | null> => {
  try { return await call() }
  catch (e) { if (axios.isAxiosError(e) && e.response?.status === 404) return null; throw e }
}

export const proposalAgentApi = {
  activity: (projectId: string, section?: string, signal?: AbortSignal): Promise<AgentActivity | null> =>
    offWhenNotFound(async () => data(await client.get(`${project(projectId)}/agent-activity`, { params: section ? { section } : undefined, signal }))),

  /** Null when suggested evidence is unavailable (agent off, or no accepted research design): the panel does not appear. */
  evidence: async (projectId: string, signal?: AbortSignal): Promise<AgentEvidenceState | null> => {
    const state = await offWhenNotFound(async () => data<AgentEvidenceState>(await client.get(`${project(projectId)}/proposal-workflow/agent-evidence`, { signal })))
    return state && state.status !== 'Unavailable' ? state : null
  },

  prepareEvidence: async (projectId: string): Promise<AgentEvidenceState> =>
    data(await client.post(`${project(projectId)}/proposal-workflow/agent-evidence/run`)),

  /** Runs one paid source check per proposal; may refuse with code AGENT_EVIDENCE_WOULD_STALE_BINDINGS. */
  acceptEvidence: async (projectId: string, proposalIds: string[], acknowledgeStaleBindings = false): Promise<AgentEvidenceAcceptResult> =>
    data(await client.post(`${project(projectId)}/proposal-workflow/agent-evidence/accept`, { proposalIds, acknowledgeStaleBindings }, { timeout: 300_000 })),

  dismissEvidence: async (projectId: string, proposalIds: string[]): Promise<AgentEvidenceState> =>
    data(await client.post(`${project(projectId)}/proposal-workflow/agent-evidence/dismiss`, { proposalIds })),
}

export const STALE_BINDINGS_CODE = 'AGENT_EVIDENCE_WOULD_STALE_BINDINGS'

/** The server's refusal code and message, when the error carries one. */
export function serverRefusal(error: unknown): { code: string | null; message: string | null } {
  if (!axios.isAxiosError(error)) return { code: null, message: null }
  const body = error.response?.data as { code?: string; message?: string } | undefined
  return { code: body?.code ?? null, message: body?.message ?? null }
}
