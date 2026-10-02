export type CitationFindingSeverity = 'Critical' | 'Warning' | 'Info' | 'RequiresVerification'

export interface CitationFinding {
  citation: string
  claimSupported: string
  issue: string
  severity: CitationFindingSeverity
  recommendedAction: string
}

export interface CitationAuditResponse {
  findings: CitationFinding[]
  citationCount: number
  createdAt: string
}
