import { readFileSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { interactiveCitationTokens, referenceHtml, escapeCitationHtml, type EditorSource } from '../../src/lib/editorCitations'
import { renderLiteratureReviewParagraphs } from '../../src/lib/literatureReviewFormat'
import { orderEssayReferences } from '../../src/lib/essayReferenceOrder'
import { buildWordExportHtml } from '../../src/lib/wordExport'
import type { WriteWithAiResponse } from '../../src/types/workbench'

it('renders the actual live research-paper result with interactive citations and exportable sections', () => {
  const report = JSON.parse(readFileSync('artifacts/research-workflow/live-report.json', 'utf8'))
  const result = (report.resumedOutcome ?? report.outcome).result as WriteWithAiResponse
  expect(result.completionStatus).toBe('Complete')
  expect(result.researchPaperFlags?.some(flag => flag.code === 'ModeMismatch')).toBe(false)
  expect(result.isResearchPaper).toBe(true)
  const refs = orderEssayReferences(result.references, 'Harvard', result.content)
  const namespace = result.generationAuditId || report.runId
  const sections = result.researchPaperSectionResults ?? []
  const body = `<h1>${escapeCitationHtml(result.title)}</h1>` + sections.map(section => {
    if (section.status === 'Generated' && section.content) return `<h2>${escapeCitationHtml(section.heading)}</h2>${renderLiteratureReviewParagraphs(interactiveCitationTokens(section.content, refs, 'harvard', namespace))}`
    if (section.status === 'EvidenceRequired') return `<h2>${escapeCitationHtml(section.heading)}</h2><p>Evidence required: ${escapeCitationHtml(section.reason || '')}</p>`
    return ''
  }).join('') + '<h2>References</h2>' + refs.map((ref, i) => referenceHtml({ ...ref, id: `${namespace}:${ref.sourceId}` } as EditorSource, 'harvard', i)).join('')
  expect(body).toContain('<cite ')
  expect(body).toContain('data-citation-reference=')
  expect(body.replace(/<[^>]+>/g, '')).not.toMatch(/\[(?:N:)?S\d+\]/)
  expect(sections.some(section => section.sectionKey === 'Results')).toBe(false)
  writeFileSync('artifacts/research-workflow/live-paper.html', body)
  writeFileSync('artifacts/research-workflow/live-paper.doc', buildWordExportHtml(result.title, body, []))
})
