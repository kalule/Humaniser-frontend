import type { CitationDto, FormatStyle } from '../types/citation'
import type { WorkspaceDocument } from '../types/library'
import { libraryApi } from '../api/library'
import { citationItems, essayStyle, type CitationAttrs, type EditorSource } from './editorCitations'
import { formatEssayReferenceListEntry } from './citationFormat'

export type ExportFormat = 'docx' | 'pdf'

export const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'docx', label: 'Word (.docx)' },
  { format: 'pdf', label: 'PDF' },
]

const FALLBACK_NAME = 'HumaniseAI document'
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Same rules as the server (LibraryService.SanitizeFileName), so the saved name matches. */
export function exportFileName(title: string | undefined, format: ExportFormat): string {
  const cleaned = (title ?? '').replace(FORBIDDEN, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120).replace(/[. ]+$/, '')
  const base = !cleaned || /^untitled document$/i.test(cleaned) || RESERVED.test(cleaned) ? FALLBACK_NAME : cleaned
  return `${base}.${format}`
}

interface JsonNode { type?: string; text?: string; attrs?: Record<string, unknown>; content?: JsonNode[] }

function parse(content: string | undefined): JsonNode | null {
  if (!content) return null
  try { const v = JSON.parse(content) as unknown; return v && typeof v === 'object' ? (v as JsonNode) : null } catch { return null }
}

function walk(node: JsonNode, visit: (n: JsonNode) => void) {
  visit(node)
  node.content?.forEach(child => walk(child, visit))
}

/**
 * Words in a document, excluding bibliography entries — the same notion of "empty" the editor's
 * word count uses. Plain-text/HTML legacy content counts by its visible text.
 */
export function documentWordCount(content: string | undefined): number {
  if (!content?.trim()) return 0
  const root = parse(content)
  if (!root) return content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  const parts: string[] = []
  walk(root, n => {
    if (n.type === 'text' && n.text) parts.push(n.text)
    else if (n.type === 'citation' && typeof n.attrs?.label === 'string') parts.push(n.attrs.label)
  })
  // citationReference nodes are atoms with no text children, so bibliography entries never count.
  return parts.join(' ').split(/\s+/).filter(Boolean).length
}

export const isDocumentEmpty = (content: string | undefined) => documentWordCount(content) === 0

/** Uploaded originals (PDF/Word files) are already files; only written documents are exported. */
export function isExportable(doc: Pick<WorkspaceDocument, 'isPdf' | 'type' | 'filePath'>): boolean {
  return !doc.isPdf && doc.type !== 'pdf' && !doc.filePath
}

/**
 * Formatted reference-list entries for the sources a document cites, in order of first appearance
 * — the same list the editor shows under "References". Sources already present as bibliography
 * blocks in the document body are exported with the body, so they are not repeated here.
 */
export function buildExportReferences(content: string | undefined, library: CitationDto[], style: FormatStyle): string[] {
  const root = parse(content)
  if (!root) return []
  const inBibliography = new Set<string>()
  const order: string[] = []
  walk(root, n => {
    const source = n.type === 'citationReference' ? (n.attrs?.source as EditorSource | null | undefined) : undefined
    if (source?.id) { inBibliography.add(source.id); if (!order.includes(source.id)) order.push(source.id) }
  })
  const cited = new Map<string, EditorSource>()
  walk(root, n => {
    if (n.type !== 'citation') return
    for (const item of citationItems((n.attrs ?? {}) as Partial<CitationAttrs>, library)) {
      if (!order.includes(item.sourceId)) order.push(item.sourceId)
      if (item.source && !inBibliography.has(item.sourceId) && !cited.has(item.sourceId)) cited.set(item.sourceId, item.source)
    }
  })
  return [...cited.values()].map(source =>
    source.rawReference ?? formatEssayReferenceListEntry(source, essayStyle(style), Math.max(0, order.indexOf(source.id))))
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function downloadLibraryDocument(
  doc: Pick<WorkspaceDocument, 'id' | 'title'>, format: ExportFormat, references: string[],
): Promise<void> {
  const blob = await libraryApi.exportDocument(doc.id, format, references)
  saveBlob(blob, exportFileName(doc.title, format))
}

export function exportErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message
  return message ? `Couldn't download the document: ${message}` : "Couldn't download the document. Please try again."
}
