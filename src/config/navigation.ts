import type { ElementType } from 'react'
import {
  Sparkles, Shield, RefreshCw, BookOpen, Scissors, SpellCheck, BarChart2,
  MessageSquare, BookMarked, Library, Globe, ScrollText,
  ClipboardList, GraduationCap, ClipboardCheck,
} from 'lucide-react'

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
      { label: 'Thesis Studio',     icon: GraduationCap, link: '/app/thesis-studio' },
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
      // { label: 'Plagiarism Check', icon: BookOpen,   link: '/app/plagiarism' },
       { label: 'Summariser',    icon: Scissors,      link: '/app/summarise' },
    ],
  },
  {
    section: 'Research',
    items: [
      { label: 'Web Library',   icon: Globe,         link: '/app/web-library' },
      { label: 'Document Chat', icon: MessageSquare, link: '/app/document-chat' },
      { label: 'Citations',     icon: BookMarked,    link: '/app/citations' },
      { label: 'Literature Review', icon: BookOpen,  link: '/app/literature-review' },
      // { label: 'Lecture Notes', icon: Mic,           link: '/app/lecture' },
      // { label: 'Flashcards',    icon: Brain,         link: '/app/flashcards' },
    ],
  },
  {
    section: 'Analyze',
    items: [
      { label: 'Data Analyst', icon: BarChart2, link: '/app/analyst' },
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
