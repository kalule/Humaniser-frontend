import client from './client'
import { downloadBlob } from '../lib/utils'

// Qualitative Analysis (backend docs/qualitative-analysis-spec.md). The shared client unwraps the server's
// { success, data } envelope and turns { error: { code, message } } into a rejected { code, message }.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/qualitative-analysis'

export type QualMethod = 'ReflexiveTA' | 'CodebookTA' | 'ContentAnalysis' | 'Framework' | 'GroundedTheory' | 'IPA'
export type AiMode = 'ManualOnly' | 'AiAssisted'
export type SpeakerRole = 'Participant' | 'Interviewer' | 'Moderator'
export type ListedClass = 'PERSON' | 'ORG' | 'PLACE' | 'ROLE' | 'OTHER'

export interface QualAvailability {
  enabled: boolean
  /** AI suggestions are switched on and a provider is approved. A study must also be set to AiAssisted. */
  ai: boolean
  agreement: boolean
  audio: boolean
  methods: QualMethod[]
  retentionDays: number
  maxTranscriptWords: number
  maxTranscriptsPerStudy: number
  fileTypes: string[]
}

export interface QualStudy {
  id: string
  title: string
  method: QualMethod
  analysisLanguage: string
  aiMode: AiMode
  projectId: string | null
  createdAt: string
  updatedAt: string
  deleteAfter: string
  agreementApplies: boolean
  hasIdentifierKey: boolean
  transcripts: number
  transcriptsReady: number
  participants: number
  participantWords: number
  /** Owner, or SecondCoder for a study someone else invited you to code. */
  myRole: 'Owner' | 'SecondCoder'
}

export interface QualSegment { id: string; ordinal: number; turnIndex: number; role: string; pseudonym: string | null; participantId: string | null; start: number; end: number; timestamp: string | null }

export interface QualTranscript {
  id: string
  studyId: string
  label: string
  /** Imported, InReview or Ready. Only Ready transcripts can be coded. */
  status: string
  sourceKind: string
  version: number
  wordCount: number
  participantWordCount: number
  contentHash: string | null
  createdAt: string
  confirmedAt: string | null
  text: string | null
  segments: QualSegment[] | null
}

export interface QualSpeaker { label: string; turns: number; words: number; role: SpeakerRole | null; pseudonym: string | null }
export interface QualListedItem { text: string; class: ListedClass; speakerLabel?: string | null }
export interface QualReviewChoices { speakers: { label: string; role: SpeakerRole; participantId?: string | null }[]; listed: QualListedItem[]; replaceLongNumbers: boolean }

export interface QualReview {
  id: string
  studyId: string
  label: string
  status: string
  sourceKind: string
  wordCount: number
  speakers: QualSpeaker[]
  speakersAssigned: boolean
  text: string
  textIsDeidentified: boolean
  replacements: { class: string; token: string; count: number }[]
  /** Things that still look like identifiers after replacement: class and count only. */
  residual: { class: string; count: number }[]
  choices: QualReviewChoices | null
  notes: string[]
}

export interface QualCode {
  id: string
  name: string
  definition: string
  inclusionNotes: string
  exclusionNotes: string
  parentId: string | null
  status: 'Active' | 'Retired' | 'Merged'
  mergedIntoId: string | null
  provenance: string
  createdAt: string
  updatedAt: string
  applications: number
  segments: number
  participants: number
  transcripts: number
}

export interface QualApplication { id: string; transcriptId: string; segmentId: string; codeId: string; coderId: string; start: number; end: number; provenance: string; needsReview: boolean; createdAt: string }
export interface QualExcerpt { applicationId: string; transcriptId: string; transcriptLabel: string; segmentOrdinal: number; role: string; pseudonym: string | null; start: number; end: number; text: string; needsReview: boolean }
export type MemoKind = 'Reflexive' | 'Code' | 'Transcript' | 'Comparison' | 'Case'
export interface QualMemo { id: string; kind: MemoKind; targetId: string | null; body: string; createdAt: string; updatedAt: string }

export interface QualStats {
  studyId: string
  coderId: string
  computedAt: string
  participantsInStudy: number
  transcriptsReady: number
  activeCodes: number
  totalApplications: number
  participantsWithAnyCode: number
  codes: { codeId: string; name: string; status: string; applications: number; segments: number; participantSegments: number; participants: number; transcripts: number;
    byTranscript: { transcriptId: string; label: string; applications: number; segments: number }[] }[]
  coOccurrence: { codeA: string; nameA: string; codeB: string; nameB: string; segments: number }[]
  coverage: { transcriptId: string; label: string; participantSegments: number; codedParticipantSegments: number; segmentShare: number | null; participantCharacters: number; codedParticipantCharacters: number; characterShare: number | null }[]
  note: string
}

export interface QualEvidence {
  id: string; codeId: string | null; codeName: string | null; transcriptId: string; transcriptLabel: string; segmentId: string; segmentOrdinal: number | null
  participantId: string; pseudonym: string | null; start: number; end: number
  /** Verified: the words are this participant's, in this transcript as it is now. NotVerified: text is null and problem says why. */
  state: 'Verified' | 'NotVerified'; text: string | null; problem: string | null; provenance: string; verifiedAt: string; createdAt: string
  themeId: string | null; themeName: string | null
}
export interface QualEvidenceList { quotes: QualEvidence[]; verified: number; notVerified: number; participantsQuoted: number; note: string }

export interface QualLanguageCheck { transcriptId: string; analysisLanguage: string; status: 'Checked' | 'NotSupported'; flagged: { segmentId: string; ordinal: number; spans: { start: number; end: number }[] }[]; checkedWords: number; flaggedWords: number; note: string }

export interface QualRedaction { transcript: QualTranscript; token: string; occurrences: number; applicationsMoved: number; applicationsNeedingReview: number; evidenceQuotesNotVerified: number }

export interface QualRunEstimate { transcriptId: string; segmentsToSend: number; segmentsAlreadySuggested: number; batches: number; batchesLeftForLater: number; maxCredits: number; provider: string; model: string; languageWarnings: boolean; note: string }
export interface QualRun {
  id: string; studyId: string; transcriptId: string | null; step: string; status: 'Queued' | 'Running' | 'Succeeded' | 'Failed'; failureCode: string | null; provider: string; model: string; promptVersion: string
  batches: number; batchesProcessed: number; batchesFailed: number; proposed: number; stored: number; droppedUnverifiable: number; droppedWrongSegment: number; droppedInvalid: number
  droppedPreviouslyRejected: number; oneLabelBatches: number; inputTokens: number | null; outputTokens: number | null; costUsd: number | null; creditsCharged: number; createdAt: string; finishedAt: string | null; warning: string | null
}
export interface QualSuggestion {
  id: string; runId: string; transcriptId: string; transcriptLabel: string; segmentId: string; segmentOrdinal: number | null; pseudonym: string | null; start: number; end: number
  quote: string | null; state: 'Verified' | 'NotVerified'; codeName: string; definition: string; existingCodeId: string | null; status: 'Pending' | 'Accepted' | 'Edited' | 'Rejected'
  languageNote: string | null; resultCodeId: string | null; resultApplicationId: string | null; createdAt: string
}
export interface QualDecision { suggestion: QualSuggestion; code: QualCode | null; application: QualApplication | null }

export interface QualThemeCode { id: string; name: string; status: string; applications: number; participants: number }
export interface QualTheme {
  id: string; name: string; definition: string; status: 'Draft' | 'Final'; provenance: string; sortOrder: number; codes: QualThemeCode[]
  passages: number; participants: number; participantsInStudy: number; transcripts: number; quotesVerified: number; quotesNotVerified: number; createdAt: string; updatedAt: string
}
export interface QualThemeList { themes: QualTheme[]; codesInNoTheme: QualThemeCode[]; note: string }
export interface QualCoder { id: string; label: string; kind: 'Owner' | 'Second' | 'Import'; email: string | null; transcriptsFinished: number; passages: number; createdAt: string }
export interface QualCompletion { transcriptId: string; coderId: string; coderLabel: string; completedAt: string; current: boolean }
export interface QualAgreementCode {
  codeId: string; name: string; units: number; both: number; onlyA: number; onlyB: number; neither: number; percentAgreement: number; kappa: number | null; alpha: number | null
  undefinedReason: string | null; disagreements: { segmentId: string; transcriptId: string; transcriptLabel: string; ordinal: number; pseudonym: string | null; codedBy: string }[]
}
export interface QualAgreement {
  coderA: string; coderALabel: string; coderB: string; coderBLabel: string; transcriptsCompared: number; transcriptsWaiting: number; units: number
  pooledPercentAgreement: number | null; pooledKappa: number | null; pooledUndefinedReason: string | null; codes: QualAgreementCode[]; note: string
}
export interface QualMethodsText { text: string; disclosure: string; notes: string[]; version: string; builtAt: string }
export type ExportKind = 'codebook' | 'excerpts' | 'quotes' | 'statistics' | 'audit' | 'report' | 'coreq' | 'srqr' | 'coding-template'
export interface QualChecklistItem { number: number; domain: string; title: string; guidance: string; suggestion: string | null; suggestionSource: string | null; answer: string | null; notApplicable: boolean; updatedAt: string | null }
export interface QualChecklist { id: 'COREQ' | 'SRQR'; name: string; citation: string; note: string; items: QualChecklistItem[]; answered: number; total: number }
export interface QualCoderImport { coder: QualCoder; turns: number; passages: number; transcriptsFinished: number; warnings: string[] }
export interface QualThemeRunEstimate { studyId: string; codesToSend: number; codesLeftOut: number; maxCredits: number; provider: string; model: string; enoughCodes: boolean; note: string }
export interface QualThemeSuggestion { id: string; runId: string; name: string; definition: string; codes: { id: string; name: string; status: string }[]; status: 'Pending' | 'Accepted' | 'Edited' | 'Rejected'; resultThemeId: string | null; createdAt: string }

export interface QualAuditEvent { seq: number; at: string; eventType: string; entityType: string; entityId: string | null; detailJson: string; hash: string }

export const qualApi = {
  availability: () => client.get<QualAvailability>(`${base}/availability`).then(data),

  // Studies
  listStudies: () => client.get<QualStudy[]>(`${base}/studies`).then(data),
  getStudy: (id: string) => client.get<QualStudy>(`${base}/studies/${id}`).then(data),
  createStudy: (body: { title: string; method: QualMethod; analysisLanguage: string; aiMode: AiMode; consentAccepted: boolean }) => client.post<QualStudy>(`${base}/studies`, body).then(data),
  updateStudy: (id: string, body: { title?: string; method?: QualMethod; aiMode?: AiMode }) => client.patch<QualStudy>(`${base}/studies/${id}`, body).then(data),
  deleteStudy: (id: string) => client.delete(`${base}/studies/${id}`).then(() => undefined),
  discardIdentifierKey: (id: string) => client.delete<QualStudy>(`${base}/studies/${id}/identifier-key`).then(data),
  audit: (id: string) => client.get<{ events: QualAuditEvent[]; chainIntact: boolean }>(`${base}/studies/${id}/audit`).then(data),

  // Transcripts and de-identification
  listTranscripts: (studyId: string) => client.get<QualTranscript[]>(`${base}/studies/${studyId}/transcripts`).then(data),
  importText: (studyId: string, label: string, text: string) => client.post<QualReview>(`${base}/studies/${studyId}/transcripts`, { label, text }).then(data),
  importFile: (studyId: string, file: File, label: string) => {
    const form = new FormData()
    form.append('file', file)
    if (label) form.append('label', label)
    return client.post<QualReview>(`${base}/studies/${studyId}/transcripts/upload`, form).then(data)
  },
  getTranscript: (id: string) => client.get<QualTranscript>(`${base}/transcripts/${id}`).then(data),
  deleteTranscript: (id: string) => client.delete(`${base}/transcripts/${id}`).then(() => undefined),
  getReview: (id: string) => client.get<QualReview>(`${base}/transcripts/${id}/review`).then(data),
  saveReview: (id: string, choices: QualReviewChoices) => client.put<QualReview>(`${base}/transcripts/${id}/review`, choices).then(data),
  confirm: (id: string) => client.post<QualTranscript>(`${base}/transcripts/${id}/confirm`).then(data),
  languageCheck: (id: string) => client.get<QualLanguageCheck>(`${base}/transcripts/${id}/language-check`).then(data),
  redact: (id: string, body: { start: number; end: number; class: ListedClass; expectedContentHash: string | null }) => client.post<QualRedaction>(`${base}/transcripts/${id}/redact`, body).then(data),

  // Codebook and coding
  listCodes: (studyId: string) => client.get<QualCode[]>(`${base}/studies/${studyId}/codes`).then(data),
  createCode: (studyId: string, body: { name: string; definition?: string; inclusionNotes?: string; exclusionNotes?: string; parentId?: string | null }) => client.post<QualCode>(`${base}/studies/${studyId}/codes`, body).then(data),
  updateCode: (id: string, body: { name?: string; definition?: string; inclusionNotes?: string; exclusionNotes?: string; parentId?: string | null; clearParent?: boolean; status?: 'Active' | 'Retired' }) => client.patch<QualCode>(`${base}/codes/${id}`, body).then(data),
  mergeCode: (id: string, targetId: string) => client.post<QualCode>(`${base}/codes/${id}/merge-into/${targetId}`).then(data),
  deleteCode: (id: string) => client.delete(`${base}/codes/${id}`).then(() => undefined),
  excerpts: (codeId: string) => client.get<QualExcerpt[]>(`${base}/codes/${codeId}/excerpts`).then(data),
  listApplications: (transcriptId: string) => client.get<QualApplication[]>(`${base}/transcripts/${transcriptId}/applications`).then(data),
  applyCode: (transcriptId: string, body: { codeId: string; start: number; end: number }) => client.post<QualApplication[]>(`${base}/transcripts/${transcriptId}/applications`, body).then(data),
  removeApplication: (id: string) => client.delete(`${base}/applications/${id}`).then(() => undefined),

  // Memos
  listMemos: (studyId: string) => client.get<QualMemo[]>(`${base}/studies/${studyId}/memos`).then(data),
  createMemo: (studyId: string, body: { kind: MemoKind; targetId?: string | null; body: string }) => client.post<QualMemo>(`${base}/studies/${studyId}/memos`, body).then(data),
  updateMemo: (id: string, body: string) => client.put<QualMemo>(`${base}/memos/${id}`, { body }).then(data),
  deleteMemo: (id: string) => client.delete(`${base}/memos/${id}`).then(() => undefined),

  // Statistics and evidence
  stats: (studyId: string) => client.get<QualStats>(`${base}/studies/${studyId}/stats`).then(data),
  evidence: (studyId: string, codeId?: string) => client.get<QualEvidenceList>(`${base}/studies/${studyId}/evidence`, { params: codeId ? { codeId } : undefined }).then(data),
  addEvidence: (transcriptId: string, body: { codeId?: string | null; themeId?: string | null; start: number; end: number }) => client.post<QualEvidence>(`${base}/transcripts/${transcriptId}/evidence`, body).then(data),
  deleteEvidence: (id: string) => client.delete(`${base}/evidence/${id}`).then(() => undefined),

  evidenceForTheme: (studyId: string, themeId: string) => client.get<QualEvidenceList>(`${base}/studies/${studyId}/evidence`, { params: { themeId } }).then(data),

  // Themes
  listThemes: (studyId: string) => client.get<QualThemeList>(`${base}/studies/${studyId}/themes`).then(data),
  createTheme: (studyId: string, body: { name: string; definition?: string }) => client.post<QualTheme>(`${base}/studies/${studyId}/themes`, body).then(data),
  updateTheme: (id: string, body: { name?: string; definition?: string; status?: 'Draft' | 'Final'; sortOrder?: number }) => client.patch<QualTheme>(`${base}/themes/${id}`, body).then(data),
  setThemeCodes: (id: string, codeIds: string[]) => client.put<QualTheme>(`${base}/themes/${id}/codes`, { codeIds }).then(data),
  deleteTheme: (id: string) => client.delete(`${base}/themes/${id}`).then(() => undefined),

  // Second coder and agreement
  listCoders: (studyId: string) => client.get<QualCoder[]>(`${base}/studies/${studyId}/coders`).then(data),
  inviteCoder: (studyId: string, email: string) => client.post<QualCoder>(`${base}/studies/${studyId}/coders`, { email }).then(data),
  removeCoder: (id: string) => client.delete(`${base}/coders/${id}`).then(() => undefined),
  completions: (studyId: string) => client.get<QualCompletion[]>(`${base}/studies/${studyId}/completions`).then(data),
  markFinished: (transcriptId: string) => client.post<QualCompletion>(`${base}/transcripts/${transcriptId}/complete`).then(data),
  reopen: (transcriptId: string) => client.delete(`${base}/transcripts/${transcriptId}/complete`).then(() => undefined),
  agreement: (studyId: string, coderId?: string) => client.get<QualAgreement>(`${base}/studies/${studyId}/agreement`, { params: coderId ? { coderId } : undefined }).then(data),

  // Reporting
  methodsText: (studyId: string) => client.get<QualMethodsText>(`${base}/studies/${studyId}/methods-text`).then(data),
  /** Downloads the file the server built. The server leaves out any quote that does not verify now. */
  download: async (studyId: string, kind: ExportKind, format?: 'docx' | 'md'): Promise<void> => {
    const res = await client.get(`${base}/studies/${studyId}/export/${kind}`, { params: format ? { format } : undefined, responseType: 'blob' })
    const disposition = String(res.headers?.['content-disposition'] ?? '')
    const named = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1]
    const fallback = `qualitative-${kind}.${kind === 'report' ? format ?? 'docx' : 'csv'}`
    downloadBlob(res.data as Blob, named ? decodeURIComponent(named) : fallback)
  },

  checklist: (studyId: string, id: 'coreq' | 'srqr') => client.get<QualChecklist>(`${base}/studies/${studyId}/checklists/${id}`).then(data),
  saveChecklistAnswer: (studyId: string, id: 'coreq' | 'srqr', item: number, body: { answer: string; notApplicable: boolean }) =>
    client.put<QualChecklistItem>(`${base}/studies/${studyId}/checklists/${id}/${item}`, body).then(data),
  importCoder: (studyId: string, file: File, label: string) => {
    const form = new FormData()
    form.append('file', file)
    if (label) form.append('label', label)
    return client.post<QualCoderImport>(`${base}/studies/${studyId}/coders/import`, form).then(data)
  },

  // AI theme proposals (code names and definitions only)
  estimateThemes: (studyId: string) => client.get<QualThemeRunEstimate>(`${base}/studies/${studyId}/suggest/themes/estimate`).then(data),
  startThemes: (studyId: string) => client.post<QualRun>(`${base}/studies/${studyId}/suggest/themes`).then(data),
  themeSuggestions: (studyId: string, status?: string) => client.get<QualThemeSuggestion[]>(`${base}/studies/${studyId}/theme-suggestions`, { params: status ? { status } : undefined }).then(data),
  acceptTheme: (id: string) => client.post<{ suggestion: QualThemeSuggestion; themeId: string | null }>(`${base}/theme-suggestions/${id}/accept`).then(data),
  editTheme: (id: string, body: { name?: string; definition?: string; codeIds?: string[] }) => client.post<{ suggestion: QualThemeSuggestion; themeId: string | null }>(`${base}/theme-suggestions/${id}/edit`, body).then(data),
  rejectTheme: (id: string) => client.post(`${base}/theme-suggestions/${id}/reject`).then(() => undefined),

  // AI suggestions
  estimate: (transcriptId: string) => client.get<QualRunEstimate>(`${base}/transcripts/${transcriptId}/suggest/inductive/estimate`).then(data),
  startRun: (transcriptId: string) => client.post<QualRun>(`${base}/transcripts/${transcriptId}/suggest/inductive`).then(data),
  getRun: (id: string) => client.get<QualRun>(`${base}/runs/${id}`).then(data),
  listRuns: (studyId: string) => client.get<QualRun[]>(`${base}/studies/${studyId}/runs`).then(data),
  listSuggestions: (studyId: string, status?: string, transcriptId?: string) => client.get<QualSuggestion[]>(`${base}/studies/${studyId}/suggestions`, { params: { status, transcriptId } }).then(data),
  accept: (id: string) => client.post<QualDecision>(`${base}/suggestions/${id}/accept`).then(data),
  edit: (id: string, body: { codeName?: string; definition?: string; codeId?: string; start?: number; end?: number }) => client.post<QualDecision>(`${base}/suggestions/${id}/edit`, body).then(data),
  reject: (id: string) => client.post<QualDecision>(`${base}/suggestions/${id}/reject`).then(data),
}

/** The message to show for a failed call: the server's own wording when it sent one. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  const m = (e as { message?: unknown } | null)?.message
  return typeof m === 'string' && m.trim() && !/^Request failed with status code/.test(m) && !/^Network Error$/.test(m) ? m : fallback
}

export function errorCode(e: unknown): string | null {
  const c = (e as { code?: unknown } | null)?.code
  return typeof c === 'string' ? c : null
}
