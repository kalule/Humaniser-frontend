import type { PaperSearchResult } from '../types/webLibrary'

const WORK_TYPE_LABELS: Record<string, string> = {
  'article': 'Article',
  'journal-article': 'Article',
  'review': 'Review article',
  'book': 'Book',
  'monograph': 'Book',
  'edited-book': 'Edited book',
  'book-chapter': 'Book chapter',
  'proceedings-article': 'Conference paper',
  'conference-paper': 'Conference paper',
  'preprint': 'Preprint',
  'posted-content': 'Preprint',
  'dissertation': 'Thesis',
  'report': 'Report',
  'dataset': 'Dataset',
  'editorial': 'Editorial',
  'letter': 'Letter',
  'erratum': 'Correction',
  'paratext': 'Front or back matter',
  'peer-review': 'Peer review report',
}

/** Provider type to a reader's word. Unknown types pass through, sentence-cased; none gives null. */
export function workTypeLabel(workType?: string): string | null {
  const key = workType?.trim().toLowerCase()
  if (!key) return null
  if (WORK_TYPE_LABELS[key]) return WORK_TYPE_LABELS[key]
  const words = key.replace(/[-_]+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** What the record carries. A PDF link is labelled as a link: nobody has opened it. */
export function contentLabel(level: PaperSearchResult['contentLevel']): { label: string; title: string } {
  switch (level) {
    case 'pdf': return { label: 'PDF link', title: 'The provider lists a PDF. It has not been opened or checked.' }
    case 'abstract': return { label: 'Abstract', title: 'Title, authors and abstract. No full text.' }
    default: return { label: 'Metadata only', title: 'Title and publication details only. No abstract or full text.' }
  }
}

/** One plain sentence for a record that is probably not what its title suggests, or null. */
export function cautionText(caution: PaperSearchResult['caution']): string | null {
  switch (caution) {
    case 'book-review':
      return 'This looks like a review of a book. The listed author is probably the reviewer, not the book\'s author. Check before you save or cite it.'
    case 'erratum':
      return 'This is a correction notice, not a research paper. Cite the paper it corrects instead.'
    case 'paratext':
      return 'This is front matter, back matter or a review report, not a research paper.'
    default:
      return null
  }
}
