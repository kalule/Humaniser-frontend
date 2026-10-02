import client from './client'
import type { ExternalReferenceCollection, ExternalReferencePage, ReferenceImport, ReferenceManagerConnection, ReferenceManagerProvider } from '../types/referenceManager'
const unwrap = <T,>(v: { data?: T } | T) => ((v as { data?: T }).data ?? v) as T
const base = '/api/v1/research-library/integrations'
export const referenceManagerApi = {
  connections: async () => unwrap<ReferenceManagerConnection[]>((await client.get(base)).data),
  connect: async (provider: ReferenceManagerProvider) => unwrap<{ authorizationUrl: string }>((await client.post(`${base}/${provider}/connect`)).data),
  disconnect: async (provider: ReferenceManagerProvider) => { await client.delete(`${base}/${provider}`) },
  collections: async (provider: ReferenceManagerProvider) => unwrap<ExternalReferenceCollection[]>((await client.get(`${base}/${provider}/collections`)).data),
  items: async (provider: ReferenceManagerProvider, params: { externalCollectionId?: string; query?: string; cursor?: string; pageSize?: number }) => unwrap<ExternalReferencePage>((await client.get(`${base}/${provider}/items`, { params })).data),
  startImport: async (payload: object) => unwrap<ReferenceImport>((await client.post('/api/v1/research-library/imports', payload)).data),
  importStatus: async (id: string) => unwrap<ReferenceImport>((await client.get(`/api/v1/research-library/imports/${id}`)).data),
  retryImport: async (id: string) => unwrap<ReferenceImport>((await client.post(`/api/v1/research-library/imports/${id}/retry`)).data),
}
