import { describe, expect, it } from 'vitest'
import {
  MAX_COMMENTS_CHARS, MAX_DRAFT_CHARS, checkDisplay, describeDraftCheck, failureMessage, matchesFilter, progress, uploadKind,
  validateComments, validateDraftText, type FeedbackCheck, type FeedbackDraft, type FeedbackItem,
} from './feedbackTracker'
import { LAUNCH_TOOLS, isToolEnabled } from '../config/features'
import { NAV_SECTIONS, TOOLS, resolvePageTitle, toolForPath } from '../config/navigation'

const check = (patch: Partial<FeedbackCheck> = {}): FeedbackCheck => ({
  draftVersion: 2, verdict: 'addressed', method: 'Changes', lowConfidence: false, evidenceQuote: 'Purposive sampling will be used.',
  quoteVerified: true, missing: null, rationale: 'The strategy is now named.', facts: [], flags: [], numberWarning: false,
  canShowAsAddressed: true, createdAt: '2026-11-14T10:00:00Z', ...patch,
})
const item = (patch: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id: 'i1', ordinal: 1, sourceSpan: 'Name the sampling strategy.', actionText: 'Name the sampling strategy', category: 'methodology',
  draftAnchor: null, status: 'open', studentNote: null, latestCheck: null, ...patch,
})

describe('checkDisplay: the green tick', () => {
  it('is green only when the server allows it', () => {
    expect(checkDisplay(check())).toMatchObject({ tone: 'green', label: 'Looks addressed', cautions: [] })
  })

  it('never shows green when the server withholds it, whatever the verdict says', () => {
    expect(checkDisplay(check({ canShowAsAddressed: false })).tone).toBe('amber')
  })

  it.each([
    ['figures disagree', { numberWarning: true }, /Figures/],
    ['the draft was largely rewritten', { lowConfidence: true }, /rewritten/],
    ['the quote is not in the draft', { quoteVerified: false }, /could not be found/],
    ['a removal was only a rewording', { flags: ['reworded_not_removed'] }, /reworded, not removed/],
  ] as const)('is not green when %s, even if canShowAsAddressed were wrongly true', (_name, patch, caution) => {
    const d = checkDisplay(check({ ...patch, canShowAsAddressed: true } as Partial<FeedbackCheck>))
    expect(d.tone).toBe('amber')
    expect(d.label).toBe('Possibly addressed: check it yourself')
    expect(d.cautions.some(c => caution.test(c))).toBe(true)
  })

  it('does not call a removal proved by search an unverified quote', () => {
    const d = checkDisplay(check({ quoteVerified: false, evidenceQuote: null, flags: ['removal_verified_by_search'], canShowAsAddressed: false }))
    expect(d.tone).toBe('amber')
    expect(d.cautions).toEqual([])
  })

  it('maps the other verdicts', () => {
    expect(checkDisplay(null)).toMatchObject({ tone: 'grey', label: 'Not checked yet' })
    expect(checkDisplay(check({ verdict: 'partial', canShowAsAddressed: false }))).toMatchObject({ tone: 'amber', label: 'Partly addressed' })
    expect(checkDisplay(check({ verdict: 'not_addressed', canShowAsAddressed: false }))).toMatchObject({ tone: 'red', label: 'Not addressed' })
    expect(checkDisplay(check({ verdict: 'not_addressed', method: 'NotChanged', canShowAsAddressed: false })).label).toBe('No change found')
    expect(checkDisplay(check({ verdict: 'cannot_tell', canShowAsAddressed: false }))).toMatchObject({ tone: 'grey', label: 'Cannot tell' })
  })

  it('keeps the figures caution on any verdict', () => {
    expect(checkDisplay(check({ verdict: 'not_addressed', numberWarning: true, canShowAsAddressed: false })).cautions).toHaveLength(1)
  })
})

describe('progress and filters', () => {
  const items = [
    item({ id: 'a', status: 'addressed', latestCheck: check() }),
    item({ id: 'b', status: 'addressed', latestCheck: check({ verdict: 'not_addressed', canShowAsAddressed: false }) }),
    item({ id: 'c', status: 'addressed' }),
    item({ id: 'd', status: 'in_progress', latestCheck: check({ verdict: 'partial', canShowAsAddressed: false }) }),
    item({ id: 'e', status: 'disputed', latestCheck: check({ verdict: 'not_addressed', canShowAsAddressed: false }) }),
    item({ id: 'f' }),
  ]

  it('counts the student\'s own marks, and flags a "done" the check did not confirm', () => {
    expect(progress(items)).toEqual({ total: 6, done: 3, inProgress: 1, disputed: 1, todo: 1, doneButUnconfirmed: 1 })
  })

  it('does not count a model verdict as done', () => {
    expect(progress([item({ latestCheck: check() })]).done).toBe(0)
  })

  it('filters', () => {
    const ids = (f: Parameters<typeof matchesFilter>[1]) => items.filter(i => matchesFilter(i, f)).map(i => i.id)
    expect(ids('all')).toHaveLength(6)
    expect(ids('todo')).toEqual(['d', 'f'])
    // A problem the student has chosen to discuss with the supervisor is not nagged about again.
    expect(ids('attention')).toEqual(['b', 'd'])
  })
})

describe('describeDraftCheck', () => {
  const draft = (patch: Partial<FeedbackDraft>): FeedbackDraft => ({
    id: 'd', version: 2, source: 'PastedText', fileName: null, charCount: 1000, checkMethod: 'Changes', changedFraction: 0.123, numberWarnings: [], createdAt: '', ...patch,
  })
  it('says how each version was checked', () => {
    expect(describeDraftCheck(draft({ checkMethod: 'None', version: 1 }))).toMatch(/First draft/)
    expect(describeDraftCheck(draft({}))).toMatch(/about 12% of the draft/)
    expect(describeDraftCheck(draft({ changedFraction: 0.001 }))).toMatch(/about 1%/)
    expect(describeDraftCheck(draft({ checkMethod: 'WholeDraft' }))).toMatch(/less reliable/)
    expect(describeDraftCheck(draft({ checkMethod: 'NotChanged' }))).toMatch(/No change/)
  })
})

describe('input checks', () => {
  it('refuses empty and oversized comments with the limit in the message', () => {
    expect(validateComments('  ')).toMatch(/Paste/)
    expect(validateComments('Fix the typo in section 2 please.')).toBeNull()
    expect(validateComments('x'.repeat(MAX_COMMENTS_CHARS + 1))).toMatch(/30,000/)
  })
  it('refuses a short or oversized draft', () => {
    expect(validateDraftText('too short')).toMatch(/at least 200/)
    expect(validateDraftText('x'.repeat(200))).toBeNull()
    expect(validateDraftText('x'.repeat(MAX_DRAFT_CHARS + 1))).toMatch(/400,000/)
  })
  it('sends PDF and Word to the server and reads .txt in the browser', () => {
    expect(uploadKind('Chapter 3.PDF')).toBe('server')
    expect(uploadKind('draft.docx')).toBe('server')
    expect(uploadKind('notes.txt')).toBe('text')
    expect(uploadKind('draft.doc')).toBeNull()
    expect(uploadKind('draft.odt')).toBeNull()
  })
})

describe('failureMessage', () => {
  it('says nothing was charged when credits ran out', () => {
    expect(failureMessage({ response: { status: 402 } }, 'recheck')).toMatch(/Nothing was charged/)
  })
  it('explains each rate limit', () => {
    expect(failureMessage({ response: { status: 429 } }, 'create')).toMatch(/tomorrow/)
    expect(failureMessage({ response: { status: 429 } }, 'recheck')).toMatch(/last hour/)
  })
  it("shows the server's own validation message", () => {
    expect(failureMessage({ code: 'ERROR', message: 'This draft is identical to version 1. Upload the revised version.' }, 'recheck')).toMatch(/identical to version 1/)
  })
  it('falls back to a sentence per action', () => {
    expect(failureMessage(new Error('Network Error'), 'create')).toMatch(/could not be created/)
    expect(failureMessage(undefined, 'load')).toMatch(/could not be loaded/)
  })
})

describe('Feedback Tracker in the navigation', () => {
  it('has one entry, in Verify after Reviewer, hidden at launch', () => {
    expect(NAV_SECTIONS.find(s => s.section === 'Verify')?.items.map(t => t.id).slice(-2)).toEqual(['reviewer', 'feedback-tracker'])
    expect(NAV_SECTIONS.flatMap(s => s.items).filter(t => t.id === 'feedback-tracker')).toHaveLength(1)
    expect(LAUNCH_TOOLS.has('feedback-tracker')).toBe(false)
    expect(isToolEnabled('feedback-tracker', true)).toBe(true)
  })
  it('owns its own paths and does not take Reviewer\'s', () => {
    expect(toolForPath('/app/feedback-tracker')?.id).toBe('feedback-tracker')
    expect(toolForPath('/app/feedback-tracker/3f2b')?.id).toBe('feedback-tracker')
    expect(toolForPath('/app/reviewer')?.id).toBe('reviewer')
    expect(resolvePageTitle('/app/feedback-tracker/3f2b')).toBe('Feedback Tracker')
    expect(TOOLS['feedback-tracker'].link).toBe('/app/feedback-tracker')
  })
})
