export type ReviewType = 'Proposal' | 'Thesis' | 'Manuscript' | 'LiteratureReview'
export type ReviewSourceType = 'ResearchProject' | 'SystematicReview' | 'PastedText' | 'UploadedFile'
export type ReviewVerdict = 'Accept' | 'Revise' | 'Reject'
export type Severity = 'Critical' | 'Warning' | 'Info' | 'Positive'

export interface ReviewFinding {
  category:      string
  severity:      Severity
  text:          string
  suggestion:    string
  pageReference: string | null
}

export interface CategoryScore {
  category: string
  score:    number
}

// Index-aligned with DocumentReview.findings (findingFixEligibility[i] describes findings[i]) —
// see the backend's FindingFixEligibilityDto doc comment for why this isn't a field on
// ReviewFinding itself. sectionCode is non-null only when the backend's
// ReviewFindingSectionLocator found exactly one confident, actually-drafted section for this
// finding; that's the only case the "Fix this" button should render for.
export interface FindingFixEligibility {
  sectionCode: string | null
  resolved:    boolean
}

export interface DocumentReview {
  id:                     string
  reviewType:             ReviewType
  sourceType:             ReviewSourceType
  researchProjectId:      string | null
  systematicReviewId:     string | null
  documentTitle:          string
  highQuality:            boolean
  overviewNarrative:      string
  overallScore:           number
  verdict:                ReviewVerdict
  confidencePercent:      number
  categoryScores:         CategoryScore[]
  findings:               ReviewFinding[]
  standardsApplied:       string[]
  createdAt:              string
  findingFixEligibility:  FindingFixEligibility[]
}

export interface DocumentReviewSummary {
  id:            string
  reviewType:    ReviewType
  documentTitle: string
  overallScore:  number
  verdict:       ReviewVerdict
  createdAt:     string
}
