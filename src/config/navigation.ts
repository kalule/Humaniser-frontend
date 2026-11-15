import type { ElementType } from 'react'
import {
  Sparkles, Shield, RefreshCw, Scissors, SpellCheck, ClipboardCheck, ClipboardList, Library, ScrollText,
  BadgeCheck, Globe, MessageSquare, Mic, Brain, BarChart3, Telescope, FileText, GraduationCap, BookOpen, BookMarked, Ruler, ListChecks,
} from 'lucide-react'
import type { ToolId } from './features'

// Single source of truth for tool navigation — drives the sidebar, the icon rail (TOOL_NAV), the page
// header title, and the browser tab title, so they can never drift out of sync. A tool's label and
// one-line description are defined once, here.

export interface ToolDef {
  id: ToolId
  label: string
  description: string
  icon: ElementType
  link: string
  matchPrefix?: string | string[]
  badge?: string
}

export const TOOLS: Record<ToolId, ToolDef> = {
  'documents':          { id: 'documents', label: 'Documents', description: 'Drafts and uploads', icon: Library, link: '/app/library' },
  'editor':             { id: 'editor', label: 'Editor', description: 'Write and edit a document', icon: FileText, link: '/app/editor/new', matchPrefix: '/app/editor' },
  'humanise':           { id: 'humanise', label: 'Humanise', description: 'Make AI text sound like you', icon: Sparkles, link: '/app/humaniser' },
  'ai-content-check':   { id: 'ai-content-check', label: 'AI Content Check', description: 'See how AI-like text reads', icon: Shield, link: '/app/detector', matchPrefix: '/app/detector' },
  'paraphraser':        { id: 'paraphraser', label: 'Paraphraser', description: 'Reword a passage', icon: RefreshCw, link: '/app/paraphrase' },
  'grammar':            { id: 'grammar', label: 'Grammar & Style', description: 'Fix grammar, clarity, tone', icon: SpellCheck, link: '/app/grammar' },
  'summariser':         { id: 'summariser', label: 'Summariser', description: 'Condense long text', icon: Scissors, link: '/app/summarise' },
  // One entry for both citation tools: /app/citation-check is the primary (document check) page and
  // /app/citation-integrity (quick paste check) is reached from inside it.
  'verify-citations':   { id: 'verify-citations', label: 'Verify Citations', description: 'Check your citations', icon: BadgeCheck, link: '/app/citation-check', matchPrefix: ['/app/citation-check', '/app/citation-integrity'], badge: 'Beta' },
  'similarity-check':   { id: 'similarity-check', label: 'Similarity Check', description: 'Compare against sources', icon: BookOpen, link: '/app/plagiarism' },
  'reviewer':           { id: 'reviewer', label: 'Reviewer', description: 'Examiner-style feedback', icon: ClipboardCheck, link: '/app/reviewer', matchPrefix: '/app/reviewer' },
  // Sits next to Reviewer: Reviewer gives new feedback, this tracks the supervisor's. Its own prefix, so neither claims the other's pages.
  'feedback-tracker':   { id: 'feedback-tracker', label: 'Feedback Tracker', description: 'Track supervisor comments', icon: ListChecks, link: '/app/feedback-tracker', matchPrefix: '/app/feedback-tracker', badge: 'Beta' },
  'citation-generator': { id: 'citation-generator', label: 'Citation Generator', description: 'Format your references', icon: BookMarked, link: '/app/citations' },
  'proposal-studio':    { id: 'proposal-studio', label: 'Proposal Studio', description: 'Draft a research proposal', icon: ScrollText, link: '/app/proposal-studio', matchPrefix: '/app/research-agent' },
  'systematic-review':  { id: 'systematic-review', label: 'Systematic Review', description: 'Structured literature review', icon: ClipboardList, link: '/app/systematic-review', matchPrefix: '/app/systematic-review' },
  'research-agent':     { id: 'research-agent', label: 'Research Agent', description: 'Build a project step by step', icon: GraduationCap, link: '/app/research-agent/new' },
  'saved-sources':      { id: 'saved-sources', label: 'Saved Sources', description: 'Papers you saved', icon: Globe, link: '/app/web-library', matchPrefix: '/app/web-library' },
  'deep-research':      { id: 'deep-research', label: 'Deep Research', description: 'Investigate across sources', icon: Telescope, link: '/app/deep-research' },
  'document-chat':      { id: 'document-chat', label: 'Document Chat', description: 'Ask questions about a file', icon: MessageSquare, link: '/app/document-chat' },
  'lecture-notes':      { id: 'lecture-notes', label: 'Lecture Notes', description: 'Turn lectures into notes', icon: Mic, link: '/app/lecture' },
  'flashcards':         { id: 'flashcards', label: 'Flashcards', description: 'Turn notes into study cards', icon: Brain, link: '/app/flashcards' },
  'data-analyst':       { id: 'data-analyst', label: 'Data Analyst', description: 'Analyse data, get charts', icon: BarChart3, link: '/app/analyst' },
  // Comes before Data Analyst in the Analyze group: design the study, then analyse what it collects. Its own
  // prefix, so the proposal-studio entry's claim on /app/research-agent does not reach it.
  'study-design':       { id: 'study-design', label: 'Study Design', description: 'Sample size and questionnaire', icon: Ruler, link: '/app/study-design', matchPrefix: '/app/study-design', badge: 'Beta' },
}

export interface NavItem extends ToolDef {
  disabled?: boolean
}

export interface NavSection {
  section: string
  items: NavItem[]
}

const pick = (...ids: ToolId[]): NavItem[] => ids.map(id => TOOLS[id])

// Sections whose tools are all hidden render nothing, so the Phase 2 groups reappear on their own
// once their flags are on.
export const NAV_SECTIONS: NavSection[] = [
  { section: 'Write',    items: pick('documents', 'editor', 'citation-generator') },
  { section: 'Verify',   items: pick('verify-citations', 'ai-content-check', 'similarity-check', 'reviewer', 'feedback-tracker') },
  { section: 'Improve',  items: pick('humanise', 'paraphraser', 'grammar', 'summariser') },
  { section: 'Studios',  items: pick('proposal-studio', 'systematic-review') },
  { section: 'Research', items: pick('saved-sources', 'deep-research', 'document-chat', 'lecture-notes', 'flashcards') },
  { section: 'Analyze',  items: pick('study-design', 'data-analyst') },
]

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(s => s.items)

/** Sidebar sections with flag-disabled tools removed; empty sections are dropped. */
export function visibleNavSections(isEnabled: (id: ToolId) => boolean): NavSection[] {
  return NAV_SECTIONS
    .map(sec => ({ ...sec, items: sec.items.filter(t => isEnabled(t.id)) }))
    .filter(sec => sec.items.length > 0)
}

/** Order of the 52px icon rail (ToolSidebar). */
export const TOOL_NAV_ORDER: ToolId[] = [
  'documents', 'saved-sources', 'editor', 'research-agent', 'humanise', 'ai-content-check', 'verify-citations',
  'paraphraser', 'grammar', 'similarity-check', 'summariser', 'data-analyst', 'document-chat',
  'citation-generator', 'flashcards', 'lecture-notes',
]

// Pages reachable from the app shell but not represented in the sidebar
// (account/settings-type pages) — kept separate from NAV_ITEMS since they
// aren't "tools" and shouldn't render in the nav.
const NON_NAV_PAGES: { label: string; link: string; matchPrefix?: string }[] = [
  { label: 'History',           link: '/app/history' },
  { label: 'Account Settings',  link: '/app/account' },
  { label: 'Billing',           link: '/app/billing' },
  { label: 'Checkout',          link: '/app/checkout/mock', matchPrefix: '/app/checkout/mock' },
  { label: 'Systematic Review', link: '/app/systematic-review', matchPrefix: '/app/systematic-review' },
]

export function isNavItemActive(item: ToolDef, pathname: string): boolean {
  const prefixes = item.matchPrefix === undefined ? [] : Array.isArray(item.matchPrefix) ? item.matchPrefix : [item.matchPrefix]
  if (prefixes.some(p => pathname.startsWith(p))) return true
  return pathname === item.link || (item.link === '/app/humaniser' && pathname === '/app')
}

/** The tool a pathname belongs to, or null for non-tool pages (account, billing, history…). */
export function toolForPath(pathname: string): ToolDef | null {
  return NAV_ITEMS.find(item => isNavItemActive(item, pathname)) ?? null
}

// Resolves a pathname to the single display name shared by the page header
// and the browser tab title — the shared lookup that keeps them from
// disagreeing.
export function resolvePageTitle(pathname: string): string {
  const navMatch = toolForPath(pathname)
  if (navMatch) return navMatch.label

  const pageMatch = NON_NAV_PAGES.find(
    p => (p.matchPrefix && pathname.startsWith(p.matchPrefix)) || pathname === p.link,
  )
  if (pageMatch) return pageMatch.label

  return 'Dashboard'
}

// ── Editor route title (dynamic — depends on document state, not just pathname) ──
//
// resolvePageTitle above is a pure pathname→label lookup, which can't work for the
// editor: its title is the document's own title, which lives in useLibraryStore, not
// in any static table. These two helpers keep that dynamic case next to its sibling
// so AppNavbar can special-case /app/editor/:id without hiding that logic elsewhere.

const EDITOR_ROUTE_PATTERN = /^\/app\/editor\/([^/]+)$/

/** Returns the editor's :documentId segment, or null if the pathname isn't an editor route. */
export function matchEditorDocumentId(pathname: string): string | null {
  return EDITOR_ROUTE_PATTERN.exec(pathname)?.[1] ?? null
}

export interface EditorHeaderTitle {
  /** null means "still resolving" — render a neutral placeholder, not a guessed title. */
  breadcrumbTitle: string | null
  tabTitle: string
}

const NEUTRAL_TAB_TITLE = 'HumaniseAI'
const UNTITLED = 'Untitled document'

// documentId is the raw :documentId route param (may be 'new' for the not-yet-created
// draft route), hasLoaded/documents mirror useLibraryStore's fields directly so this
// stays a pure function callers can unit test without touching the store or routing.
export function resolveEditorHeaderTitle(
  documentId: string | undefined,
  hasLoaded: boolean,
  documents: { id: string; title: string }[],
): EditorHeaderTitle {
  if (documentId === 'new') {
    return { breadcrumbTitle: UNTITLED, tabTitle: `${UNTITLED} · HumaniseAI` }
  }
  // The library loads once, app-wide, after login (see App.tsx) — not per-route — so a
  // direct deep link or refresh into the editor can render before it arrives. Showing
  // "Untitled document" here would flash the wrong title for any named document, so
  // this state renders as neutral instead of guessing.
  if (!hasLoaded) {
    return { breadcrumbTitle: null, tabTitle: NEUTRAL_TAB_TITLE }
  }
  const title = documents.find(d => d.id === documentId)?.title?.trim() || UNTITLED
  return { breadcrumbTitle: title, tabTitle: `${title} · HumaniseAI` }
}
