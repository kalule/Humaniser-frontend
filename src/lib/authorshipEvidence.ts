// Authorship Evidence: the shapes the server returns and the few display rules that sit on top of them.
//
// Rules this file keeps for every screen:
//   - every piece of evidence is shown with where it came from (LABELS); "Not available" is shown where nothing
//     was recorded, and it is never worded as a finding about the student;
//   - nothing here scores, rates or judges the student or the text;
//   - a report can be created only after the student has ticked that the declaration is accurate.

export type EvidenceLabel = 'Verified' | 'Imported' | 'UserSupplied'
export type DeclarationCategory = 'NoAi' | 'Limited' | 'Research' | 'Drafting' | 'Extensive'
export type Outcome = 'Accepted' | 'Modified' | 'Rejected' | 'NotRecorded'

export const LABELS: Record<EvidenceLabel, { text: string; hint: string; tone: string }> = {
  Verified: { text: 'Verified by platform', hint: 'HumaniseAI observed this itself.', tone: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  Imported: { text: 'Imported', hint: 'You brought this in from outside. HumaniseAI did not observe how it was written.', tone: 'border-sky-300 bg-sky-50 text-sky-900' },
  UserSupplied: { text: 'User supplied', hint: 'You entered this yourself. HumaniseAI did not observe it.', tone: 'border-amber-300 bg-amber-50 text-amber-900' },
}
export const NOT_AVAILABLE = { text: 'Not available', hint: 'Nothing was recorded. This is not a finding about your work.', tone: 'border-slate-300 bg-slate-100 text-slate-800' }

export const CATEGORIES: { value: DeclarationCategory; label: string; description: string }[] = [
  { value: 'NoAi', label: 'No AI assistance', description: 'You did not use generative AI tools for this work. This is your own statement; the platform cannot confirm it.' },
  { value: 'Limited', label: 'Limited assistance', description: 'Language checking or feedback only, for example a grammar checker.' },
  { value: 'Research', label: 'Research assistance', description: 'Help finding, summarising or understanding sources.' },
  { value: 'Drafting', label: 'AI-assisted drafting', description: 'AI helped draft or reword parts of the text, which you then reviewed.' },
  { value: 'Extensive', label: 'Extensive assistance', description: 'AI was used throughout, including for substantial parts of the text.' },
]
export const categoryLabel = (c: string) => CATEGORIES.find(x => x.value === c)?.label ?? c

export const ASSISTANCE_TYPES: { value: string; label: string }[] = [
  { value: 'Grammar', label: 'Grammar and style' },
  { value: 'Paraphrase', label: 'Paraphrasing' },
  { value: 'Rewrite', label: 'Rewording' },
  { value: 'Summary', label: 'Summarising' },
  { value: 'Drafting', label: 'Drafting text' },
  { value: 'Feedback', label: 'Feedback on a draft' },
  { value: 'Check', label: 'Checking the text' },
  { value: 'Research', label: 'Research' },
  { value: 'Other', label: 'Other' },
]
export const assistanceLabel = (t: string) => ASSISTANCE_TYPES.find(x => x.value === t)?.label ?? t

export const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'NotRecorded', label: 'Not recorded' },
  { value: 'Accepted', label: 'Accepted as it was' },
  { value: 'Modified', label: 'Changed by me' },
  { value: 'Rejected', label: 'Rejected' },
]
export const outcomeLabel = (o: string) => OUTCOMES.find(x => x.value === o)?.label ?? o

export const SOURCES: Record<string, string> = { Student: 'Student', Application: 'Application', AiAssisted: 'AI-assisted operation' }

export const EVENT_TITLES: Record<string, string> = {
  RecordingStarted: 'Recording began',
  DocumentCreated: 'Document created',
  DocumentImported: 'Document imported',
  Checkpoint: 'Edits saved',
  LargeInsertion: 'Large insertion',
  VersionSaved: 'Version kept',
  DraftImported: 'Earlier draft imported',
  ToolUsed: 'AI tool used',
  RecordingPaused: 'Recording switched off',
  RecordingResumed: 'Recording switched on',
}

export const VERSION_REASONS: Record<string, string> = {
  RecordingStart: 'When recording began',
  Created: 'When the document was created',
  SessionStart: 'Start of an edit session',
  BeforeAiTool: 'Before an AI tool',
  AfterAiTool: 'After an AI tool',
  Manual: 'Kept by you',
  ImportedDraft: 'Imported draft',
}

export const STATUS: Record<string, { text: string; tone: string }> = {
  Recording: { text: 'Recording', tone: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  Paused: { text: 'Recording off', tone: 'border-amber-300 bg-amber-50 text-amber-900' },
  NotRecording: { text: 'No history recorded', tone: 'border-slate-300 bg-slate-100 text-slate-800' },
}

export interface Settings {
  recordingAccepted: boolean
  recordingAcceptedAt: string | null
  keepFullText: boolean
  retentionDays: number
  fullTextRetentionDays: number
  reportCredits: number
  wordingCredits: number
  whatIsRecorded: string[]
  whatIsNotRecorded: string[]
}

export interface DocumentSummary {
  documentId: string
  title: string
  status: 'NotRecording' | 'Recording' | 'Paused'
  origin: string | null
  recordingStartedAt: string | null
  eventCount: number
  versionCount: number
  aiUseCount: number
  declarationStatus: 'None' | 'Draft' | 'Confirmed'
  reportCount: number
  documentUpdatedAt: string
  purgeAfter: string | null
}

export interface TimelineEvent {
  id: string
  sequence: number
  occurredAt: string
  type: string
  source: string
  evidenceLabel: EvidenceLabel
  description: string
  versionNumber: number | null
  wordCount: number | null
  charsAdded: number | null
  charsRemoved: number | null
  periodStart: string | null
  saves: number | null
  citationsAdded: number | null
  citationsRemoved: number | null
  tool: string | null
  usageEntryId: string | null
  fileName: string | null
}

export interface EditSession { number: number; startedAt: string; endedAt: string; saves: number; charsAdded: number; charsRemoved: number; wordCountAtEnd: number | null }

export interface Version {
  id: string
  versionNumber: number
  createdAt: string
  reason: string
  evidenceLabel: EvidenceLabel
  wordCount: number
  charCount: number
  fileName: string | null
  declaredDate: string | null
}

export interface VersionContent { version: Version; text: string }
export interface VersionComparison {
  from: Version
  to: Version
  changes: { before: string; after: string }[]
  changedFraction: number
  tooLargeToCompare: boolean
  wordsBefore: number
  wordsAfter: number
}

export interface UsageEntry {
  id: string
  documentId: string | null
  documentTitle: string | null
  occurredAt: string
  tool: string
  assistanceType: string
  section: string | null
  wordsAffected: number
  inputChars: number
  outputChars: number
  outcome: Outcome
  outcomeLabel: EvidenceLabel | null
  evidenceLabel: EvidenceLabel
  linkLabel: EvidenceLabel | null
  correctsEntryId: string | null
  corrected: boolean
  note: string | null
  hasFullText: boolean
  fullTextPurgeAfter: string | null
}

export interface EvidenceArea { key: string; title: string; recorded: string[]; missing: string[] }
export interface ChainCheck { intact: boolean; brokenAtSequence: number | null; eventCount: number; headHash: string }

export interface Declaration {
  id: string
  category: DeclarationCategory
  text: string
  templateKey: string | null
  draftOrigin: string
  confirmed: boolean
  accuracyConfirmedAt: string | null
  updatedAt: string
  warnings: string[]
}

export interface DeclarationDraft {
  suggestedCategory: DeclarationCategory | null
  suggestionReason: string | null
  category: DeclarationCategory
  text: string
  statements: { text: string; evidenceIds: string[] }[]
  warnings: string[]
  draftOrigin: string
  recordedUses: number
}

export interface DeclarationTemplate { id: string | null; key: string; name: string; institution: string | null; category: string | null; body: string; builtIn: boolean }

export interface ReportSummary { id: string; documentId: string; documentTitle: string; reportNumber: string; generatedAt: string; eventCount: number }

export interface EvidenceDocument {
  documentId: string
  title: string
  status: 'NotRecording' | 'Recording' | 'Paused'
  origin: string | null
  originFileName: string | null
  documentCreatedAt: string
  recordingStartedAt: string | null
  timeline: TimelineEvent[]
  sessions: EditSession[]
  versions: Version[]
  register: UsageEntry[]
  areas: EvidenceArea[]
  limitations: string[]
  chain: ChainCheck | null
  declaration: Declaration | null
  reports: ReportSummary[]
  purgeAfter: string | null
}

export interface ReportContent {
  studentName: string
  studentEmail: string
  documentTitle: string
  origin: string
  originFileName: string | null
  documentCreatedAt: string
  recordingStartedAt: string
  timeline: TimelineEvent[]
  sessions: EditSession[]
  versions: Version[]
  register: UsageEntry[]
  usageSummary: { tool: string; assistanceType: string; uses: number; wordsAffected: number; first: string; last: string; evidenceLabel: EvidenceLabel }[]
  revisionActivity: { sessions: number; saves: number; charsAdded: number; charsRemoved: number; versions: number; largeInsertions: number; firstWordCount: number | null; lastWordCount: number | null }
  areas: EvidenceArea[]
  declarationCategory: string
  declarationText: string
  declarationConfirmedAt: string
  declarationNotes: string[]
  limitations: string[]
  chain: ChainCheck
}

export interface Report { id: string | null; documentId: string; reportNumber: string | null; generatedAt: string | null; content: ReportContent; canGenerate: boolean; blockedReason: string | null }

export const ORIGINS: Record<string, string> = {
  Created: 'Created in HumaniseAI while recording was on',
  Imported: 'Created from an imported file',
  Existing: 'Existed before recording began',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const two = (n: number) => String(n).padStart(2, '0')
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}`
}
export const n = (value: number) => value.toLocaleString('en-GB')
export const plural = (count: number, one: string, many = one + 's') => `${n(count)} ${count === 1 ? one : many}`

interface Failure { code?: string; message?: string; response?: { status?: number } }
export const httpStatus = (err: unknown) => (err as Failure)?.response?.status

/** One sentence the student can act on, for any failed request. The server's own validation messages are shown as they are. */
export function failureMessage(err: unknown, action: 'load' | 'save' | 'delete' | 'report' | 'import'): string {
  const e = (err ?? {}) as Failure
  const status = e.response?.status
  if (status === 402) return 'You do not have enough credits for this. Nothing was charged.'
  if (status === 429) return "You have reached today's limit for new reports. Try again tomorrow."
  if (status === 413) return 'That file is too large. Paste the text instead, or use a smaller file.'
  if (e.code === 'ERROR' && e.message) return e.message
  if (status === 404) return 'This no longer exists.'
  switch (action) {
    case 'save': return 'Your change was not saved. Try again.'
    case 'delete': return 'Nothing was deleted. Try again.'
    case 'report': return 'The report could not be created. Nothing was charged. Try again.'
    case 'import': return 'The draft could not be imported. Try again, or paste the text.'
    default: return 'This could not be loaded. Check your connection and try again.'
  }
}

/**
 * The moment sent for a use the student dates by day only: midday UTC on that day, or now if midday has not come yet.
 * Midday keeps the day the student picked in every time zone; "now" stops a same-day entry made in the morning (UTC)
 * from being refused as a date in the future.
 */
export function usageInstant(day: string, now: Date = new Date()): string {
  const midday = new Date(`${day}T12:00:00Z`)
  return (midday.getTime() > now.getTime() ? now : midday).toISOString()
}
