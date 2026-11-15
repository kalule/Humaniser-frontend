// Feedback Tracker: types the server returns and the display rules that sit on top of them.
//
// The rule this file exists to keep: a green "looks addressed" is shown only when the server says it may be
// (`canShowAsAddressed`: the quoted evidence was found in the draft, no figures disagree, and the draft was not
// largely rewritten). A wrong green tick sends a student back to their supervisor with the problem still there, so
// every other "addressed" is shown as "check it yourself". The check never sets an item's status; the student does.

export type Verdict = 'addressed' | 'partial' | 'not_addressed' | 'cannot_tell'
export type ItemStatus = 'open' | 'in_progress' | 'addressed' | 'disputed'
export type DocumentType = 'Proposal' | 'Thesis' | 'Manuscript' | 'LiteratureReview' | 'Other'

export interface NumberWarning {
  quantity: string
  values: { value: string; occurrences: number; sections: string[] }[]
}

export interface FeedbackCheck {
  draftVersion: number
  verdict: Verdict
  method: 'NotChanged' | 'Changes' | 'WholeDraft' | string
  lowConfidence: boolean
  evidenceQuote: string | null
  quoteVerified: boolean
  missing: string | null
  rationale: string
  facts: string[]
  flags: string[]
  numberWarning: boolean
  canShowAsAddressed: boolean
  createdAt: string
}

export interface FeedbackItem {
  id: string
  ordinal: number
  sourceSpan: string
  actionText: string
  category: string
  draftAnchor: string | null
  status: ItemStatus
  studentNote: string | null
  latestCheck: FeedbackCheck | null
}

export interface FeedbackDraft {
  id: string
  version: number
  source: string
  fileName: string | null
  charCount: number
  checkMethod: 'None' | 'NotChanged' | 'Changes' | 'WholeDraft' | string
  changedFraction: number | null
  numberWarnings: NumberWarning[]
  createdAt: string
}

export interface FeedbackThread {
  id: string
  title: string
  documentType: string
  itemCount: number
  addressedCount: number
  items: FeedbackItem[]
  drafts: FeedbackDraft[]
  createdAt: string
  updatedAt: string
  purgeAfter: string
  retentionDays: number
}

export interface FeedbackThreadSummary {
  id: string
  title: string
  documentType: string
  itemCount: number
  addressedCount: number
  draftCount: number
  createdAt: string
  updatedAt: string
  purgeAfter: string
}

/** Prices are set on the server (CreditCosts.FeedbackExtraction / FeedbackRecheck); these are for the labels only. */
export const EXTRACTION_CREDITS = 3
export const RECHECK_CREDITS = 5
/** The server's own limits (FeedbackTracker:MaxCommentsChars / MaxDraftChars / MinDraftChars). Checked here so the student hears before waiting. */
export const MAX_COMMENTS_CHARS = 30_000
export const MAX_DRAFT_CHARS = 400_000
export const MIN_DRAFT_CHARS = 200
export const MIN_COMMENTS_CHARS = 20

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'Proposal', label: 'Research proposal' },
  { value: 'Thesis', label: 'Thesis or dissertation chapter' },
  { value: 'Manuscript', label: 'Journal manuscript' },
  { value: 'LiteratureReview', label: 'Literature review' },
  { value: 'Other', label: 'Other' },
]

export const STATUS_LABELS: Record<ItemStatus, string> = {
  open: 'To do',
  in_progress: 'In progress',
  addressed: 'Done',
  disputed: 'Will discuss with supervisor',
}

export type CheckTone = 'green' | 'amber' | 'red' | 'grey'
export interface CheckDisplay {
  tone: CheckTone
  label: string
  /** Reasons the result should not be taken at face value, in plain words. */
  cautions: string[]
}

export function checkDisplay(check: FeedbackCheck | null): CheckDisplay {
  if (!check) return { tone: 'grey', label: 'Not checked yet', cautions: [] }

  const cautions: string[] = []
  if (check.numberWarning) cautions.push('Figures for the same thing disagree in different parts of this draft.')
  if (check.lowConfidence) cautions.push('Most of the draft was rewritten, so this check is less reliable than usual.')
  if (check.verdict === 'addressed' && !check.quoteVerified && !check.flags.includes('removal_verified_by_search'))
    cautions.push('The passage quoted as evidence could not be found in your draft.')
  if (check.flags.includes('reworded_not_removed')) cautions.push('The comment asks for something to be removed; it was reworded, not removed.')
  if (check.flags.includes('removal_not_done')) cautions.push('The comment asks for something to be removed and it is still in the draft.')
  // A comment that asks for better writing has nothing a check can verify: a reworded sentence exists, but whether it
  // is better is for the student and the supervisor. The server never returns "addressed" for it.
  const wording = check.flags.includes('wording_judgement')
  if (wording) cautions.push('This comment asks for better wording. The passage was rewritten; whether it now reads better is for you and your supervisor to judge.')

  switch (check.verdict) {
    case 'addressed':
      // Green needs the server's say-so and nothing else to warn about. Anything short of that is amber.
      return check.canShowAsAddressed && cautions.length === 0
        ? { tone: 'green', label: 'Looks addressed', cautions }
        : { tone: 'amber', label: 'Possibly addressed: check it yourself', cautions }
    case 'partial':
      return { tone: 'amber', label: 'Partly addressed', cautions }
    case 'not_addressed':
      return { tone: 'red', label: check.method === 'NotChanged' ? 'No change found' : 'Not addressed', cautions }
    default:
      return { tone: 'grey', label: wording ? 'Reworded: judge it yourself' : 'Cannot tell', cautions }
  }
}

export interface Progress {
  total: number
  done: number
  inProgress: number
  disputed: number
  todo: number
  /** Items the student marked done although the latest check does not show a clean "addressed". */
  doneButUnconfirmed: number
}

export function progress(items: FeedbackItem[]): Progress {
  const count = (s: ItemStatus) => items.filter(i => i.status === s).length
  return {
    total: items.length,
    done: count('addressed'),
    inProgress: count('in_progress'),
    disputed: count('disputed'),
    todo: count('open'),
    doneButUnconfirmed: items.filter(i => i.status === 'addressed' && i.latestCheck !== null && checkDisplay(i.latestCheck).tone !== 'green').length,
  }
}

export type ItemFilter = 'all' | 'todo' | 'attention'

/** "Needs attention": not finished by the student's own mark, or marked done against what the check found. */
export function matchesFilter(item: FeedbackItem, filter: ItemFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'todo') return item.status === 'open' || item.status === 'in_progress'
  const tone = checkDisplay(item.latestCheck).tone
  return item.latestCheck !== null && (tone === 'red' || tone === 'amber') && item.status !== 'disputed'
}

export function describeDraftCheck(draft: FeedbackDraft): string {
  switch (draft.checkMethod) {
    case 'None': return 'First draft. Nothing to compare it with yet.'
    case 'NotChanged': return 'No change was found in the parts the comments are about.'
    case 'WholeDraft': return 'Most of the draft changed, so it was checked as a whole. Results are less reliable.'
    case 'Changes': {
      const pct = draft.changedFraction === null ? null : Math.max(1, Math.round(draft.changedFraction * 100))
      return pct === null ? 'Checked from the passages that changed.' : `Checked from the passages that changed (about ${pct}% of the draft).`
    }
    default: return ''
  }
}

/** Client-side input checks, mirroring the server's so the message arrives before any wait or charge. */
export function validateComments(text: string): string | null {
  const n = text.trim().length
  if (n < MIN_COMMENTS_CHARS) return "Paste your supervisor's comments."
  if (n > MAX_COMMENTS_CHARS) return `The comments are ${n.toLocaleString('en-GB')} characters and the limit is ${MAX_COMMENTS_CHARS.toLocaleString('en-GB')}. Split them into two checklists, for example one per chapter.`
  return null
}

export function validateDraftText(text: string): string | null {
  const n = text.trim().length
  if (n < MIN_DRAFT_CHARS) return `Paste the draft (at least ${MIN_DRAFT_CHARS} characters), or choose a file.`
  if (n > MAX_DRAFT_CHARS) return `The draft is ${n.toLocaleString('en-GB')} characters and the limit is ${MAX_DRAFT_CHARS.toLocaleString('en-GB')}. Use the chapter the comments are about, not the whole thesis.`
  return null
}

export const UPLOAD_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const
export function uploadKind(fileName: string): 'server' | 'text' | null {
  const name = fileName.toLowerCase()
  if (name.endsWith('.pdf') || name.endsWith('.docx')) return 'server'
  if (name.endsWith('.txt')) return 'text'
  return null
}

interface Failure { code?: string; message?: string; response?: { status?: number } }

/** One sentence the student can act on, for any failed tracker request. */
export function failureMessage(err: unknown, action: 'create' | 'recheck' | 'save' | 'load' | 'delete'): string {
  const e = (err ?? {}) as Failure
  const status = e.response?.status
  if (status === 402) return 'You do not have enough credits for this. Nothing was charged.'
  if (status === 429) return action === 'create'
    ? "You have reached today's limit for new checklists. Try again tomorrow."
    : 'You have checked several drafts in the last hour. Try again later.'
  if (status === 413) return 'That file is too large. Upload the chapter the comments are about, or paste the text.'
  // The server's own validation messages are written for the student, so they are shown as they are.
  if (e.code === 'ERROR' && e.message) return e.message
  if (status === 404) return 'This checklist no longer exists.'
  switch (action) {
    case 'create': return 'The checklist could not be created. Nothing was charged. Try again.'
    case 'recheck': return 'The draft could not be checked. Nothing was charged. Try again.'
    case 'save': return 'Your change was not saved. Try again.'
    case 'delete': return 'The checklist was not deleted. Try again.'
    default: return 'This could not be loaded. Check your connection and try again.'
  }
}
