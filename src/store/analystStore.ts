import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  DatasetSchema,
  AnalystMessage,
  WorkbenchMode,
  DataHealthReport,
  PreparationBlueprint,
  AcademicLevel,
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
  isCleaning:    boolean
  isCleaned:     boolean
  isExporting:   boolean

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
  addMessage:            (msg: AnalystMessage) => void
  updateMessage:         (id: string, patch: Partial<AnalystMessage>) => void
  setUploading:          (v: boolean) => void
  setQuerying:           (v: boolean) => void
  setMode:               (mode: WorkbenchMode) => void
  setHealthReport:       (report: DataHealthReport | null) => void
  setProfiling:          (v: boolean) => void
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
  isCleaning:   false,
  isCleaned:    false,
  isExporting:  false,

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
      healthReport: null, isCleaned: false,
      wizardStep: 'objectives', blueprint: null,
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
        healthReport: null, isCleaned: false,
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
  setHealthReport: (healthReport) => set({ healthReport }),
  setProfiling:    (isProfiling) => set({ isProfiling }),
  setCleaning:     (isCleaning)  => set({ isCleaning }),
  setExporting:    (isExporting) => set({ isExporting }),

  applyCleanResult: (schema) =>
    set((s) => ({
      schema, isCleaned: true, healthReport: null,
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
    healthReport: null, isCleaned: false,
    wizardStep: null, blueprint: null, isGeneratingBlueprint: false,
    sessionId: null, stepCount: 0,
  }),

  // Session actions
  setAcademicLevel: (academicLevel) => set({ academicLevel }),

  setSession: (sessionId, stepCount) => set({ sessionId, stepCount }),

  clearSession: () => set({ sessionId: null, stepCount: 0 }),
}))
