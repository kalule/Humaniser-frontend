import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { researchApi } from '../api/research'
import { STEPS } from '../data/proposalOutline'
import { countBodyWords } from '../lib/wordCount'
import type {
  AlignmentIssue,
  AlignmentValidationResult,
  CanonicalResearchPlan,
  ChecklistItem,
  DefencePreparation,
  EthicsChecklist,
  ProjectAnalysisPlan,
  ProjectHypothesis,
  ProjectSection,
  ProjectSectionVersion,
  ProposalThesisMappingResult,
  ResearchProject,
  ResearchState,
  DocumentMode,
  GeneratorMode,
  ResearchTopic,
  GeneratedTitle,
  GenerationStatus,
  SectionEvidenceCoverageAudit,
  SectionFixPreview,
  ThesisAuditResult,
  ThesisChapterPlan,
  UniversityTemplateSummary,
  UpdateHypothesisPayload,
  UploadExternalProposalResult,
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
  generateSection:     (projectId: string, code: string, targetWordCount?: number) => Promise<void>
  saveSection:         (projectId: string, code: string, content: string) => Promise<void>
  approveSection:      (projectId: string, code: string, acknowledgeConflicts?: boolean) => Promise<void>
  regenerateSection:   (projectId: string, code: string) => Promise<void>
  // "Apply fix" preview/confirm/discard — see api/research.ts. applySectionFix returns the
  // proposed content for the caller to hold locally (a diff modal) without mutating store state;
  // confirmSectionFix is what actually replaces the section, discardSectionFix just releases
  // the credit reservation the preview call made.
  applySectionFix:     (projectId: string, code: string, issues: AlignmentIssue[]) => Promise<SectionFixPreview>
  confirmSectionFix:   (projectId: string, code: string, proposedContent: string) => Promise<void>
  discardSectionFix:   (projectId: string) => Promise<void>
  validateAlignment:   (projectId: string) => Promise<AlignmentValidationResult>
  validateQuality:     (projectId: string) => Promise<AlignmentValidationResult>
  exportDocx:          (projectId: string, acknowledgeCitationIssues?: boolean) => Promise<void>
  patchSection:        (projectId: string, section: ProjectSection) => void

  // ── Ethics checklist cache — keyed by projectId, not persisted (see partialize below).
  // Explicit invalidation triggers only: see invalidateEthicsChecklistIfRelevant's own comment.
  ethicsChecklist:       Record<string, EthicsChecklist>
  loadEthicsChecklist:   (projectId: string) => Promise<void>
  setEthicsChecklist:    (projectId: string, checklist: EthicsChecklist) => void

  // ── Autonomous generation (AI Thesis) — server-driven, survives tab close ───
  generateAutonomous:  (projectId: string, targetWordCount: number, autoRepairValidation?: boolean) => Promise<GenerationStatus>
  getGenerationStatus: (projectId: string) => Promise<GenerationStatus>
  cancelGeneration:    (projectId: string) => Promise<GenerationStatus>

  // ── Sprint 3: Hypotheses & Analysis Plan ─────────────────────────────────
  hypotheses:             Record<string, ProjectHypothesis[]>
  analysisPlan:           Record<string, ProjectAnalysisPlan[]>
  isGeneratingHypotheses: boolean

  loadHypotheses:          (projectId: string) => Promise<void>
  generateHypotheses:      (projectId: string, force?: boolean) => Promise<void>
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

  // ── Thesis Studio: audit-gated transition to thesis ──────────────────────
  thesisAudit:          Record<string, ThesisAuditResult>
  isLoadingThesisAudit: boolean

  loadThesisAudit:           (projectId: string) => Promise<void>
  answerThesisAuditQuestion: (projectId: string, questionKey: string, answer: string) => Promise<void>
  uploadExternalProposal:    (file: File) => Promise<UploadExternalProposalResult>

  // ── Thesis Foundation (Phase 1) ──────────────────────────────────────────
  thesisChapterPlan:      Record<string, ThesisChapterPlan>
  canonicalResearchPlans: Record<string, CanonicalResearchPlan[]>
  universityTemplates:    UniversityTemplateSummary[]
  isLoadingChapterPlan:   boolean

  setResearchState:           (projectId: string, state: ResearchState) => Promise<void>
  loadThesisChapterPlan:      (projectId: string) => Promise<void>
  loadCanonicalResearchPlans: (projectId: string) => Promise<void>
  loadUniversityTemplates:    () => Promise<void>
  setUniversityTemplate:      (projectId: string, universityTemplateId: string | null) => Promise<void>

  // ── Thesis Foundation (Phase 2) ──────────────────────────────────────────
  sectionVersions:           Record<string, ProjectSectionVersion[]>       // keyed "projectId:code"
  isLoadingSectionVersions:  boolean
  contentMapping:            ProposalThesisMappingResult | null
  isLoadingContentMapping:   boolean
  evidenceCoverageAudit:     Record<string, SectionEvidenceCoverageAudit>  // keyed "projectId:code"

  loadSectionVersions:       (projectId: string, code: string) => Promise<void>
  restoreSectionVersion:     (projectId: string, code: string, versionNumber: number) => Promise<void>
  loadContentMappingPreview: (projectId: string) => Promise<void>
  applyContentMapping:       (projectId: string) => Promise<void>
  loadEvidenceCoverageAudit: (projectId: string, code: string) => Promise<void>
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

// Ethics checklist cache invalidation — explicit, named trigger list (Ethics section load
// delay fix, Fix 3). The Ethics checklist's classification staleness is a server-computed hash
// over exactly these 4 methodology section codes (EthicsComplianceService.ClassificationSectionCodes
// on the backend). A mutation to any of them can make an already-cached ethicsChecklist entry's
// isStale/document list wrong until refetched. Confirmed via full grep of researchStore.ts: every
// action that ever replaces a section's content/status is wired to this invalidation call —
// generateSection, saveSection, approveSection, regenerateSection, confirmSectionFix,
// restoreSectionVersion, patchSection, and generateHypothesisProse (the last two are generic/
// currently-4.4-only respectively, wired through anyway so a future change of what they touch
// can't silently reopen this gap). There is no separate "methodology type changed" or "ethics
// document uploaded" mutation in this store to also invalidate on (the latter doesn't exist as a
// feature — Ethics documents are only AI-drafted or status-updated, both handled directly by
// EthicsManager writing its own fresh response into the cache, not by this invalidation path).
const ETHICS_RELEVANT_SECTION_CODES = ['5.3', '5.4', '5.8', '5.11']

const invalidateEthicsChecklistIfRelevant = (
  ethicsChecklist: Record<string, EthicsChecklist>,
  projectId: string,
  code: string,
): Record<string, EthicsChecklist> => {
  if (!ETHICS_RELEVANT_SECTION_CODES.includes(code) || !(projectId in ethicsChecklist)) return ethicsChecklist
  const next = { ...ethicsChecklist }
  delete next[projectId]
  return next
}

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
      thesisAudit: {},
      isLoadingThesisAudit: false,
      thesisChapterPlan: {},
      canonicalResearchPlans: {},
      universityTemplates: [],
      isLoadingChapterPlan: false,
      sectionVersions: {},
      isLoadingSectionVersions: false,
      contentMapping: null,
      isLoadingContentMapping: false,
      evidenceCoverageAudit: {},
      ethicsChecklist: {},

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
          methodologyType:    project.methodologyType,
          methodologySubType: project.methodologySubType,
          notes:              project.notes,
          studyLocation:      project.studyLocation,
          studyPopulation:    project.studyPopulation,
          gatherMode:         project.gatherMode,
          selectedLibraryDocumentIds: project.selectedLibraryDocumentIds,
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
              ? { ...p, currentStep: step, progressPct: Math.round((step / (STEPS.length - 1)) * 100), updatedAt: now() }
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

      generateSection: async (projectId, code, targetWordCount) => {
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
          const updated = await researchApi.generateSection(projectId, code, targetWordCount)
          set(s => ({
            sections: updateSection(s.sections, projectId, updated),
            ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, updated.code),
          }))
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
        set(s => ({
          sections: updateSection(s.sections, projectId, updated),
          ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, updated.code),
        }))
      },

      approveSection: async (projectId, code, acknowledgeConflicts = false) => {
        const updated = await researchApi.approveSection(projectId, code, acknowledgeConflicts)
        set(s => ({
          sections: updateSection(s.sections, projectId, updated),
          ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, updated.code),
        }))
      },

      regenerateSection: async (projectId, code) => {
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
          const updated = await researchApi.regenerateSection(projectId, code)
          set(s => ({
            sections: updateSection(s.sections, projectId, updated),
            ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, updated.code),
          }))
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

      applySectionFix: async (projectId, code, issues) =>
        researchApi.applySectionFix(projectId, code, issues),

      confirmSectionFix: async (projectId, code, proposedContent) => {
        const updated = await researchApi.confirmSectionFix(projectId, code, proposedContent)
        set(s => ({
          sections: updateSection(s.sections, projectId, updated),
          ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, updated.code),
        }))
      },

      discardSectionFix: async (projectId) => {
        await researchApi.discardSectionFix(projectId)
      },

      validateAlignment: async (projectId) =>
        researchApi.validateAlignment(projectId),

      validateQuality: async (projectId) =>
        researchApi.validateQuality(projectId),

      exportDocx: async (projectId, acknowledgeCitationIssues = false) => {
        const blob = await researchApi.exportDocx(projectId, acknowledgeCitationIssues)
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `research-proposal-${new Date().toISOString().slice(0, 10)}.docx`
        a.click()
        URL.revokeObjectURL(url)
      },

      patchSection: (projectId, section) =>
        set(s => ({
          sections: updateSection(s.sections, projectId, section),
          ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, section.code),
        })),

      // ── Ethics checklist cache ──────────────────────────────────────────────
      // Unconditional fetch+store, same convention as loadSections above — the caller (EthicsManager)
      // decides whether to call this or read an already-cached entry; this action itself always
      // hits the API and overwrites the cache with the fresh result.
      loadEthicsChecklist: async (projectId) => {
        const checklist = await researchApi.getEthicsChecklist(projectId)
        set(s => ({ ethicsChecklist: { ...s.ethicsChecklist, [projectId]: checklist } }))
      },

      // Synchronous write-through for EthicsManager's own mutations (classify/confirm/draft/
      // status-update) — those calls already return the fresh server state directly, so this
      // just writes it into the shared cache instead of triggering a wasted extra refetch.
      setEthicsChecklist: (projectId, checklist) =>
        set(s => ({ ethicsChecklist: { ...s.ethicsChecklist, [projectId]: checklist } })),

      // ── Autonomous generation (Proposal Studio's "Autonomous Proposal") ──────
      // Thin pass-throughs — the polling loop and its status live in the calling
      // hook (useAutonomousProposalFlow), same convention as systematicReviewStore's
      // getFetchStatus.
      generateAutonomous:  (projectId, targetWordCount, autoRepairValidation) => researchApi.generateAutonomous(projectId, targetWordCount, autoRepairValidation),
      getGenerationStatus: (projectId) => researchApi.getGenerationStatus(projectId),
      cancelGeneration:    (projectId) => researchApi.cancelGeneration(projectId),

      updateSectionContent: (projectId, sectionCode, content) =>
        set(s => ({
          sections: {
            ...s.sections,
            [projectId]: (s.sections[projectId] ?? []).map(sec =>
              sec.code === sectionCode
                ? {
                    ...sec,
                    content,
                    wordCount: countBodyWords(content),
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

      generateHypotheses: async (projectId, force = false) => {
        set(() => ({ isGeneratingHypotheses: true }))
        try {
          const list = await researchApi.generateHypotheses(projectId, force)
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
        set(s => ({
          sections: updateSection(s.sections, projectId, section),
          ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, section.code),
        }))
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

      // ── Thesis Studio: audit-gated transition to thesis ────────────────────

      loadThesisAudit: async (projectId) => {
        set(() => ({ isLoadingThesisAudit: true }))
        try {
          const audit = await researchApi.getThesisAudit(projectId)
          set(s => ({ thesisAudit: { ...s.thesisAudit, [projectId]: audit } }))
        } finally {
          set(() => ({ isLoadingThesisAudit: false }))
        }
      },

      answerThesisAuditQuestion: async (projectId, questionKey, answer) => {
        const audit = await researchApi.answerThesisAuditQuestion(projectId, questionKey, answer)
        set(s => ({ thesisAudit: { ...s.thesisAudit, [projectId]: audit } }))
      },

      // ── Thesis Foundation (Phase 1) ─────────────────────────────────────────

      setResearchState: async (projectId, state) => {
        const updated = await researchApi.setResearchState(projectId, state)
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? updated : p) }))
      },

      loadThesisChapterPlan: async (projectId) => {
        set(() => ({ isLoadingChapterPlan: true }))
        try {
          const plan = await researchApi.getThesisChapterPlan(projectId)
          set(s => ({ thesisChapterPlan: { ...s.thesisChapterPlan, [projectId]: plan } }))
        } finally {
          set(() => ({ isLoadingChapterPlan: false }))
        }
      },

      loadCanonicalResearchPlans: async (projectId) => {
        const plans = await researchApi.getCanonicalResearchPlans(projectId)
        set(s => ({ canonicalResearchPlans: { ...s.canonicalResearchPlans, [projectId]: plans } }))
      },

      loadUniversityTemplates: async () => {
        const templates = await researchApi.listUniversityTemplates()
        set(() => ({ universityTemplates: templates }))
      },

      setUniversityTemplate: async (projectId, universityTemplateId) => {
        const updated = await researchApi.setUniversityTemplate(projectId, universityTemplateId)
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? updated : p) }))
      },

      // ── Thesis Foundation (Phase 2) ──────────────────────────────────────────

      loadSectionVersions: async (projectId, code) => {
        set(() => ({ isLoadingSectionVersions: true }))
        try {
          const versions = await researchApi.getSectionVersions(projectId, code)
          set(s => ({ sectionVersions: { ...s.sectionVersions, [`${projectId}:${code}`]: versions } }))
        } finally {
          set(() => ({ isLoadingSectionVersions: false }))
        }
      },

      restoreSectionVersion: async (projectId, code, versionNumber) => {
        const updated = await researchApi.restoreSectionVersion(projectId, code, versionNumber)
        set(s => ({
          sections: updateSection(s.sections, projectId, updated),
          ethicsChecklist: invalidateEthicsChecklistIfRelevant(s.ethicsChecklist, projectId, updated.code),
        }))
        // The restored content shifts version numbers — reload so the drawer reflects reality.
        const versions = await researchApi.getSectionVersions(projectId, code)
        set(s => ({ sectionVersions: { ...s.sectionVersions, [`${projectId}:${code}`]: versions } }))
      },

      loadContentMappingPreview: async (projectId) => {
        set(() => ({ isLoadingContentMapping: true }))
        try {
          const result = await researchApi.previewContentMapping(projectId)
          set(() => ({ contentMapping: result }))
        } finally {
          set(() => ({ isLoadingContentMapping: false }))
        }
      },

      applyContentMapping: async (projectId) => {
        set(() => ({ isLoadingContentMapping: true }))
        try {
          const result = await researchApi.applyContentMapping(projectId)
          set(() => ({ contentMapping: result }))
        } finally {
          set(() => ({ isLoadingContentMapping: false }))
        }
      },

      loadEvidenceCoverageAudit: async (projectId, code) => {
        const audit = await researchApi.getEvidenceCoverageAudit(projectId, code)
        set(s => ({ evidenceCoverageAudit: { ...s.evidenceCoverageAudit, [`${projectId}:${code}`]: audit } }))
      },

      uploadExternalProposal: async (file) => {
        const { jobId } = await researchApi.uploadExternalProposal(file)

        const POLL_INTERVAL_MS = 3_000
        const POLL_TIMEOUT_MS  = 600_000 // 10 min — above the backend's 480s Claude budget + margin
        const start = Date.now()

        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (Date.now() - start > POLL_TIMEOUT_MS) {
            throw new Error('Proposal processing timed out. Please try again.')
          }
          const job = await researchApi.pollProposalJob(jobId)
          if (job.status === 'complete' && job.result) {
            const { project } = job.result
            set(s => ({ projects: [project, ...s.projects] }))
            return job.result
          }
          if (job.status === 'error') {
            throw new Error(job.error ?? 'Could not process this document.')
          }
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
        }
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
