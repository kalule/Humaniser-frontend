import type { FormatStyle } from '../types/citation'
import type { DocumentGenre } from '../types/library'
import type { EssayCitationStyle, WriteWithAiDocumentType } from '../types/workbench'

// The creation card persists citation style in the editor toolbar's vocabulary (FormatStyle,
// lowercase, has 'mla') since that's what the toolbar itself reads/writes. WriteWithAiModal's
// generation pipeline uses a separate, incompatible enum (EssayCitationStyle, PascalCase, no MLA
// at all) — this is the one place that boundary gets crossed, so the mapping lives here rather
// than at each call site. MLA has no EssayCitationStyle equivalent; it degrades to Apa7, the
// pipeline's own default, rather than throwing or silently picking an arbitrary style.
export function formatStyleToEssayCitationStyle(style: FormatStyle): EssayCitationStyle {
  switch (style) {
    case 'harvard':   return 'Harvard'
    case 'ieee':      return 'Ieee'
    case 'chicago':   return 'Chicago'
    case 'vancouver': return 'Vancouver'
    case 'apa7':
    case 'mla':
    default:
      return 'Apa7'
  }
}

// The creation card's four visible types map onto WriteWithAiModal's richer document-type set
// (which also has 'General' and 'CaseStudy', neither offered at creation time — CaseStudy needs
// an assignment-text input the creation card doesn't have, and 'Other' reads better as General
// writing than as any specific archetype).
export function documentGenreToWriteWithAiDocumentType(genre: DocumentGenre): WriteWithAiDocumentType {
  switch (genre) {
    case 'Essay':            return 'Essay'
    case 'LiteratureReview': return 'LiteratureReview'
    case 'ResearchPaper':    return 'ResearchPaper'
    case 'ThesisChapter':    return 'ThesisChapter'
    case 'Other':
    default:
      return 'General'
  }
}
