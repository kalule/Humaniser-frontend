import client from './client'
import { downloadBlob } from '../lib/utils'
import type { EvidenceBinding, GapDossier, ResearchSpecification, WorkflowHistory, WorkflowSource, WorkflowState, ProposalDesignReadiness, ProposalRepairPreview } from '../types/proposalWorkflow'

const base = (id: string) => `/api/v1/research/projects/${id}/proposal-workflow`
// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data
export const proposalWorkflowApi = {
  readiness: async (id: string, signal?: AbortSignal): Promise<ProposalDesignReadiness> => data(await client.get(`${base(id)}/readiness`, { signal })),
  bindDesign: async (id: string, expectedRevisionId: string, expectedBoundRevisionId: string | null, idempotencyKey: string): Promise<ProposalDesignReadiness> => data(await client.post(`${base(id)}/design-binding`, { expectedRevisionId, expectedBoundRevisionId, idempotencyKey })),
  repairPreview: async (id: string, sectionCode: string, expectedRevisionId: string, expectedContentVersion: string): Promise<ProposalRepairPreview> => data(await client.post(`${base(id)}/sections/repair-preview`, { sectionCode, expectedRevisionId, expectedContentVersion })),
  state: async (id: string): Promise<WorkflowState> => data(await client.get(base(id))),
  history: async (id: string): Promise<WorkflowHistory> => data(await client.get(`${base(id)}/history`)),
  sources: async (id: string): Promise<WorkflowSource[]> => data(await client.get(`${base(id)}/sources`)),
  source: async (id: string, sourceId: string): Promise<{ id: string; abstract: string; fullTextContent: string | null }> => data(await client.get(`${base(id)}/sources/${sourceId}`)),
  accept: async (id: string, expectedRevisionId: string | null, specification: ResearchSpecification) => data(await client.post(`${base(id)}/specifications/accept`, { expectedRevisionId, reconciledLegacyState: true, specification })),
  evidence: async (id: string, request: Omit<EvidenceBinding, 'id' | 'sourceHash' | 'corpusHash' | 'status' | 'message'>) => data(await client.post(`${base(id)}/evidence`, request, { timeout: 120_000 })),
  gap: async (id: string, request: GapDossier) => data(await client.post(`${base(id)}/gap`, request, { timeout: 120_000 })),
  generate: async (id: string, sectionCode: string, expectedContentVersion: string | null, idempotencyKey: string, expectedSpecificationRevision?: string, replaceExistingContent?: boolean) => data(await client.post(`${base(id)}/generate`, { sectionCode, expectedContentVersion, idempotencyKey, ...(expectedSpecificationRevision ? { expectedSpecificationRevision } : {}), ...(replaceExistingContent ? { replaceExistingContent: true } : {}) }, { timeout: 180_000 })),
  acceptSection: async (id: string, code: string) => data(await client.post(`${base(id)}/sections/${encodeURIComponent(code)}/accept`)),
  reconcileSection: async (id: string, sectionCode: string, expectedContentVersion: string, content: string, evidenceIds: string[], expectedSpecificationRevision?: string, idempotencyKey?: string) => data(await client.post(`${base(id)}/sections/reconcile`, { sectionCode, expectedContentVersion, content, evidenceIds, ...(expectedSpecificationRevision ? { expectedSpecificationRevision } : {}), ...(idempotencyKey ? { idempotencyKey } : {}) })),
  review: async (id: string, type: 'semantic' | 'examiner') => data(await client.post(`${base(id)}/reviews/${type}`, {}, { timeout: 180_000 })),
  finalize: async (id: string, expectedFingerprint: string): Promise<{ id: string; documentHash: string }> => data(await client.post(`${base(id)}/finalize`, { expectedFingerprint })),
  download: async (id: string, artifactId: string) => {
    const response = await client.get(`${base(id)}/finalizations/${artifactId}/download`, { responseType: 'blob' })
    downloadBlob(response.data, 'Finalized-proposal.docx')
  },
}
