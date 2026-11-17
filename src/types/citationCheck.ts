// Mirrors HumaniseAI.Application.DTOs.CitationCheck. The server sends the verdict-like fields as plain strings, so the unions
// below are what the UI knows about today, not a promise: every lookup in lib/citationCheckView.ts falls back for a value it
// has not seen, so a verdict added on the server later degrades to a neutral label instead of breaking the page.

export type ClaimVerdict = 'Supported' | 'PartiallySupported' | 'NotSupported' | 'Contradicted' | 'CannotVerify'

export type FailureType =
  | 'None'
  | 'OutcomePredictorInversion'
  | 'DesignTypeMismatch'
  | 'HedgeInversion'
  | 'PopulationBleed'
  | 'CrossDomainBleed'

export type RunStatus = 'Queued' | 'Running' | 'Completed' | 'Failed'

/** Pending = not looked up yet; Locked = past the plan's limit; None = the citation has no reference entry to look up. */
export type ResolutionState = 'Verified' | 'MetadataMismatch' | 'NotFound' | 'Unchecked' | 'None' | 'Pending' | 'Locked'

export type CitationFlag =
  | 'OrphanCitation' | 'AmbiguousReference' | 'SourceNotFound' | 'MetadataMismatch' | 'NoReferenceList' | 'YearMismatch'
  // Why a citation could not be checked, when the cause was a lookup service, an unsearchable reference, or our own error.
  | 'LookupFailed' | 'ReferenceUnsearchable' | 'CheckFailed'

/** A warn-only note that the claim is worded more strongly than a single source usually supports. It never changes the verdict. */
export interface Overstatement {
  phrase: string
  suggestion: string
  /** 'Elevated' when the source could not be found or checked, so nothing stands behind the strong wording. */
  severity: string
  rulesVersion: string
}

export type EvidenceLevel = 'FullText' | 'AbstractOnly'

export interface MetadataDiff {
  field: string
  inDraft: string
  inRecord: string
}

export interface CitationVerdict {
  verdict: string
  failureType: string
  confidence: string
  evidenceLevel: string
  claimText: string
  /** Present only when the server verified it word for word against the source. */
  evidenceQuote: string | null
  evidenceChunkId: string | null
  reasoning: string
  suggestedRewrite: string | null
  quoteVerified: boolean
  note: string | null
}

export interface CitationCard {
  id: string
  ordinal: number
  markerText: string
  markerOffset: number
  markerLength: number
  locked: boolean
  resolutionState: string
  resolutionNote: string | null
  referenceEntry: string | null
  flags: string[]
  metadataDiffs: MetadataDiff[]
  /** Null while the citation is still being checked, and always null on a locked card. */
  verdict: CitationVerdict | null
  /** The one work this card is about, e.g. "Smith and Lee (2020)". A marker citing two works is two cards with the same marker text. */
  citedLabel?: string | null
  citedAuthors?: string | null
  citedYear?: string | null
  /** A link the server built from a validated DOI or work id; null when there is no resolved work. */
  sourceUrl?: string | null
  overstatement?: Overstatement | null
}

export interface CitationCheckSummary {
  total: number
  checked: number
  supported: number
  partiallySupported: number
  notSupported: number
  contradicted: number
  cannotVerify: number
  locked: number
  /** 0-100, or null when nothing could be judged. */
  integrityScore: number | null
  orphanCitations: number
  ambiguousCitations: number
  unusedReferences: number
  sourcesNotFound: number
  metadataMismatches: number
  yearMismatches?: number
  overstatedClaims?: number
}

/** The text the check was started from, as the server holds it. Card offsets index this exact string (line endings are LF). */
export interface CitationDraft {
  text: string
  sourceType: string
  charCount: number
  deleteAfter: string
}

/** What a check would involve, worked out before anything starts. */
export interface CitationCheckEstimate {
  citationCount: number
  wordCount: number
  referenceCount: number
  /** How many citations this plan will check; the rest are locked. */
  willCheck: number
  locked: number
  planLimit: number | null
  estimatedSeconds: number
  canStart: boolean
  reason: string | null
  warnings: string[]
}

export interface CitationCheckStarted {
  runId: string
  /** Non-blocking notes about how well an uploaded file was read (e.g. a PDF whose columns may be out of order). */
  warnings: string[]
}

export interface CitationCheckReport {
  runId: string
  status: string
  stage: string
  citationCount: number
  citationsDone: number
  limitReached: boolean
  /** How many citations this run may check; null means all. */
  fullCheckLimit: number | null
  error: string | null
  warnings: string[]
  unusedReferences: string[]
  summary: CitationCheckSummary
  cards: CitationCard[]
  createdAt: string
  deleteAfter: string
}
