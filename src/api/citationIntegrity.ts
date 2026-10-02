import client from './client'
import type { CitationAuditResponse } from '../types/citationIntegrity'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

export const citationIntegrityApi = {
  audit: async (text: string): Promise<CitationAuditResponse> =>
    unwrap(await client.post<Wrap<CitationAuditResponse>>('/api/v1/citation-integrity/audit', { text })),
}
