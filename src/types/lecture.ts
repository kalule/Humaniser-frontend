export interface SummarySection {
  topicHeading: string
  bulletPoints: string[]
}

export interface DefinitionItem {
  term: string
  definition: string
}

export interface ExamQuestion {
  question: string
  idealAnswer: string
}

export interface StudyGuide {
  cleanSummary: SummarySection[]
  keyDefinitions: DefinitionItem[]
  examQuestions: ExamQuestion[]
}

export interface LectureJob {
  id: string
  title: string
  fileName: string
  status: 'processing' | 'ready' | 'error'
  errorMessage?: string | null
  rawTranscript?: string | null
  studyGuide?: StudyGuide | null
  wordCount: number
  durationSeconds: number
  createdAt: string
}
