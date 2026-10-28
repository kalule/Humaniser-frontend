import type { ElementType } from 'react'
import { Sparkles, Shield, RefreshCw, Scissors, SpellCheck, ClipboardCheck, ClipboardList, Library, ScrollText, BadgeCheck, Globe, MessageSquare, Mic, Brain, BarChart3, Telescope } from 'lucide-react'

// Single source of truth for tool navigation — drives the sidebar, the page
// header title, and the browser tab title, so all three can never drift out
// of sync the way "Dashboard" / "Document home" / tab title used to.

export interface NavItem {
  label: string
  icon: ElementType
  link: string
  matchPrefix?: string
  disabled?: boolean
  badge?: string
}

export interface NavSection {
  section: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    section: 'Write',
    items: [
      { label: 'Documents',        icon: Library,       link: '/app/library' },
      { label: 'Proposal Studio',   icon: ScrollText,    link: '/app/proposal-studio', matchPrefix: '/app/research-agent' },
      // { label: 'Thesis Studio',     icon: GraduationCap, link: '/app/thesis-studio' },
      { label: 'Systematic Review', icon: ClipboardList, link: '/app/systematic-review' },
      { label: 'Document Reviewer', icon: ClipboardCheck, link: '/app/reviewer' },
    ],
  },
  {
    section: 'Check & Improve',
    items: [
      { label: 'Humaniser',      icon: Sparkles,   link: '/app/humaniser' },
      { label: 'AI Detector',  icon: Shield,     link: '/app/detector' },
      { label: 'Paraphraser',  icon: RefreshCw,  link: '/app/paraphrase' },
      { label: 'Grammar',      icon: SpellCheck, link: '/app/grammar' },
      // // { label: 'Plagiarism Check', icon: BookOpen,   link: '/app/plagiarism' },
      { label: 'Summariser',    icon: Scissors,      link: '/app/summarise' },
       { label: 'Citation Integrity', icon: BadgeCheck, link: '/app/citation-integrity' },
    ],
  },
  {
    section: 'Research',
    items: [
      { label: 'Research Library',   icon: Globe,         link: '/app/web-library', matchPrefix: '/app/web-library' },
      { label: 'Deep Research',      icon: Telescope,     link: '/app/deep-research' },
      { label: 'Document Chat', icon: MessageSquare, link: '/app/document-chat' },
      //{ label: 'Citations',     icon: BookMarked,    link: '/app/citations' },
     // { label: 'Literature Review', icon: BookOpen,  link: '/app/literature-review' },
      { label: 'Lecture Notes', icon: Mic,           link: '/app/lecture' },
      { label: 'Flashcards',    icon: Brain,         link: '/app/flashcards' },
    ],
  },
  {
    section: 'Analyze',
    items: [
      { label: 'Data Analyst', icon: BarChart3, link: '/app/analyst' },
      // { label: 'Workbench',    icon: Layers,    link: '/app/workbench', badge: 'Beta' },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(s => s.items)

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

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true
  return pathname === item.link || (item.link === '/app/humaniser' && pathname === '/app')
}

// Resolves a pathname to the single display name shared by the page header
// and the browser tab title — the shared lookup that keeps them from
// disagreeing.
export function resolvePageTitle(pathname: string): string {
  const navMatch = NAV_ITEMS.find(item => isNavItemActive(item, pathname))
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
