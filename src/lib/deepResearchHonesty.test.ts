import { describe, expect, it } from 'vitest'
import type { EvidenceQuestion, EvidenceSource } from '../api/deepResearch'
import {
  answeredFromRatings, caveatReason, completionSummary, joinMeta, mergeSourceRows, qualityRollup, questionRows, questionTag, rateQuestion, relationshipTag,
  rollupText, segmentsFromRatings, stripSeparators,
} from './deepResearchView'
import { looksLikeStudyTitle, titleToQuestion } from './deepResearchIntake'
import { isQuestionValid } from './deepResearch'

const Q: EvidenceQuestion = { id: 'q1', type: 'Relationship', question: 'Does X influence Y among students in Gauteng?', status: 'Resolved', sufficiency: 'Sufficient', reasons: [] }
const src = (id: string, over: Partial<EvidenceSource> = {}): EvidenceSource => ({
  id, questionId: 'q1', title: `Paper ${id}`, authors: ['A'], year: 2024, journal: null, doi: '10.1/x', polarity: 'Supports', strength: 'Moderate',
  geography: 'Target', decision: 'Accepted', decidedBy: 'Humaniser', exclusionReason: null, quote: null, verification: 'Verified', foundVia: [], coverage: 'Abstract', ...over,
})
const rate = (rows: EvidenceSource[], q: EvidenceQuestion = Q) => rateQuestion(questionRows([q], mergeSourceRows(rows))[0])

describe('1. completion status never overclaims, and has a middle state', () => {
  const done = { status: 'Completed' as const, isFinished: true, completionNote: 'Every key question has enough evidence.' }

  it('says "Completed with gaps" with strongly / partly / not reached, never "0 of N answered"', () => {
    const s = completionSummary(done, { strong: 3, partial: 2, none: 1, total: 6 })
    expect(s.chip.label).toBe('Completed with gaps')
    expect(s.chip.tone).toBe('warning')
    expect(s.headline).toBe('3 strongly supported \u00b7 2 partly supported \u00b7 1 not reached')
    expect(s.note).not.toMatch(/every key question has enough evidence/i)
    expect(completionSummary(done, { strong: 0, partial: 6, none: 0, total: 6 }).headline).toBe('6 partly supported')
  })
  it('says "Complete" only when every question is strongly supported', () => {
    const s = completionSummary(done, { strong: 6, partial: 0, none: 0, total: 6 })
    expect(s.chip.label).toBe('Complete')
    expect(s.headline).toBe('All 6 questions strongly supported')
    expect(s.note).toBe('Every key question has enough evidence.')
  })
  it('never repeats the "every key question" claim on a stopped run that has gaps', () => {
    const s = completionSummary({ ...done, status: 'Stopped' }, { strong: 1, partial: 1, none: 1, total: 3 })
    expect(s.note).toBeNull()
    expect(s.chip.label).toBe('Stopped at limit')
  })
  it('the headline, the segments and the legend are one rollup', () => {
    const q = (id: string, sufficiency: string): EvidenceQuestion => ({ ...Q, id, sufficiency })
    const fullText = (id: string) => src(id, { coverage: 'FullText', studyDesign: 'Experimental' })
    const rows = questionRows([q('q1', 'Sufficient'), q('q2', 'Insufficient'), q('q3', 'Insufficient')],
      mergeSourceRows([fullText('a'), src('b'), src('c', { strength: 'Strong' }), src('d', { questionId: 'q2' })]))
    const ratings = rows.map(rateQuestion)
    const rollup = qualityRollup(ratings)
    expect(rollup).toEqual({ strong: 1, partial: 1, none: 1, total: 3 })
    expect(rollupText(rollup)).toBe('1 strongly supported \u00b7 1 partly supported \u00b7 1 not reached')
    const seg = segmentsFromRatings(ratings)
    expect(seg).toEqual(['done', 'partial', 'pending'])
    expect(seg.filter(x => x === 'done').length).toBe(rollup.strong)
    expect(seg.filter(x => x === 'partial').length).toBe(rollup.partial)
    expect(seg.filter(x => x === 'pending').length).toBe(rollup.none)
    expect(rollupText({ strong: 0, partial: 0, none: 2, total: 2 })).toBe('2 not reached')
  })
})

describe('2. the label comes from the number, quality and depth of accepted sources', () => {
  const full = (id: string) => src(id, { coverage: 'FullText', studyDesign: 'Experimental' })

  it('is "Well supported" only with 3+ sources, 2+ rated Moderate or better, and one read in full text', () => {
    const r = rate([full('a'), src('b'), src('c', { strength: 'Strong' })])
    expect(r.label).toBe('Well supported')
    expect(r.rank).toBe(3)
    expect(r.cap).toBeNull()
  })
  it('caps abstract-only sources below "Well supported", whatever their number or rating', () => {
    const r = rate([src('a', { strength: 'Strong' }), src('b', { strength: 'Strong' }), src('c', { strength: 'Strong' }), src('d', { strength: 'Strong' })])
    expect(r.label).toBe('Some support')
    expect(r.cap).toBe('Abstract-only sources')
    expect(r.reason).toMatch(/all abstract-only/)
  })
  it('caps sources rated Limited evidence: they give "Limited", not "Some support"', () => {
    const r = rate([full('a'), src('b', { strength: 'Weak' }), src('c', { strength: 'Weak' })].map(s => ({ ...s, strength: 'Weak' })))
    expect(r.label).toBe('Limited')
    expect(r.rank).toBe(1)
    expect(r.reason).toMatch(/none rated better than Limited evidence/)
  })
  it('caps a thin set: two good full-text sources are "Some support"', () => {
    const r = rate([full('a'), full('b')])
    expect(r.label).toBe('Some support')
    expect(r.reason).toMatch(/only 2 accepted sources \(3 needed\)/)
  })
  it('does not exceed what the research rules themselves concluded', () => {
    const r = rate([full('a'), full('b'), full('c')], { ...Q, sufficiency: 'PartiallySufficient' })
    expect(r.label).toBe('Some support')
    expect(r.reason).toMatch(/research rules still list it/)
  })
  it('gives a tooltip reason for a question with nothing accepted, and never calls it supported', () => {
    const r = rate([src('a', { decision: 'Rejected' })], { ...Q, sufficiency: 'Insufficient' })
    expect(r.rank).toBe(0)
    expect(r.label).toBe('Found, none relevant')
    expect(r.reason).toMatch(/none was accepted/)
  })
  it('keeps the headline count and the labels in agreement', () => {
    const rows = questionRows([Q, { ...Q, id: 'q2' }], mergeSourceRows([full('a'), src('b'), src('c'), src('d', { questionId: 'q2' })]))
    const ratings = rows.map(rateQuestion)
    expect(ratings.map(r => r.label)).toEqual(['Well supported', 'Some support'])
    expect(answeredFromRatings(ratings)).toBe(ratings.filter(r => r.label === 'Well supported').length)
    expect(segmentsFromRatings(ratings)).toEqual(ratings.map(r => (r.rank === 3 ? 'done' : 'partial')))
  })
})

describe('3. findings formatting', () => {
  it('removes stray separators at either end and never leaves a dangling dot', () => {
    expect(stripSeparators(' · Target')).toBe('Target')
    expect(stripSeparators('Limited evidence ·')).toBe('Limited evidence')
    expect(stripSeparators('— note;')).toBe('note')
    expect(joinMeta('Moderate evidence', '')).toBe('Moderate evidence')
    expect(joinMeta('', ' · From your study region')).toBe('From your study region')
    expect(joinMeta('Moderate evidence', 'Target')).toBe('Moderate evidence · Target')
    expect(joinMeta(null, undefined, '')).toBe('')
  })
  it('names a question by number and kind instead of repeating its whole text', () => {
    const qs = [{ ...Q, id: 'a', type: 'Definition', question: 'How is generative AI tool usage defined and measured in the academic literature?' }, Q]
    expect(questionTag('a', qs)).toEqual({ label: 'Q1 · Definition', hint: qs[0].question })
    expect(questionTag('q1', qs)?.label).toBe('Q2 · Relationship')
    expect(questionTag('gone', qs)).toBeNull()
    const rel = relationshipTag({ polarity: 'Background', questionId: 'a' }, qs)
    expect(rel.label).toBe('Background for Q1 · Definition')
    expect(rel.label).not.toContain('generative AI')
    expect(rel.hint).toBe(qs[0].question)
  })
})

describe('4. a colour always comes with a reason', () => {
  it.each([
    ['Evidence is from outside the target region.', 'Region mismatch'],
    ['The study took place in another country, not from South Africa; international sample.', 'Region mismatch'],
    ['Based on a single small study.', 'Weak support'],
    ['Only the abstract was read.', 'Weak support'],
    ['Findings are mixed results across studies.', 'Conflicting'],
  ])('%s → %s', (text, tag) => expect(caveatReason(text)?.tag).toBe(tag))

  it('gives no reason, and so no colour, to a note it cannot explain', () => {
    expect(caveatReason('Published in 2024.')).toBeNull()
    expect(caveatReason('')).toBeNull()
  })
})

describe('7. a study title is offered a one-click rewrite into a question', () => {
  const title = 'Does generative AI tool usage influence academic writing Self-Efficacy among postgraduate students at selected public universities in gauteng: a Cross-Sectional survey?'

  it('recognises titles', () => {
    expect(looksLikeStudyTitle(title)).toBe(true)
    expect(looksLikeStudyTitle('Generative AI and Self-Efficacy among Postgraduate Students: A Systematic Review')).toBe(true)
    expect(looksLikeStudyTitle('The Effect of Sleep on Exam Scores: Evidence from First-Year Students in Kenya')).toBe(true)
    expect(looksLikeStudyTitle('Mobile banking adoption among rural farmers in Uganda, a mixed-methods study')).toBe(true)
    expect(looksLikeStudyTitle('Perceptions of lecturers towards AI in a systematic review')).toBe(true)
  })
  it('leaves real questions alone', () => {
    expect(looksLikeStudyTitle('Does retrieval practice improve long-term retention in higher education?')).toBe(false)
    expect(looksLikeStudyTitle('What factors influence digital learning adoption among university students in South Africa?')).toBe(false)
    expect(looksLikeStudyTitle('Is there a survey of AI use among students?')).toBe(false)
    expect(looksLikeStudyTitle('Short title: study')).toBe(false)
    expect(looksLikeStudyTitle('')).toBe(false)
  })
  it('rewrites using the student’s own words: subtitle and design phrase dropped, topic and region kept', () => {
    const q = titleToQuestion(title)
    expect(q).toBe('Does generative AI tool usage influence academic writing Self-Efficacy among postgraduate students at selected public universities in gauteng?')
    expect(q).not.toMatch(/cross-sectional|survey/i)
    expect(looksLikeStudyTitle(q)).toBe(false)
    expect(isQuestionValid(q)).toBe(true)
  })
  it('turns a noun-phrase title into a question without losing its topic or region', () => {
    const q = titleToQuestion('The Impact of Mobile Banking on Financial Inclusion in Uganda: A Systematic Review')
    expect(q).toBe('Does mobile banking influence financial inclusion in Uganda?')
    expect(isQuestionValid(q)).toBe(true)
    expect(titleToQuestion('Generative AI and Self-Efficacy among Postgraduate Students: A Systematic Review')).toMatch(/generative AI and self-efficacy among postgraduate students/i)
  })
})
