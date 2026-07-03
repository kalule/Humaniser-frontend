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

  setDataset:            (id: string, schema: DatasetSchema) => void
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

  setDataset: (datasetId, schema) =>
    set({
      datasetId, schema, messages: [],
      healthReport: null, isCleaned: false,
      wizardStep: 'objectives', blueprint: null,
      sessionId: null, stepCount: 0,
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
    set({ schema, isCleaned: true, healthReport: null }),

  setWizardStep:          (wizardStep) => set({ wizardStep }),
  setBlueprint:           (blueprint)  => set({ blueprint }),
  setGeneratingBlueprint: (isGeneratingBlueprint) => set({ isGeneratingBlueprint }),
  skipWizard: () => set({ wizardStep: null, blueprint: null }),

  completeWizard: (schema, primedMessage) =>
    set({
      schema,
      isCleaned:  true,
      wizardStep: null,
      blueprint:  null,
      messages: [{
        id:        nanoid(),
        role:      'assistant',
        content:   primedMessage,
        status:    'complete',
        createdAt: new Date().toISOString(),
      }],
    }),

  reset: () => set({
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
