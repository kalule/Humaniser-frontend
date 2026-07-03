import client from './client'
import type {
  AcademicLevel,
  AlignmentValidationResult,
  CitationStyle,
  DefencePreparation,
  DocumentMode,
  FetchedLiterature,
  GeneratedTitle,
  GeneratorMode,
  ProjectAnalysisPlan,
  ProjectHypothesis,
  ProjectSection,
  ResearchProject,
  ResearchTopic,
  UpdateHypothesisPayload,
} from '../types/research'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CreateProjectPayload {
  generatorMode: GeneratorMode
  documentMode:  DocumentMode
}

// Full-state sync — always send the entire project so null means "clear", not "skip".
export interface SyncProjectPayload {
  title:           string
  academicLevel:   AcademicLevel
  fieldInterest:   string
  selectedTopic:   ResearchTopic | null
  suggestedTopics: ResearchTopic[]
  generatedTitles: GeneratedTitle[]
  currentStep:     number
  sectionContent:  Record<string, string>
  documentMode:    DocumentMode
  citationStyle:   CitationStyle
  progressPct:     number
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const researchApi = {
  create: async (payload: CreateProjectPayload): Promise<ResearchProject> =>
    unwrap(await client.post<Wrap<ResearchProject>>('/api/v1/research/projects', payload)),

  list: async (): Promise<ResearchProject[]> =>
    unwrap(await client.get<Wrap<ResearchProject[]>>('/api/v1/research/projects')),

  get: async (id: string): Promise<ResearchProject> =>
    unwrap(await client.get<Wrap<ResearchProject>>(`/api/v1/research/projects/${id}`)),

  sync: async (id: string, payload: SyncProjectPayload): Promise<ResearchProject> =>
    unwrap(await client.patch<Wrap<ResearchProject>>(`/api/v1/research/projects/${id}`, payload)),

  generateTopics: async (
    projectId: string,
    fieldInterest: string,
    academicLevel: AcademicLevel,
  ): Promise<ResearchTopic[]> =>
    unwrap(await client.post<Wrap<ResearchTopic[]>>(
      `/api/v1/research/projects/${projectId}/generate-topics`,
      { fieldInterest, academicLevel },
    )),

  generateTitles: async (
    projectId: string,
    chosenTopic: string,
    academicLevel: AcademicLevel,
  ): Promise<GeneratedTitle[]> =>
    unwrap(await client.post<Wrap<GeneratedTitle[]>>(
      `/api/v1/research/projects/${projectId}/generate-titles`,
      { chosenTopic, academicLevel },
    )),

  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/research/projects/${id}`)
  },

  // ── Sprint 2: Chapter Writer ───────────────────────────────────────────────

  getSections: async (projectId: string): Promise<ProjectSection[]> =>
    unwrap(await client.get<Wrap<ProjectSection[]>>(
      `/api/v1/research/projects/${projectId}/sections`,
    )),

  initSections: async (projectId: string): Promise<ProjectSection[]> =>
    unwrap(await client.post<Wrap<ProjectSection[]>>(
      `/api/v1/research/projects/${projectId}/sections/init`,
    )),

  generateSection: async (projectId: string, code: string, prompt: string, targetWordCount?: number): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/generate`,
      { prompt },
      { params: { code, ...(targetWordCount ? { target_word_count: targetWordCount } : {}) }, timeout: 180_000 },
    )),

  saveSection: async (projectId: string, code: string, content: string): Promise<ProjectSection> =>
    unwrap(await client.patch<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections`,
      { content },
      { params: { code } },
    )),

  approveSection: async (projectId: string, code: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/approve`,
      null,
      { params: { code } },
    )),

  regenerateSection: async (projectId: string, code: string, prompt: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/regenerate`,
      { prompt },
      { params: { code }, timeout: 180_000 },
    )),

  validateAlignment: async (projectId: string): Promise<AlignmentValidationResult> =>
    unwrap(await client.get<Wrap<AlignmentValidationResult>>(
      `/api/v1/research/projects/${projectId}/validate-alignment`,
    )),

  compileBibliography: async (projectId: string): Promise<string> => {
    const res = unwrap(await client.post<Wrap<{ bibliography: string }>>(
      `/api/v1/research/projects/${projectId}/compile-bibliography`,
      null,
      { timeout: 180_000 },
    ))
    return res.bibliography
  },

  exportDocx: async (projectId: string): Promise<Blob> => {
    const res = await client.get<Blob>(
      `/api/v1/research/projects/${projectId}/export-docx`,
      { responseType: 'blob' },
    )
    return res.data
  },

  getLiterature: async (projectId: string): Promise<FetchedLiterature[]> =>
    unwrap(await client.get<Wrap<FetchedLiterature[]>>(
      `/api/v1/research/projects/${projectId}/literature`,
    )),

  // ── Sprint 3: Hypotheses & Analysis Plan ──────────────────────────────────

  getHypotheses: async (projectId: string): Promise<ProjectHypothesis[]> =>
    unwrap(await client.get<Wrap<ProjectHypothesis[]>>(
      `/api/v1/research/projects/${projectId}/hypotheses`,
    )),

  generateHypotheses: async (projectId: string): Promise<ProjectHypothesis[]> =>
    unwrap(await client.post<Wrap<ProjectHypothesis[]>>(
      `/api/v1/research/projects/${projectId}/hypotheses/generate`,
    )),

  updateHypothesis: async (hypothesisId: string, payload: UpdateHypothesisPayload): Promise<ProjectHypothesis> =>
    unwrap(await client.patch<Wrap<ProjectHypothesis>>(
      `/api/v1/research/hypotheses/${hypothesisId}`,
      payload,
    )),

  generateHypothesisProse: async (projectId: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/generate-hypothesis-prose`,
    )),

  getAnalysisPlan: async (projectId: string): Promise<ProjectAnalysisPlan[]> =>
    unwrap(await client.get<Wrap<ProjectAnalysisPlan[]>>(
      `/api/v1/research/projects/${projectId}/analysis-plan`,
    )),

  validateChapter4: async (projectId: string): Promise<AlignmentValidationResult> =>
    unwrap(await client.get<Wrap<AlignmentValidationResult>>(
      `/api/v1/research/projects/${projectId}/validate-chapter4`,
    )),

  // ── Wizard content generation ─────────────────────────────────────────────

  generateWizardContent: async (projectId: string, stepId: string): Promise<string> => {
    const res = unwrap(await client.post<Wrap<{ content: string }>>(
      `/api/v1/research/projects/${projectId}/generate-wizard-content`,
      null,
      { params: { stepId } },
    ))
    return res.content
  },

  // ── Sprint 5: Thesis chapters, defence preparation, full export ────────────

  transitionToThesis: async (projectId: string): Promise<ResearchProject> =>
    unwrap(await client.post<Wrap<ResearchProject>>(
      `/api/v1/research/projects/${projectId}/transition-to-thesis`,
    )),

  linkSession: async (projectId: string, sessionId: string): Promise<ResearchProject> =>
    unwrap(await client.post<Wrap<ResearchProject>>(
      `/api/v1/research/projects/${projectId}/link-session`,
      { sessionId },
    )),

  generateDefence: async (projectId: string): Promise<DefencePreparation> =>
    unwrap(await client.post<Wrap<DefencePreparation>>(
      `/api/v1/research/projects/${projectId}/generate-defence`,
    )),

  getDefence: async (projectId: string): Promise<DefencePreparation | null> => {
    try {
      return unwrap(await client.get<Wrap<DefencePreparation>>(
        `/api/v1/research/projects/${projectId}/defence`,
      ))
    } catch {
      return null
    }
  },

  exportThesisDocx: async (projectId: string): Promise<Blob> => {
    const res = await client.get<Blob>(
      `/api/v1/research/projects/${projectId}/export-thesis-docx`,
      { responseType: 'blob' },
    )
    return res.data
  },
}
