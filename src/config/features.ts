import { useAuthStore } from '../store/authStore'

// Launch-visibility flag. Tools not in LAUNCH_TOOLS are hidden from every nav and their routes show a
// "Coming soon" page (see ToolGate). Admins and VITE_ENABLE_ALL_TOOLS=true bypass it, so development
// and internal testing are unaffected. To enable a tool at launch, add its id here — nothing else.

export type ToolId =
  | 'documents' | 'editor' | 'humanise' | 'ai-content-check' | 'paraphraser' | 'grammar' | 'summariser'
  | 'verify-citations' | 'similarity-check' | 'reviewer' | 'citation-generator'
  | 'proposal-studio' | 'thesis-studio' | 'systematic-review' | 'research-agent'
  | 'literature-search' | 'saved-sources' | 'deep-research' | 'document-chat' | 'lecture-notes' | 'flashcards'
  | 'data-analyst' | 'study-design' | 'feedback-tracker' | 'literature-matrix' | 'qualitative-analysis' | 'authorship-evidence' | 'literature-review' | 'research-paper'

export const LAUNCH_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  'documents',
  'editor',
  'humanise',
  'ai-content-check',
  'paraphraser',
  'grammar',
  'summariser',
  'verify-citations',
])

const ALL_TOOLS_ENV = import.meta.env.VITE_ENABLE_ALL_TOOLS === 'true'

export function isToolEnabled(id: ToolId, isAdmin = false): boolean {
  return ALL_TOOLS_ENV || isAdmin || LAUNCH_TOOLS.has(id)
}

/** Component-side helper: resolves the admin bypass from the signed-in user. */
export function useIsToolEnabled(): (id: ToolId) => boolean {
  const isAdmin = useAuthStore((s) => s.user?.role === 'Admin')
  return (id) => isToolEnabled(id, isAdmin)
}

// Optional panels, off unless switched on in the env (.env.development.local, or the build env):
//   VITE_SHOW_DISMISSED_REVIEW_NOTES=true      — the "Dismissed (n)" group under Review notes
//   VITE_SHOW_LIT_REVIEW_EVIDENCE_TABLES=true  — the "Evidence tables" panel on 2.0 Literature Review
//   VITE_SHOW_REVIEW_NOTES=true                — the Review notes strip above a section's editor
//   VITE_SHOW_THESIS_AUDIT_BANNER=true         — the "Ready for thesis? Run the readiness audit." banner
//                                                (the audit can still be run from the project Dashboard)
//   VITE_SHOW_METHODOLOGY_REFINEMENT=true      — Methodology Type step's "Refine further" details and the
//                                                explicit "Confirm Methodology" box; off = choosing an
//                                                approach confirms it straight away
//   VITE_CONFIRM_APPROVAL_ISSUES=true          — Approve first stops on citation/fact issues and asks
//                                                "Approve anyway"; off = Approve approves straight away
//   VITE_REQUIRE_CHAPTER_ORDER=true            — a later chapter can't be drafted until every earlier
//                                                chapter is approved; off = any chapter can be drafted
export const SHOW_DISMISSED_REVIEW_NOTES = import.meta.env.VITE_SHOW_DISMISSED_REVIEW_NOTES === 'true'
export const SHOW_LIT_REVIEW_EVIDENCE_TABLES = import.meta.env.VITE_SHOW_LIT_REVIEW_EVIDENCE_TABLES === 'true'
export const SHOW_REVIEW_NOTES = import.meta.env.VITE_SHOW_REVIEW_NOTES === 'true'
export const SHOW_THESIS_AUDIT_BANNER = import.meta.env.VITE_SHOW_THESIS_AUDIT_BANNER === 'true'
export const CONFIRM_APPROVAL_ISSUES = import.meta.env.VITE_CONFIRM_APPROVAL_ISSUES === 'true'
export const REQUIRE_CHAPTER_ORDER = import.meta.env.VITE_REQUIRE_CHAPTER_ORDER === 'true'
export const SHOW_METHODOLOGY_REFINEMENT =import.meta.env.VITE_SHOW_METHODOLOGY_REFINEMENT === 'true'

//   VITE_SHOW_CITATION_FLAGS=true              — open citation-check flags ("Citation: (Smith, 2020): …",
//                                                flag counts, flagged citation cards) in Guided and Document.
//                                                On in .env.development; off in production builds, where only
//                                                admins see them. The server still records every flag.
//                                                Explicitly 'false' hides them for everyone, admins included.
const CITATION_FLAGS_RAW = import.meta.env.VITE_SHOW_CITATION_FLAGS
const CITATION_FLAGS_ENV = CITATION_FLAGS_RAW === 'true'

/** Whether the signed-in user is shown open citation flags (read at call time, so login changes apply). */
export function showCitationFlags(): boolean {
  if (CITATION_FLAGS_RAW === 'false') return false
  return CITATION_FLAGS_ENV || useAuthStore.getState().user?.role === 'Admin'
}

//   VITE_SHOW_FLAG_COUNTS=true                 — flag counts in Document view: the outline's "3 flags" badges,
//                                                the Agent panel's "N open flags" box and the mobile "Agent · N
//                                                flags" button. Same rule: on in dev, off in production except admins.
//                                                The flags themselves still show on their sections.
//                                                Explicitly 'false' hides them for everyone, admins included.
const FLAG_COUNTS_RAW = import.meta.env.VITE_SHOW_FLAG_COUNTS
const FLAG_COUNTS_ENV = FLAG_COUNTS_RAW === 'true'

export function showFlagCounts(): boolean {
  if (FLAG_COUNTS_RAW === 'false') return false
  return FLAG_COUNTS_ENV || useAuthStore.getState().user?.role === 'Admin'
}

//   VITE_SHOW_PROPOSAL_ISSUES=true             — the Download step's "Issues in your proposal (N)" list with
//                                                "Fix issues and download" (and its fallback "Citation Warnings
//                                                Found" scan). Off: the step just offers the download, and the
//                                                .docx tile acknowledges citation issues instead of stopping on
//                                                them. Same rule: on in dev, off in production except admins.
const PROPOSAL_ISSUES_ENV = import.meta.env.VITE_SHOW_PROPOSAL_ISSUES === 'true'

export function showProposalIssues(): boolean {
  return PROPOSAL_ISSUES_ENV || useAuthStore.getState().user?.role === 'Admin'
}

//   VITE_REVIEW_EXPORT_GATE=block|warn|off     — Document view's "Export .docx" while Review has open issues
//                                                (placeholders, design-contract mismatches, variable-role
//                                                conflicts). block (default): export stops and asks for an
//                                                explicit "Export anyway" override, which is logged. warn: a
//                                                warning toast, then the export runs. off: no check.
export type ReviewExportGate = 'block' | 'warn' | 'off'
const REVIEW_GATE_RAW = import.meta.env.VITE_REVIEW_EXPORT_GATE
export const REVIEW_EXPORT_GATE: ReviewExportGate = REVIEW_GATE_RAW === 'warn' || REVIEW_GATE_RAW === 'off' ? REVIEW_GATE_RAW : 'block'
