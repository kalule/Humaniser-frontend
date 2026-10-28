import { downloadBlob } from './utils'
import type { ResearchDocument } from '../types/webLibrary'

// Minimal client-side export — the toolbar's Export button was a "coming
// soon" stub with no backend endpoint behind it (Research Library UX audit,
// 2026-10-03). BibTeX/RIS aren't offered here since no existing formatter in
// this codebase produces them (CitePopover only has the 5 prose citation
// styles) — CSV is the one real, implementable format.
function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function exportPapersToCsv(papers: ResearchDocument[]): void {
  const header = ['Title', 'Authors', 'Year', 'Journal', 'DOI']
  const rows = papers.map(p => [
    p.title,
    p.authors.join('; '),
    p.year?.toString() ?? '',
    p.journal ?? '',
    p.doi ?? '',
  ])
  const csv = [header, ...rows].map(row => row.map(csvField).join(',')).join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'research-library-export.csv')
}
