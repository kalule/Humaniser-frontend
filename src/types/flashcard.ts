export type DeckStatus = 'processing' | 'ready' | 'error'
export type ItemType   = 'flashcard' | 'mcq' | 'scenario'

export interface ScenarioAnswer {
  summaryConclusion:       string
  criticalEvaluationSteps: string[]
  deepDiveExplanation:     string
}

export interface AssessmentItem {
  id:             string
  itemType:       ItemType
  prompt:         string
  correctAnswer:  string
  distractors:    string[] | null
  explanation:    string | null
  sortOrder:      number
  scenarioAnswer: ScenarioAnswer | null
}

export interface StudyDeck {
  id:            string
  title:         string
  status:        DeckStatus
  errorMessage:  string | null
  sourcePreview: string
  sourceName:    string | null
  itemCount:     number
  createdAt:     string
  items:         AssessmentItem[] | null
}

export interface GenerateRequest {
  title:      string
  text:       string
  itemTypes:  string[]
  sourceName?: string
}

export interface ExtractDocumentResult {
  text:      string
  filename:  string
  wordCount: number
}
