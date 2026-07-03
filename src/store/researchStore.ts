import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { researchApi } from '../api/research'
import type {
  AlignmentValidationResult,
  ChecklistItem,
  DefencePreparation,
  ProjectAnalysisPlan,
  ProjectHypothesis,
  ProjectSection,
  ResearchProject,
  DocumentMode,
  GeneratorMode,
  ResearchTopic,
  GeneratedTitle,
  UpdateHypothesisPayload,
} from '../types/research'

interface ResearchStore {
  projects: ResearchProject[]

  // ── API-backed operations ──────────────────────────────────────────────────
  createProject: (opts: { generatorMode: GeneratorMode; documentMode: DocumentMode; title?: string }) => Promise<ResearchProject>
  loadProjects:  () => Promise<void>
  loadProject:   (id: string) => Promise<void>
  syncProject:   (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // ── Synchronous local mutations (instant, no API call) ────────────────────
  updateProject:      (id: string, patch: Partial<ResearchProject>) => void
  setStep:            (id: string, step: number) => void
  setContent:         (id: string, stepId: string, content: string) => void
  setTopics:          (id: string, topics: ResearchTopic[]) => void
  selectTopic:        (id: string, topic: ResearchTopic | null) => void
  setGeneratedTitles: (id: string, titles: GeneratedTitle[]) => void

  // ── Sprint 2: Chapter Writer ──────────────────────────────────────────────
  // sections keyed by projectId — not persisted, re-fetched on mount
  sections: Record<string, ProjectSection[]>

  loadSections:        (projectId: string) => Promise<void>
  initSections:        (projectId: string) => Promise<void>
  generateSection:     (projectId: string, code: string, prompt: string, targetWordCount?: number) => Promise<void>
  saveSection:         (projectId: string, code: string, content: string) => Promise<void>
  approveSection:      (projectId: string, code: string) => Promise<void>
  regenerateSection:   (projectId: string, code: string, prompt: string) => Promise<void>
  validateAlignment:   (projectId: string) => Promise<AlignmentValidationResult>
  exportDocx:          (projectId: string) => Promise<void>
  patchSection:        (projectId: string, section: ProjectSection) => void

  // ── Sprint 3: Hypotheses & Analysis Plan ─────────────────────────────────
  hypotheses:             Record<string, ProjectHypothesis[]>
  analysisPlan:           Record<string, ProjectAnalysisPlan[]>
  isGeneratingHypotheses: boolean

  loadHypotheses:          (projectId: string) => Promise<void>
  generateHypotheses:      (projectId: string) => Promise<void>
  updateHypothesis:        (projectId: string, hypothesisId: string, payload: UpdateHypothesisPayload) => Promise<void>
  generateHypothesisProse: (projectId: string) => Promise<void>
  loadAnalysisPlan:        (projectId: string) => Promise<void>
  validateChapter4:        (projectId: string) => Promise<AlignmentValidationResult>

  // ── Local section content update (instant, no API call) ─────────────────
  updateSectionContent: (projectId: string, sectionCode: string, content: string) => void

  // ── Sprint 5: Thesis chapters, defence preparation ────────────────────────
  defence:              Record<string, DefencePreparation>
  isTransitioning:      boolean
  isGeneratingDefence:  boolean

  transitionToThesis:   (projectId: string) => Promise<void>
  linkSession:          (projectId: string, sessionId: string) => Promise<void>
  loadDefence:          (projectId: string) => Promise<void>
  generateDefence:      (projectId: string) => Promise<void>
  toggleChecklistItem:  (projectId: string, index: number) => void
  exportThesisDocx:     (projectId: string) => Promise<void>
}

// Wraps localStorage so a quota failure (e.g. many long-running projects) logs
// a warning instead of throwing — persistence is best-effort, in-memory state
// must never crash because the browser storage write failed.
const safeLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (err) {
      console.warn(`[researchStore] Failed to persist "${name}" (storage quota exceeded?) — continuing without persisting this change.`, err)
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
}

const now = () => new Date().toISOString()

const updateSection = (
  sections: Record<string, ProjectSection[]>,
  projectId: string,
  updated: ProjectSection,
): Record<string, ProjectSection[]> => ({
  ...sections,
  [projectId]: (sections[projectId] ?? []).map(s =>
    s.code === updated.code ? updated : s,
  ),
})

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      projects: [],
      sections: {},
      hypotheses: {},
      analysisPlan: {},
      isGeneratingHypotheses: false,
      defence: {},
      isTransitioning: false,
      isGeneratingDefence: false,

      // ── createProject ───────────────────────────────────────────────────────
      createProject: async ({ generatorMode, documentMode, title }) => {
        const project = await researchApi.create({ generatorMode, documentMode })
        const record  = title ? { ...project, title } : project
        set(s => ({ projects: [record, ...s.projects] }))
        return record
      },

      // ── loadProjects ────────────────────────────────────────────────────────
      // Refreshes the full project index from the API — the source of truth for
      // the dashboard list, since localStorage no longer persists enough to be
      // trustworthy on its own (and won't survive clearing storage or switching
      // devices).
      loadProjects: async () => {
        const list = await researchApi.list()
        set({ projects: list })
      },

      // ── loadProject ─────────────────────────────────────────────────────────
      loadProject: async (id) => {
        const project = await researchApi.get(id)
        set(s => ({
          projects: s.projects.some(p => p.id === id)
            ? s.projects.map(p => {
                if (p.id !== id) return p
                // Preserve a locally-set title if the API still has no meaningful one
                const apiHasTitle = project.title && project.title !== 'Untitled Research Project'
                return { ...project, title: apiHasTitle ? project.title : (p.title || project.title) }
              })
            : [project, ...s.projects],
        }))
      },

      // ── syncProject ─────────────────────────────────────────────────────────
      syncProject: async (id) => {
        const project = get().projects.find(p => p.id === id)
        if (!project) return
        const updated = await researchApi.sync(id, {
          title:           project.title,
          academicLevel:   project.academicLevel,
          fieldInterest:   project.fieldInterest,
          selectedTopic:   project.selectedTopic,
          suggestedTopics: project.suggestedTopics,
          generatedTitles: project.generatedTitles ?? [],
          currentStep:     project.currentStep,
          sectionContent:  project.sectionContent,
          documentMode:    project.documentMode,
          citationStyle:   project.citationStyle,
          progressPct:     project.progressPct,
        })
        set(s => ({ projects: s.projects.map(p => (p.id === id ? updated : p)) }))
      },

      // ── deleteProject ────────────────────────────────────────────────────────
      deleteProject: async (id) => {
        await researchApi.delete(id)
        set(s => ({ projects: s.projects.filter(p => p.id !== id) }))
      },

      // ── updateProject (local only) ───────────────────────────────────────────
      updateProject: (id, patch) =>
        set(s => ({
          projects: s.projects.map(p =>
            p.id === id ? { ...p, ...patch, updatedAt: now() } : p,
          ),
        })),

      // ── setStep ──────────────────────────────────────────────────────────────
      setStep: (id, step) =>
        set(s => ({
          projects: s.projects.map(p =>
            p.id === id
              ? { ...p, currentStep: step, progressPct: Math.round((step / 29) * 100), updatedAt: now() }
              : p,
          ),
        })),

      // ── setContent ───────────────────────────────────────────────────────────
      setContent: (id, stepId, content) =>
        set(s => ({
          projects: s.projects.map(p =>
            p.id === id
              ? { ...p, sectionContent: { ...p.sectionContent, [stepId]: content }, updatedAt: now() }
              : p,
          ),
        })),

      // ── setTopics ────────────────────────────────────────────────────────────
      setTopics: (id, topics) =>
        set(s => ({
          projects: s.projects.map(p =>
            p.id === id ? { ...p, suggestedTopics: topics, updatedAt: now() } : p,
          ),
        })),

      // ── selectTopic ──────────────────────────────────────────────────────────
      selectTopic: (id, topic) =>
        set(s => ({
          projects: s.projects.map(p =>
            p.id === id
              ? {
                  ...p,
                  selectedTopic: topic,
                  // When clearing a topic, also wipe generated titles so step 1 re-generates
                  generatedTitles: topic === null ? [] : p.generatedTitles,
                  title: topic ? topic.title : 'Untitled Research Project',
                  updatedAt: now(),
                }
              : p,
          ),
        })),

      // ── setGeneratedTitles ───────────────────────────────────────────────────
      setGeneratedTitles: (id, titles) =>
        set(s => ({
          projects: s.projects.map(p =>
            p.id === id ? { ...p, generatedTitles: titles, updatedAt: now() } : p,
          ),
        })),

      // ── Sprint 2: Chapter Writer ──────────────────────────────────────────

      loadSections: async (projectId) => {
        const list = await researchApi.getSections(projectId)
        set(s => ({ sections: { ...s.sections, [projectId]: list } }))
      },

      initSections: async (projectId) => {
        const list = await researchApi.initSections(projectId)
        set(s => ({ sections: { ...s.sections, [projectId]: list } }))
      },

      generateSection: async (projectId, code, prompt, targetWordCount) => {
        // Capture the pre-generation status so we can revert on failure
        const prevStatus = (get().sections[projectId] ?? [])
          .find(s => s.code === code)?.status ?? 'NotStarted'

        set(s => ({
          sections: {
            ...s.sections,
            [projectId]: (s.sections[projectId] ?? []).map(sec =>
              sec.code === code ? { ...sec, status: 'Generating' as const } : sec,
            ),
          },
        }))
        try {
          const updated = await researchApi.generateSection(projectId, code, prompt, targetWordCount)
          set(s => ({ sections: updateSection(s.sections, projectId, updated) }))
        } catch (err) {
          // Revert status so the user sees the Generate button again and can retry
          set(s => ({
            sections: {
              ...s.sections,
              [projectId]: (s.sections[projectId] ?? []).map(sec =>
                sec.code === code ? { ...sec, status: prevStatus as typeof sec.status } : sec,
              ),
            },
          }))
          throw err
        }
      },

      saveSection: async (projectId, code, content) => {
        const updated = await researchApi.saveSection(projectId, code, content)
        set(s => ({ sections: updateSection(s.sections, projectId, updated) }))
      },

      approveSection: async (projectId, code) => {
        const updated = await researchApi.approveSection(projectId, code)
        set(s => ({ sections: updateSection(s.sections, projectId, updated) }))
      },

      regenerateSection: async (projectId, code, prompt) => {
        const prevStatus = (get().sections[projectId] ?? [])
          .find(s => s.code === code)?.status ?? 'Draft'

        set(s => ({
          sections: {
            ...s.sections,
            [projectId]: (s.sections[projectId] ?? []).map(sec =>
              sec.code === code ? { ...sec, status: 'Generating' as const } : sec,
            ),
          },
        }))
        try {
          const updated = await researchApi.regenerateSection(projectId, code, prompt)
          set(s => ({ sections: updateSection(s.sections, projectId, updated) }))
        } catch (err) {
          set(s => ({
            sections: {
              ...s.sections,
              [projectId]: (s.sections[projectId] ?? []).map(sec =>
                sec.code === code ? { ...sec, status: prevStatus as typeof sec.status } : sec,
              ),
            },
          }))
          throw err
        }
      },

      validateAlignment: async (projectId) =>
        researchApi.validateAlignment(projectId),

      exportDocx: async (projectId) => {
        const blob = await researchApi.exportDocx(projectId)
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `research-proposal-${new Date().toISOString().slice(0, 10)}.docx`
        a.click()
        URL.revokeObjectURL(url)
      },

      patchSection: (projectId, section) =>
        set(s => ({ sections: updateSection(s.sections, projectId, section) })),

      updateSectionContent: (projectId, sectionCode, content) =>
        set(s => ({
          sections: {
            ...s.sections,
            [projectId]: (s.sections[projectId] ?? []).map(sec =>
              sec.code === sectionCode
                ? {
                    ...sec,
                    content,
                    wordCount: content.trim().split(/\s+/).filter(Boolean).length,
                    status: (sec.status === 'Draft' || sec.status === 'NotStarted')
                      ? 'Edited' as const
                      : sec.status,
                  }
                : sec,
            ),
          },
        })),

      // ── Sprint 3: Hypotheses & Analysis Plan ───────────────────────────────

      loadHypotheses: async (projectId) => {
        const list = await researchApi.getHypotheses(projectId)
        set(s => ({ hypotheses: { ...s.hypotheses, [projectId]: list } }))
      },

      generateHypotheses: async (projectId) => {
        set(() => ({ isGeneratingHypotheses: true }))
        try {
          const list = await researchApi.generateHypotheses(projectId)
          set(s => ({ hypotheses: { ...s.hypotheses, [projectId]: list } }))
        } finally {
          set(() => ({ isGeneratingHypotheses: false }))
        }
      },

      updateHypothesis: async (projectId, hypothesisId, payload) => {
        const updated = await researchApi.updateHypothesis(hypothesisId, payload)
        set(s => ({
          hypotheses: {
            ...s.hypotheses,
            [projectId]: (s.hypotheses[projectId] ?? []).map(h =>
              h.id === hypothesisId ? updated : h,
            ),
          },
        }))
      },

      generateHypothesisProse: async (projectId) => {
        set(s => ({
          sections: {
            ...s.sections,
            [projectId]: (s.sections[projectId] ?? []).map(sec =>
              sec.code === '4.4' ? { ...sec, status: 'Generating' as const } : sec,
            ),
          },
        }))
        const section = await researchApi.generateHypothesisProse(projectId)
        set(s => ({ sections: updateSection(s.sections, projectId, section) }))
      },

      loadAnalysisPlan: async (projectId) => {
        const plan = await researchApi.getAnalysisPlan(projectId)
        set(s => ({ analysisPlan: { ...s.analysisPlan, [projectId]: plan } }))
      },

      validateChapter4: async (projectId) =>
        researchApi.validateChapter4(projectId),

      // ── Sprint 5: Thesis chapters, defence preparation ─────────────────────

      transitionToThesis: async (projectId) => {
        set(() => ({ isTransitioning: true }))
        try {
          const updated = await researchApi.transitionToThesis(projectId)
          set(s => ({ projects: s.projects.map(p => p.id === projectId ? updated : p) }))
        } finally {
          set(() => ({ isTransitioning: false }))
        }
      },

      linkSession: async (projectId, sessionId) => {
        await researchApi.linkSession(projectId, sessionId)
      },

      loadDefence: async (projectId) => {
        const defence = await researchApi.getDefence(projectId)
        if (defence)
          set(s => ({ defence: { ...s.defence, [projectId]: defence } }))
      },

      generateDefence: async (projectId) => {
        set(() => ({ isGeneratingDefence: true }))
        try {
          const defence = await researchApi.generateDefence(projectId)
          set(s => ({ defence: { ...s.defence, [projectId]: defence } }))
        } finally {
          set(() => ({ isGeneratingDefence: false }))
        }
      },

      toggleChecklistItem: (projectId, index) =>
        set(s => {
          const existing = s.defence[projectId]
          if (!existing) return {}
          const checklist = existing.checklist.map((item: ChecklistItem, i: number) =>
            i === index ? { ...item, checked: !item.checked } : item,
          )
          return { defence: { ...s.defence, [projectId]: { ...existing, checklist } } }
        }),

      exportThesisDocx: async (projectId) => {
        const blob = await researchApi.exportThesisDocx(projectId)
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `thesis-${new Date().toISOString().slice(0, 10)}.docx`
        a.click()
        URL.revokeObjectURL(url)
      },
    }),
    {
      name: 'humanise-research',
      storage: createJSONStorage(() => safeLocalStorage),
      // Only persist the lightweight project index (used for the dashboard list
      // and to avoid a flash before loadProject() resolves). `sections`,
      // `hypotheses`, `analysisPlan`, and `defence` hold full generated prose
      // (thesis chapters, defence prep, etc.) keyed by every projectId ever
      // created — persisting them grows unbounded and blows the localStorage
      // quota. They're always re-fetched from the API on mount, so dropping
      // them from storage is safe.
      partialize: (state) => ({ projects: state.projects }),
    },
  ),
)
