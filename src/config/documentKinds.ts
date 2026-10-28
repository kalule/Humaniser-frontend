import type { ElementType } from 'react'
import { ScrollText, BookOpen, LayoutGrid, GraduationCap } from 'lucide-react'
import type { WizardMode } from '../types/studio'
import type { DocumentMode } from '../types/research'

export type ContentKind = WizardMode | Extract<DocumentMode, 'DISSERTATION'>

export interface DocumentKindMeta {
  icon:  ElementType
  color: string
  bg:    string
  label: string
}

// Single source of truth for the icon/color/label of each document content
// kind — shared across every page that renders a document-kind tag, so a
// color change applies everywhere at once instead of needing a per-page
// override. All kinds share the one brand-purple treatment (Proposal Studio
// UX audit, 2026-10-03) — a per-kind color taxonomy competed with the page's
// own CTA hierarchy instead of supporting it; kind is still distinguishable
// via the label/icon shape, not via a dedicated hue.
export const DOCUMENT_KIND_META: Record<ContentKind, DocumentKindMeta> = {
  PROPOSAL: {
    icon:  ScrollText,
    color: 'text-[var(--color-purple-text)]',
    bg:    'bg-[var(--color-purple-tint)] border-transparent',
    label: 'Proposal',
  },
  LIT_REVIEW: {
    icon:  BookOpen,
    color: 'text-[var(--color-purple-text)]',
    bg:    'bg-[var(--color-purple-tint)] border-transparent',
    label: 'Lit. Review',
  },
  ARTICLE: {
    icon:  LayoutGrid,
    color: 'text-[var(--color-purple-text)]',
    bg:    'bg-[var(--color-purple-tint)] border-transparent',
    label: 'Article',
  },
  // Not currently reachable from any creation flow (DocumentMode is only ever
  // set to 'PROPOSAL' today), kept for type completeness.
  DISSERTATION: {
    icon:  GraduationCap,
    color: 'text-[var(--color-purple-text)]',
    bg:    'bg-[var(--color-purple-tint)] border-transparent',
    label: 'Dissertation',
  },
}
