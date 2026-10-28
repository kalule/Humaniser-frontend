import type { FormatStyle } from '../../types/citation'
import { renderCslDocument } from './render'

export interface CitablePaper {
  title: string
  authors: string[]
  year?: number
  journal?: string
  doi?: string
}

/** One-paper preview; document numbering and disambiguation are resolved again on insertion. */
export function paperCitation(paper: CitablePaper, style: FormatStyle): { inText: string; reference: string } | null {
  try {
    const rendered = renderCslDocument([{
      id: 'paper', title: paper.title, authors: paper.authors.join('; '),
      year: paper.year, venue: paper.journal, doi: paper.doi,
    }], [{ id: 'preview', items: [{ sourceId: 'paper' }] }], style)
    const inText = rendered.citations.get('preview')
    const reference = rendered.bibliography.find(entry => entry.sourceId === 'paper')?.text
    return inText && reference ? { inText, reference } : null
  } catch {
    return null
  }
}
