import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  DatasetSchema,
  AnalystMessage,
  WorkbenchMode,
  DataHealthReport,
  CleaningLogEntry,
  QualityState,
  PreparationBlueprint,
  AcademicLevel,
  AnalyticalMethod,
} from '../types/analyst'

type WizardStep = 'objectives' | 'variables' | 'blueprint' | null

interface AnalystStore {
  // Every dataset uploaded this session — the sidebar's source of truth.
  datasets:            DatasetSchema[]
  // Which uploaded datasets are checked "in" for the next query. selectedDatasetIds[0]
  // is the "primary" dataset — datasetId/schema below always mirror it, so every
  // single-dataset tool (profile/clean/wizard/outliers/methodology) keeps working
  // unchanged regardless of how many datasets are selected for the query itself.
  selectedDatasetIds:  string[]
  datasetId:     string | null
  schema:        DatasetSchema | null
  messages:      AnalystMessage[]
  isUploading:   boolean
  isQuerying:    boolean
  mode:          WorkbenchMode
  healthReport:  DataHealthReport | null
  isProfiling:   boolean
  profileError:  string | null
  // Confirmed cleaning steps applied to the working copy (the original upload is kept server-side).
  cleaningLog:   CleaningLogEntry[]
  // issue id -> user's explicit decision for high-severity issues (blocks the wizard's Continue until set)
  issueDecisions: Record<string, 'ignore'>
  // Issue the wizard wants the issue list to open and scroll to (set by "Review issues").
  focusIssueId: string | null
  // Variables the user picked for their analysis; used to tag issues as affecting it or not.
  analysisFocus: string[]
  // Research objective chosen in the wizard; the chat page uses it to order its suggestions.
  analysisObjective: AnalyticalMethod | null
  // A column name waiting to be inserted into the prompt box at the cursor (nonce makes repeats distinct).
  promptInsert: { text: string; nonce: number } | null
  isCleaning:    boolean
  isCleaned:     boolean
  isExporting:   boolean

  // The research project this analysis is for (research-platform W1.5). Chosen in the wizard or passed as ?projectId=;
  // the session is linked to it after its first completed step. Kept across sessions: it describes the student's work.
  projectId:    string | null
  setProjectId: (projectId: string | null) => void

  // Session state
  sessionId:    string | null
  academicLevel: AcademicLevel
  stepCount:    number

  // wizard
  wizardStep:            WizardStep
  blueprint:             PreparationBlueprint | null
  isGeneratingBlueprint: boolean

  addDataset:            (id: string, schema: DatasetSchema) => void
  toggleDatasetSelected: (id: string) => void
  setPrimaryDataset:     (id: string) => void
  removeDataset:         (id: string) => void
  addMessage:           (msg: AnalystMessage) => void
  updateMessage:         (id: string, patch: Partial<AnalystMessage>) => void
  setUploading:          (v: boolean) => void
  setQuerying:           (v: boolean) => void
  setMode:               (mode: WorkbenchMode) => void
  setHealthReport:       (report: DataHealthReport | null) => void
  setProfiling:          (v: boolean) => void
  setProfileError:       (msg: string | null) => void
  setAnalysisFocus:      (columns: string[]) => void
  setAnalysisObjective:  (objective: AnalyticalMethod | null) => void
  insertIntoPrompt:      (text: string) => void
  applyQualityState:     (state: QualityState) => void
  setIssueDecision:      (issueId: string, decision: 'ignore' | null) => void
  setFocusIssue:         (issueId: string | null) => void
  setCleaning:           (v: boolean) => void
  setExporting:          (v: boolean) => void
  applyCleanResult:      (schema: DatasetSchema) => void
  setWizardStep:         (step: WizardStep) => void
  setBlueprint:          (bp: PreparationBlueprint | null) => void
  setGeneratingBlueprint:(v: boolean) => void
  skipWizard:            () => void
  completeWizard:        (schema: DatasetSchema, primedMessage: string) => void
  reset:                 () => void

  // Session actions
  setAcademicLevel: (level: AcademicLevel) => void
  setSession:       (sessionId: string, stepCount: number) => void
  clearSession:     () => void
}

export const useAnalystStore = create<AnalystStore>((set) => ({
  datasets:     [],
  selectedDatasetIds: [],
  datasetId:    null,
  schema:       null,
  messages:     [],
  isUploading:  false,
  isQuerying:   false,
  mode:         'student',
  healthReport: null,
  isProfiling:  false,
  profileError: null,
  cleaningLog: [],
  issueDecisions: {},
  focusIssueId: null,
  analysisFocus: [],
  analysisObjective: null,
  promptInsert: null,
  isCleaning:   false,
  isCleaned:    false,
  isExporting:  false,

  projectId:    null,
  setProjectId: (projectId) => set({ projectId }),

  sessionId:    null,
  academicLevel: 'masters',
  stepCount:    0,

  wizardStep:            null,
  blueprint:             null,
  isGeneratingBlueprint: false,

  // A freshly-uploaded dataset becomes the sole selected + primary dataset — matches the
  // pre-multi-dataset single-upload UX with zero extra clicks. The user then multi-selects
  // in the sidebar if they want a joint query.
  addDataset: (datasetId, schema) =>
    set((s) => ({
      datasets: [...s.datasets.filter((d) => d.datasetId !== datasetId), schema],
      selectedDatasetIds: [datasetId],
      datasetId, schema, messages: [],
      healthReport: null, profileError: null, cleaningLog: [], issueDecisions: {}, isCleaned: false,
      wizardStep: 'objectives', blueprint: null, analysisObjective: null,
      sessionId: null, stepCount: 0,
    })),

  toggleDatasetSelected: (id) =>
    set((s) => {
      const isSelected = s.selectedDatasetIds.includes(id)
      // Never allow deselecting down to zero — a query always needs at least one dataset.
      if (isSelected && s.selectedDatasetIds.length === 1) return s

      const nextSelected = isSelected
        ? s.selectedDatasetIds.filter((d) => d !== id)
        : [...s.selectedDatasetIds, id]

      const primaryId = nextSelected[0]
      const primarySchema = s.datasets.find((d) => d.datasetId === primaryId) ?? null

      return {
        selectedDatasetIds: nextSelected,
        datasetId: primaryId ?? null,
        schema:    primarySchema,
      }
    }),

  setPrimaryDataset: (id) =>
    set((s) => {
      const schema = s.datasets.find((d) => d.datasetId === id)
      if (!schema) return s

      const nextSelected = s.selectedDatasetIds.includes(id)
        ? [id, ...s.selectedDatasetIds.filter((d) => d !== id)]
        : [id, ...s.selectedDatasetIds]

      return {
        selectedDatasetIds: nextSelected,
        datasetId: id,
        schema,
        // Stale for whichever dataset was previously primary — recomputed on demand.
        healthReport: null, profileError: null, cleaningLog: [], issueDecisions: {}, isCleaned: false,
        wizardStep: null, blueprint: null,
      }
    }),

  // Removes one dataset and keeps the chat/session. Removing the last one is a full
  // reset (callers confirm that separately). If the removed dataset was primary, the
  // next selected (or first remaining) one takes over and its per-dataset state is
  // cleared for re-fetch, exactly as setPrimaryDataset does.
  removeDataset: (id) =>
    set((s) => {
      if (!s.datasets.some((d) => d.datasetId === id)) return s
      const remaining = s.datasets.filter((d) => d.datasetId !== id)
      if (remaining.length === 0) {
        return {
          datasets: [], selectedDatasetIds: [],
          datasetId: null, schema: null, messages: [],
          healthReport: null, profileError: null, cleaningLog: [], issueDecisions: {}, isCleaned: false,
          wizardStep: null, blueprint: null, isGeneratingBlueprint: false,
          sessionId: null, stepCount: 0,
        }
      }

      const kept = s.selectedDatasetIds.filter((d) => d !== id)
      const nextSelected = kept.length > 0 ? kept : [remaining[0].datasetId]
      if (s.datasetId !== id) return { datasets: remaining, selectedDatasetIds: nextSelected }

      const primaryId = nextSelected[0]
      return {
        datasets: remaining,
        selectedDatasetIds: nextSelected,
        datasetId: primaryId,
        schema: remaining.find((d) => d.datasetId === primaryId) ?? null,
        healthReport: null, profileError: null, cleaningLog: [], issueDecisions: {}, isCleaned: false,
        wizardStep: null, blueprint: null,
      }
    }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  setUploading:    (isUploading) => set({ isUploading }),
  setQuerying:     (isQuerying)  => set({ isQuerying }),
  setMode:         (mode)        => set({ mode }),
  setHealthReport: (healthReport) => set({ healthReport, profileError: null, issueDecisions: {} }),
  setProfiling:    (isProfiling) => set({ isProfiling }),
  setProfileError: (profileError) => set({ profileError }),
  setAnalysisFocus: (analysisFocus) => set({ analysisFocus }),
  setAnalysisObjective: (analysisObjective) => set({ analysisObjective }),
  insertIntoPrompt: (text) => set((s) => ({ promptInsert: { text, nonce: (s.promptInsert?.nonce ?? 0) + 1 } })),
  // One atomic update after a check, a fix or an undo: schema, report and log always agree.
  applyQualityState: ({ schema, report, log }) =>
    set((s) => {
      const liveIds = new Set((report.issues ?? []).map((i) => i.id))
      const issueDecisions = Object.fromEntries(
        Object.entries(s.issueDecisions).filter(([id]) => liveIds.has(id)),
      ) as Record<string, 'ignore'>
      // The upload response carries the data dictionary; the quality endpoints do not.
      const merged = { ...schema, dataDictionary: schema.dataDictionary ?? s.schema?.dataDictionary }
      return {
        schema: merged, healthReport: report, cleaningLog: log, profileError: null,
        isCleaned: log.length > 0, issueDecisions,
        datasets: s.datasets.map((d) => (d.datasetId === s.datasetId ? merged : d)),
      }
    }),
  setIssueDecision: (issueId, decision) =>
    set((s) => {
      const next = { ...s.issueDecisions }
      if (decision) next[issueId] = decision; else delete next[issueId]
      return { issueDecisions: next }
    }),
  setFocusIssue:   (focusIssueId) => set({ focusIssueId }),
  setCleaning:     (isCleaning)  => set({ isCleaning }),
  setExporting:    (isExporting) => set({ isExporting }),

  applyCleanResult: (schema) =>
    set((s) => ({
      schema, isCleaned: true, healthReport: null, profileError: null, issueDecisions: {},
      datasets: s.datasets.map((d) => (d.datasetId === s.datasetId ? schema : d)),
    })),

  setWizardStep:          (wizardStep) => set({ wizardStep }),
  setBlueprint:           (blueprint)  => set({ blueprint }),
  setGeneratingBlueprint: (isGeneratingBlueprint) => set({ isGeneratingBlueprint }),
  skipWizard: () => set({ wizardStep: null, blueprint: null }),

  completeWizard: (schema, primedMessage) =>
    set((s) => ({
      schema,
      isCleaned:  true,
      wizardStep: null,
      blueprint:  null,
      datasets: s.datasets.map((d) => (d.datasetId === s.datasetId ? schema : d)),
      messages: [{
        id:        nanoid(),
        role:      'assistant',
        content:   primedMessage,
        status:    'complete',
        createdAt: new Date().toISOString(),
      }],
    })),

  reset: () => set({
    datasets: [], selectedDatasetIds: [],
    datasetId: null, schema: null, messages: [],
    healthReport: null, profileError: null, cleaningLog: [], issueDecisions: {}, isCleaned: false,
    wizardStep: null, blueprint: null, isGeneratingBlueprint: false,
    sessionId: null, stepCount: 0,
  }),

  // Session actions
  setAcademicLevel: (academicLevel) => set({ academicLevel }),

  setSession: (sessionId, stepCount) => set({ sessionId, stepCount }),

  clearSession: () => set({ sessionId: null, stepCount: 0 }),
}))
