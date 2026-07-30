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
// override. One dedicated hue per kind (a color taxonomy), deliberately kept
// distinct rather than uniform: distinct colors let users visually scan a
// document list for "the orange ones" or "the green ones" far faster than
// reading each label, and a page that's all one color loses that signal.
export const DOCUMENT_KIND_META: Record<ContentKind, DocumentKindMeta> = {
  // Emerald — was amber, which sat too close to Lit. Review's orange to read
  // as intentional at icon-chip size.
  PROPOSAL: {
    icon:  ScrollText,
    color: 'text-emerald-600',
    bg:    'bg-emerald-50 border-emerald-200',
    label: 'Proposal',
  },
  // The only document-kind tag that uses amber. (Amber is also used for
  // warning/caution badges in the Systematic Review workflow — a separate
  // status-color convention — but never for another tag in this map.)
  LIT_REVIEW: {
    icon:  BookOpen,
    color: 'text-amber-text',
    bg:    'bg-amber-tint border-transparent',
    label: 'Lit. Review',
  },
  // Muted brand purple, not red — red is reserved for errors/destructive
  // states elsewhere in the app, and Article is the most common, unremarkable
  // document kind, not one that should read as "something's wrong."
  ARTICLE: {
    icon:  LayoutGrid,
    color: 'text-[var(--color-purple-text)]',
    bg:    'bg-[var(--color-purple-tint)] border-transparent',
    label: 'Article',
  },
  // Sky, not emerald — avoids colliding with Proposal now that Proposal owns
  // emerald. Not currently reachable from any creation flow (DocumentMode is
  // only ever set to 'PROPOSAL' today), but kept collision-free regardless.
  DISSERTATION: {
    icon:  GraduationCap,
    color: 'text-sky-600',
    bg:    'bg-sky-50 border-sky-200',
    label: 'Dissertation',
  },
}
