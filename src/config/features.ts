import { useAuthStore } from '../store/authStore'

// Launch-visibility flag. Tools not in LAUNCH_TOOLS are hidden from every nav and their routes show a
// "Coming soon" page (see ToolGate). Admins and VITE_ENABLE_ALL_TOOLS=true bypass it, so development
// and internal testing are unaffected. To enable a tool at launch, add its id here — nothing else.

export type ToolId =
  | 'documents' | 'editor' | 'humanise' | 'ai-content-check' | 'paraphraser' | 'grammar' | 'summariser'
  | 'verify-citations' | 'similarity-check' | 'reviewer' | 'citation-generator'
  | 'proposal-studio' | 'thesis-studio' | 'systematic-review' | 'research-agent'
  | 'saved-sources' | 'deep-research' | 'document-chat' | 'lecture-notes' | 'flashcards'
  | 'data-analyst' | 'study-design' | 'feedback-tracker' | 'literature-matrix' | 'qualitative-analysis' | 'authorship-evidence'

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
