import type { ApiErrorKind } from '../lib/classifyApiError'

export type DocChatDocStatus = 'ingesting' | 'ready' | 'error'

export interface DocChatDocument {
  documentId: string
  jobId: string
  fileName: string
  pageCount: number | null
  status: DocChatDocStatus
  errorMessage: string | null
}

export interface DocChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sourcePages?: number[]
  createdAt: string
  isLoading?: boolean
  error?: string
  errorKind?: ApiErrorKind
}

// ── API response shapes ────────────────────────────────────────────────────────

export interface DocChatIngestResponse {
  jobId: string
  documentId: string
}

export interface DocChatJobStatus {
  jobId: string
  status: 'processing' | 'completed' | 'failed'
  error?: string
  pageCount?: number
  chunkCount?: number
}

export interface DocChatQueryRequest {
  documentId: string
  query: string
  highQuality?: boolean
}

export interface DocChatQueryResponse {
  answer: string
  sourcePages: number[]
}
