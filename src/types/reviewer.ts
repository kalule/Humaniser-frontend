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

export interface DocumentReview {
  id:                  string
  reviewType:          ReviewType
  sourceType:          ReviewSourceType
  researchProjectId:   string | null
  systematicReviewId:  string | null
  documentTitle:       string
  highQuality:         boolean
  overviewNarrative:   string
  overallScore:        number
  verdict:             ReviewVerdict
  confidencePercent:   number
  categoryScores:      CategoryScore[]
  findings:            ReviewFinding[]
  standardsApplied:    string[]
  createdAt:           string
}

export interface DocumentReviewSummary {
  id:            string
  reviewType:    ReviewType
  documentTitle: string
  overallScore:  number
  verdict:       ReviewVerdict
  createdAt:     string
}
