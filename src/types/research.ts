export type AcademicLevel  = 'UNDERGRADUATE' | 'MASTERS' | 'PHD'
export type CitationStyle  = 'apa7' | 'harvard' | 'mla' | 'ieee'
export type DocumentMode   = 'PROPOSAL' | 'DISSERTATION'
export type GeneratorMode  = 'GENERATOR' | 'AGENT'

export interface ResearchTopic {
  id:          string
  title:       string
  description: string
  tags:        string[]
  gapSummary:  string
}

export interface GeneratedTitle {
  id:          string  // r1 | r2 | r3
  titleText:   string
  methodology: string  // Qualitative Study | Cross-Sectional Survey | Mixed-Methods Investigation
}

export interface ResearchProject {
  id:              string
  title:           string
  academicLevel:   AcademicLevel
  fieldInterest:   string
  selectedTopic:   ResearchTopic | null
  suggestedTopics: ResearchTopic[]
  generatedTitles: GeneratedTitle[]
  currentStep:     number       // index into STEPS array
  sectionContent:  Record<string, string>  // stepId → content
  documentMode:    DocumentMode
  generatorMode:   GeneratorMode
  citationStyle:   CitationStyle
  progressPct:     number
  createdAt:       string
  updatedAt:       string
  documentType?:   string   // Sprint 5: Proposal | Thesis | Dissertation
}

// ── Sprint 2: Chapter Writer ──────────────────────────────────────────────────

export type SectionStatus = 'NotStarted' | 'Generating' | 'Draft' | 'Edited' | 'Approved'

export interface ProjectSection {
  code:         string        // "1.0", "2.0", etc.
  title:        string
  order:        number
  content:      string
  status:       SectionStatus
  wordCount:    number
  generatedAt:  string | null
  lastEditedAt: string | null
}

export interface AlignmentIssue {
  sectionCode: string
  issue:       string
  suggestion:  string
}

export interface AlignmentValidationResult {
  isValid:             boolean
  message:             string
  issues:              AlignmentIssue[]
  traceabilityMatrix?: TraceabilityEntry[]
}

// ── Sprint 3: Hypotheses & Analysis Plan ─────────────────────────────────────

export type HypothesisOutcome = 'Pending' | 'Supported' | 'Refuted' | 'Inconclusive'

export interface ProjectHypothesis {
  id:                    string
  number:                number
  nullHypothesis:        string
  alternativeHypothesis: string
  dependentVariable:     string
  independentVariable:   string
  plannedStatisticalTest: string
  significanceLevel:     string
  outcome:               HypothesisOutcome
  linkedRqNumber:        number | null
  linkedObjectiveNumber: number | null
  outcomeStatistic?:     string | null   // Sprint 5: e.g. "t(198) = 3.42, p = 0.001"
  outcomeNarrative?:     string | null   // Sprint 5: plain-language result summary
}

export interface ProjectAnalysisPlan {
  id:                   string
  displayOrder:         number
  objectiveText:        string
  descriptiveApproach:  string
  inferentialTest:      string
  variablesInvolved:    string
  softwarePackage:      string
  prebuiltAnalystQuery: string
  sentToAnalyst:        boolean
}

export interface TraceabilityEntry {
  rqNumber:         number
  objectiveNumber:  number
  hypothesisNumber: number | null
  isAligned:        boolean
  issue:            string | null
}

export interface UpdateHypothesisPayload {
  nullHypothesis?:        string
  alternativeHypothesis?: string
  dependentVariable?:     string
  independentVariable?:   string
  plannedStatisticalTest?: string
  significanceLevel?:     string
  linkedRqNumber?:        number
  linkedObjectiveNumber?: number
  outcomeStatistic?:      string   // Sprint 5
  outcomeNarrative?:      string   // Sprint 5
  outcome?:               string   // Sprint 5: "Supported" | "Refuted" | "Inconclusive"
}

// ── Literature ────────────────────────────────────────────────────────────────

export interface FetchedLiterature {
  title:             string
  authors:           string
  year:              number
  doi?:              string
  abstract?:         string
  url?:              string
  harvardCitation:   string
  apaCitation:       string
  source:            string
  includedByStudent: boolean
}

// ── Sprint 5: Thesis chapters, defence preparation ────────────────────────────

export interface ExaminerQuestion {
  category:          string   // Methodology | Results | Discussion | Literature | Theory | General
  difficulty:        'basic' | 'moderate' | 'challenging'
  question:          string
  whyAsked:          string
  suggestedResponse: string
}

export interface ChecklistItem {
  category: string   // Preparation | Knowledge | Logistics | Documents
  item:     string
  detail:   string
  checked?: boolean
}

export interface DefencePreparation {
  projectId:            string
  examinerQuestions:    ExaminerQuestion[]
  vivaOpeningStatement: string
  checklist:            ChecklistItem[]
  generatedAt:          string
}
