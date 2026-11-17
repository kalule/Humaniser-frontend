// Literature Matrix: the types the server returns and the display rules that sit on top of them.
//
// The rules this file keeps:
// - "Not reported" always means "not in the material the system had", never "the study did not do it", and the
//   material is always named (full text, abstract only, or details only).
// - The researcher's own value is labelled as theirs; the extracted value is never shown as if it were theirs.
// - A cell the code could not confirm is shown as "Check this", whatever the model said about its confidence.

export type EvidenceStatus = 'FullTextVerified' | 'AbstractOnly' | 'MetadataOnly' | 'UserSupplied' | 'NotReported' | 'Uncertain'
export type Material = 'FullText' | 'Abstract' | 'Metadata'
export type ExtractionState = 'NotExtracted' | 'Queued' | 'Extracted' | 'Failed'

export interface MatrixColumn {
  id: string
  key: string
  label: string
  instruction: string
  isCustom: boolean
  isInterpretation: boolean
  ordinal: number
  isVisible: boolean
}

export interface MatrixSummary {
  id: string
  name: string
  researchQuestion: string | null
  researchProjectId: string | null
  researchProjectTitle: string | null
  preset: string
  studyCount: number
  createdAt: string
  updatedAt: string
  purgeAfter: string
}

export interface Matrix extends MatrixSummary {
  consentAccepted: boolean
  columns: MatrixColumn[]
  retentionDays: number
  maxStudies: number
  themes: string[]
  creditsPerStudy: number
  extractionAvailable: boolean
}

export interface MatrixPreset { key: string; label: string; description: string; columns: string[] }

export interface Provenance {
  origin: 'SavedSource' | 'SearchResult' | 'Upload' | string
  provider: string | null
  providerRecordId: string | null
  query: string | null
  retrievedAt: string | null
  fileName: string | null
  mergedBy: string | null
  addedAt: string
}

export interface MatrixCell {
  columnId: string
  key: string
  value: string | null
  status: EvidenceStatus
  verified: boolean
  edited: boolean
  aiValue: string | null
  aiStatus: EvidenceStatus | null
  confidence: string | null
  flag: string | null
  passages: number
}

export interface MatrixStudy {
  id: string
  documentId: string
  title: string
  authors: string[]
  year: number | null
  journal: string | null
  doi: string | null
  docType: string
  sourceDeleted: boolean
  material: Material
  uploadedFileName: string | null
  possibleDuplicateOfId: string | null
  possibleDuplicateReason: string | null
  design: string | null
  notes: string | null
  extractionState: ExtractionState
  provenance: Provenance[]
  addedAt: string
  extractionError: string | null
  cells: MatrixCell[]
  themes: string[]
}

export interface MatrixStudyPage { items: MatrixStudy[]; total: number; page: number; pageSize: number }

export interface SourceOutcome { outcome: 'added' | 'merged' | 'flagged' | 'skipped'; title: string; studyId: string | null; rule: string | null; reason: string | null; otherStudyId: string | null }
export interface AddSourcesResult { added: number; merged: number; flagged: number; skipped: number; outcomes: SourceOutcome[] }

export interface MatrixRun {
  id: string
  status: 'Queued' | 'Running' | 'Completed' | 'Failed' | string
  studiesTotal: number
  studiesDone: number
  studiesSkipped: number
  studiesFailed: number
  message: string | null
  creditsPerStudy: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface Passage { text: string; basis: 'FullText' | 'Abstract' | 'Title' | string; locator: string | null }

export interface EvidenceCell {
  columnId: string
  key: string
  label: string
  isInterpretation: boolean
  value: string | null
  status: EvidenceStatus | null
  verified: boolean
  verifiedAt: string | null
  researcherValue: string | null
  researcherEditedAt: string | null
  aiValue: string | null
  aiStatus: EvidenceStatus | null
  confidence: string | null
  flag: string | null
  aiModel: string | null
  promptVersion: string | null
  aiExtractedAt: string | null
  passages: Passage[]
}

export interface Evidence { study: MatrixStudy; abstract: string | null; cells: EvidenceCell[] }

export interface HandOffResult {
  projectId: string
  projectTitle: string
  added: number
  alreadyInProject: number
  skippedUnverified: number
  outcomes: { title: string; outcome: 'added' | 'already_in_project' | 'skipped'; reason: string | null }[]
}

// ── Limits the server enforces, repeated so a message can arrive before the request ──────────────────────────

export const MAX_NAME_CHARS = 120
export const MAX_QUESTION_CHARS = 1000
export const MAX_CELL_CHARS = 2000
export const MAX_NOTES_CHARS = 5000
export const UPLOAD_EXTENSIONS = ['.pdf', '.docx'] as const
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
export const PAGE_SIZE = 50
export const DESIGNS = ['quantitative', 'qualitative', 'mixed', 'review', 'experimental', 'unclassified'] as const

// ── Plain-language labels ────────────────────────────────────────────────────────────────────────────────────

export interface StatusLabel { short: string; long: string; tone: 'green' | 'blue' | 'slate' | 'purple' | 'amber' }

/** One status, as the table shows it (short) and as the drawer explains it (long). */
export function statusLabel(status: EvidenceStatus | null | undefined, interpretation = false): StatusLabel {
  // For the Relevance column, "not reported" means the model found nothing that bears on the research question.
  if (interpretation && status === 'NotReported')
    return { short: 'No link found', long: 'Nothing extracted from this study bears on your research question, or there was too little to tell.', tone: 'slate' }
  switch (status) {
    case 'FullTextVerified': return { short: 'Full text', long: 'Found in the full text of the study.', tone: 'green' }
    case 'AbstractOnly': return { short: 'Abstract only', long: 'Found in the abstract. The full text was not available, so check it against the paper.', tone: 'blue' }
    case 'MetadataOnly': return { short: 'Details only', long: 'Taken from the title or bibliographic details, not from the study itself.', tone: 'slate' }
    case 'UserSupplied': return { short: 'Your value', long: 'Entered or corrected by you.', tone: 'purple' }
    case 'NotReported': return { short: 'Not reported', long: 'Not found in the material available. This does not mean the study did not report it.', tone: 'slate' }
    case 'Uncertain': return { short: 'Check this', long: 'A value was proposed, but its supporting passage could not be confirmed in the text. Check it before using it.', tone: 'amber' }
    default: return { short: 'Not extracted', long: 'Nothing has been extracted for this yet.', tone: 'slate' }
  }
}

/** Why the code distrusted an extracted value, in words. */
export function flagLabel(flag: string | null | undefined): string | null {
  switch (flag) {
    case 'passage_not_found': return 'The passage given for this value is not in the text, so it was not kept.'
    case 'number_not_in_passage': return 'A number in this value does not appear in its passage.'
    case 'missing_from_reply': return 'No answer was given for this field.'
    default: return null
  }
}

/** The label the server stores in place of a file name for a copy it found itself (MatrixOpenAccessFullText.SourceLabel). */
export const OPEN_ACCESS_SOURCE_LABEL = 'Open-access copy (found automatically)'

export function materialLabel(material: Material): { short: string; long: string } {
  switch (material) {
    case 'FullText': return { short: 'Full text', long: 'The full text is available (a file you uploaded, or a free open-access copy found by DOI).' }
    case 'Abstract': return { short: 'Abstract only', long: 'Only the abstract is available. Find a free copy or upload the paper to extract methods and limitations reliably.' }
    default: return { short: 'Details only', long: 'Only bibliographic details are available. Nothing can be extracted until you add the abstract or upload the paper.' }
  }
}

export function originLabel(p: Provenance): string {
  const via = p.provider ? ` via ${p.provider}` : ''
  switch (p.origin) {
    case 'SavedSource': return `Saved Sources${via}${p.query ? `, found by searching "${p.query}"` : ''}`
    case 'SearchResult': return `Literature search${via}${p.query ? ` for "${p.query}"` : ''}`
    case 'Upload': return `Uploaded file${p.fileName ? ` ${p.fileName}` : ''}`
    default: return p.origin
  }
}

export function mergeLabel(rule: string | null | undefined): string | null {
  switch (rule) {
    case 'Doi': return 'same DOI'
    case 'TitleYear': return 'same title and year'
    case 'TitleAuthors': return 'same title and authors'
    case 'ProviderId': return 'same database record'
    case 'SameDocument': return 'same saved source'
    case 'SameFile': return 'same file'
    case 'Student': return 'merged by you'
    default: return null
  }
}

/** "Nakato & Okello (2021)", "Nakato et al. (2021)", "Untitled (n.d.)". Surnames are taken as written. */
export function studyLabel(study: Pick<MatrixStudy, 'authors' | 'year'>): string {
  const surname = (a: string) => {
    const name = a.trim()
    if (name.includes(',')) return name.split(',')[0].trim()
    const parts = name.split(/\s+/)
    const last = parts[parts.length - 1].replace(/\./g, '')
    return parts.length > 1 && last.length <= 3 && last === last.toUpperCase() ? parts[0] : parts[parts.length - 1]
  }
  const names = study.authors.filter(a => a.trim().length > 0).map(surname)
  const who = names.length === 0 ? 'No author listed' : names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names[0]} et al.`
  return `${who} (${study.year ?? 'n.d.'})`
}

// ── Filtering and sorting the loaded rows ────────────────────────────────────────────────────────────────────

export type RowFilter = 'all' | 'needs-check' | 'not-extracted' | 'full-text' | 'abstract' | 'metadata' | 'duplicates' | 'verified'

export const ROW_FILTERS: { value: RowFilter; label: string }[] = [
  { value: 'all', label: 'All studies' },
  { value: 'needs-check', label: 'Has values to check' },
  { value: 'not-extracted', label: 'Not extracted yet' },
  { value: 'full-text', label: 'Full text available' },
  { value: 'abstract', label: 'Abstract only' },
  { value: 'metadata', label: 'Details only' },
  { value: 'duplicates', label: 'Possible duplicates' },
  { value: 'verified', label: 'Fully verified' },
]

export function isFullyVerified(study: MatrixStudy): boolean {
  const filled = study.cells.filter(c => c.value !== null)
  return filled.length > 0 && filled.every(c => c.verified)
}

export function matchesFilter(study: MatrixStudy, filter: RowFilter): boolean {
  switch (filter) {
    case 'needs-check': return study.cells.some(c => c.status === 'Uncertain' && !c.verified)
    case 'not-extracted': return study.extractionState === 'NotExtracted' || study.extractionState === 'Failed'
    case 'full-text': return study.material === 'FullText'
    case 'abstract': return study.material === 'Abstract'
    case 'metadata': return study.material === 'Metadata'
    case 'duplicates': return study.possibleDuplicateOfId !== null
    case 'verified': return isFullyVerified(study)
    default: return true
  }
}

export function matchesSearch(study: MatrixStudy, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return true
  const hay = [study.title, study.journal ?? '', study.doi ?? '', study.notes ?? '', String(study.year ?? ''), ...study.authors, ...study.themes,
    ...study.cells.map(c => c.value ?? '')]
  return hay.some(h => h.toLowerCase().includes(q))
}

export type SortKey = 'added' | 'study' | 'year' | 'title' | `col:${string}`

export function sortStudies(studies: MatrixStudy[], key: SortKey, descending: boolean): MatrixStudy[] {
  const value = (s: MatrixStudy): string | number => {
    if (key === 'year') return s.year ?? (descending ? -Infinity : Infinity)
    if (key === 'title') return s.title.toLowerCase()
    if (key === 'study') return studyLabel(s).toLowerCase()
    if (key.startsWith('col:')) return (s.cells.find(c => c.key === key.slice(4))?.value ?? '￿').toLowerCase()
    return s.addedAt
  }
  const sorted = [...studies].sort((a, b) => {
    const x = value(a), y = value(b)
    const order = x < y ? -1 : x > y ? 1 : a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0
    return descending ? -order : order
  })
  return sorted
}

/** The table's form of a cell the server returned after an edit, so a row can be updated without a reload. */
export function cellFromEvidence(c: EvidenceCell): MatrixCell {
  return {
    columnId: c.columnId, key: c.key, value: c.value, status: c.status ?? 'NotReported', verified: c.verified,
    edited: c.researcherValue !== null, aiValue: c.aiValue, aiStatus: c.aiStatus, confidence: c.confidence, flag: c.flag,
    passages: c.passages.length,
  }
}

/** Replaces or removes one cell of a row; a cell with no status (nothing extracted, nothing entered) is removed. */
export function withCell(study: MatrixStudy, cell: EvidenceCell): MatrixStudy {
  const others = study.cells.filter(c => c.columnId !== cell.columnId)
  return { ...study, cells: cell.status === null ? others : [...others, cellFromEvidence(cell)] }
}

export function materialCounts(studies: MatrixStudy[]): Record<Material, number> {
  return {
    FullText: studies.filter(s => s.material === 'FullText').length,
    Abstract: studies.filter(s => s.material === 'Abstract').length,
    Metadata: studies.filter(s => s.material === 'Metadata').length,
  }
}

// ── Messages ─────────────────────────────────────────────────────────────────────────────────────────────────

export function validateName(name: string): string | null {
  const n = name.trim().length
  if (n === 0) return 'Give the matrix a name.'
  if (n > MAX_NAME_CHARS) return `The name is ${n} characters and the limit is ${MAX_NAME_CHARS}.`
  return null
}

export function validateUpload(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!UPLOAD_EXTENSIONS.some(ext => name.endsWith(ext))) return 'Upload a PDF or Word (.docx) file.'
  if (file.size > MAX_UPLOAD_BYTES) return 'That file is larger than 50 MB. Upload the article itself.'
  if (file.size === 0) return 'That file is empty.'
  return null
}

export function runSummary(run: MatrixRun): string {
  const parts = [`${run.studiesDone} analysed`]
  if (run.studiesSkipped > 0) parts.push(`${run.studiesSkipped} unchanged and skipped`)
  if (run.studiesFailed > 0) parts.push(`${run.studiesFailed} could not be analysed`)
  return `${parts.join(', ')} of ${run.studiesTotal}.`
}

export const isRunActive = (run: MatrixRun | null | undefined) => run?.status === 'Queued' || run?.status === 'Running'

/** Credits for a run, at most: unchanged studies and studies with no text cost nothing, so the real charge is often lower. */
export function creditEstimate(studies: MatrixStudy[], creditsPerStudy: number): number {
  return studies.filter(s => s.material !== 'Metadata').length * creditsPerStudy
}

interface Failure { code?: string; message?: string; response?: { status?: number } }

/** One sentence the student can act on, for any failed matrix request. */
export function failureMessage(err: unknown, action: 'create' | 'add' | 'upload' | 'extract' | 'save' | 'load' | 'delete' | 'export'): string {
  const e = (err ?? {}) as Failure
  const status = e.response?.status
  if (status === 402) return 'You do not have enough credits for this. Nothing was charged.'
  if (status === 429) return 'Too many requests in a short time. Wait a minute and try again.'
  if (status === 413) return 'That file is too large. Upload the article itself.'
  // The server's validation messages are written for the student, so they are shown as they are.
  if (e.code === 'ERROR' && e.message) return e.message
  switch (action) {
    case 'create': return 'The matrix could not be created. Try again.'
    case 'add': return 'The sources could not be added. Try again.'
    case 'upload': return 'The file could not be uploaded. Try again.'
    case 'extract': return 'Extraction could not be started. Nothing was charged. Try again.'
    case 'save': return 'Your change was not saved. Try again.'
    case 'delete': return 'This was not deleted. Try again.'
    case 'export': return 'The export could not be made. Try again.'
    // Only blame the connection when no response came back at all.
    default: return status
      ? 'This could not be loaded because of a problem on our side. Try again in a moment.'
      : 'This could not be loaded. Check your connection and try again.'
  }
}

export const isFeatureOff = (e: unknown) => (e as Failure)?.response?.status === 404
export const isNotFound = (e: unknown) => isFeatureOff(e) || ((e as Failure)?.message ?? '').toLowerCase().includes('not found')
