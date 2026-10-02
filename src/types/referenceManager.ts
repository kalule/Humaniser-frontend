export type ReferenceManagerProvider = 'zotero' | 'mendeley'
export interface ReferenceManagerConnection { id: string; provider: ReferenceManagerProvider; status: string; isConfigured: boolean; displayName?: string; email?: string; lastSuccessfulImportAt?: string; lastErrorCode?: string }
export interface ExternalReferenceCollection { id: string; name: string; itemCount?: number }
export interface ExternalReferencePreview { id: string; title: string; authors: string[]; year?: number; source?: string; doi?: string; abstract?: string; hasPdf: boolean; classification: string; modifiedAt?: string; version?: string }
export interface ExternalReferencePage { items: ExternalReferencePreview[]; nextCursor?: string; total?: number }
export interface ReferenceImport { id: string; provider: ReferenceManagerProvider; status: string; totalSelected: number; processed: number; imported: number; alreadyPresent: number; updated: number; skipped: number; pdfsImported: number; pdfsUnavailable: number; pdfsFailed: number; referencesFailed: number; currentItem?: string; errorCode?: string; startedAt?: string; completedAt?: string }
