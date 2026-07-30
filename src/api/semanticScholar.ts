// Proxies literature search through HumaniseAI's own backend
// (POST /api/v1/workbench/validate-literature -> ILiteratureService ->
// Semantic Scholar), rather than calling api.semanticscholar.org directly
// from the browser. That endpoint already existed — it holds the Semantic
// Scholar API key server-side (SemanticScholar:ApiKey in appsettings) and
// has its own retry/timeout policy, so this call is authenticated, not
// subject to the public unauthenticated rate-limit pool, and swallows
// upstream Semantic Scholar failures into an empty result set rather than
// surfacing a 429/500 to the browser.

import client from './client'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

export interface LiteratureCitation {
  paperId:       string
  title:         string
  authors:       string[]
  year:          number | null
  abstract:      string | null
  url:           string | null
  doi:           string | null
  citationCount: number | null
  journal:       string | null
}

interface ValidateLiteratureResponse {
  query:            string
  citations:        LiteratureCitation[]
  totalReturned:    number
  processingTimeMs: number
}

export const MIN_QUERY_LENGTH = 5

export async function findSimilarPapers(query: string, limit = 20): Promise<LiteratureCitation[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) {
    throw new Error(`Enter at least ${MIN_QUERY_LENGTH} characters to search.`)
  }
  const res = await client.post<Wrap<ValidateLiteratureResponse>>('/api/v1/workbench/validate-literature', {
    query: trimmed,
    limit,
  })
  return unwrap(res).citations
}
