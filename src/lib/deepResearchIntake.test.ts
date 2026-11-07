import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEPTH, DEPTH_ORDER, DEPTH_TIERS, depthCost, detectIntent, hasUnfilledTemplate, isNormativeQuestion,
  rewriteNormative, startLabel, suggestQuestions,
} from './deepResearchIntake'
import { DEEP_RESEARCH_MODES, isQuestionValid } from './deepResearch'

describe('depth → cost mapping', () => {
  it('has a tier for every id, getting dearer and slower as it gets deeper', () => {
    const tiers = DEPTH_ORDER.map(id => depthCost(id))
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].credits).toBeGreaterThan(tiers[i - 1].credits)
      expect(tiers[i].minutes).toBeGreaterThan(tiers[i - 1].minutes)
    }
  })
  it('never charges a floor above what is reserved', () => {
    for (const id of DEPTH_ORDER) expect(DEPTH_TIERS[id].minCharged).toBeLessThanOrEqual(DEPTH_TIERS[id].credits)
  })
  it('puts the cost and time on the button, and follows the depth', () => {
    expect(startLabel('summary')).toBe(`Start research · ${DEPTH_TIERS.summary.credits} credits · ~${DEPTH_TIERS.summary.minutes} min`)
    expect(startLabel('deep')).not.toBe(startLabel('summary'))
    expect(DEPTH_TIERS[DEFAULT_DEPTH]).toBeDefined()
  })
})

describe('detectIntent', () => {
  const cases: [string, string][] = [
    ['Does learning management system usability influence student satisfaction?', 'RelationshipInvestigation'],
    ['What is the impact of remote work on productivity in Kenya?', 'RelationshipInvestigation'],
    ['Which theories explain technology adoption among students?', 'TheoreticalFramework'],
    ['Which validated scales measure attitudes towards generative AI?', 'MeasurementInstrument'],
    ['What evidence disagrees that social media lowers grades?', 'ContradictoryEvidence'],
    ['Is AI-assisted feedback under-researched in African universities?', 'ResearchGapInvestigation'],
    ['What evidence supports purposive sampling for lecturer interviews?', 'MethodologyEvidence'],
    ['Is there evidence that retrieval practice improves retention?', 'EvidenceForClaim'],
    ['What do we know about digital learning in rural schools?', 'TopicExploration'],
  ]
  it.each(cases)('%s → %s', (q, mode) => expect(detectIntent(q)).toBe(mode))

  it('says nothing for a short or unrecognisable question', () => {
    expect(detectIntent('AI')).toBeNull()
    expect(detectIntent('   ')).toBeNull()
    expect(detectIntent('Generative tools and universities')).toBeNull()
  })
  it('only ever returns a mode the server knows', () => {
    const known = new Set(DEEP_RESEARCH_MODES.map(m => m.value))
    for (const [q] of cases) expect(known.has(detectIntent(q)!)).toBe(true)
  })
})

describe('normative-question guard', () => {
  it.each([
    'Should universities ban generative AI in student assessment?',
    'Is it right to use AI detectors on student work?',
    'Is it ethical to track students online?',
    'Ought schools to teach coding?',
  ])('flags %s', q => expect(isNormativeQuestion(q)).toBe(true))

  it.each([
    'Does retrieval practice improve long-term retention?',
    'What factors influence digital learning adoption?',
    'Is there evidence that homework improves results?',
  ])('leaves %s alone', q => expect(isNormativeQuestion(q)).toBe(false))

  it('rewrites into a question the literature can answer, and the rewrite is no longer normative', () => {
    const a = rewriteNormative('Should universities ban generative AI in student assessment?')
    expect(a).toBe('What does the evidence say about whether universities ban generative AI in student assessment?')
    const b = rewriteNormative('Is it right to use AI detectors on student work?')
    expect(b).toBe('What does the evidence say about whether to use AI detectors on student work?')
    expect(isNormativeQuestion(a)).toBe(false)
    expect(isQuestionValid(b)).toBe(true)
  })
})

describe('templates', () => {
  it('treats an unfilled slot as not yet a question', () => {
    expect(hasUnfilledTemplate('Does ___ influence ___ in ___?')).toBe(true)
    expect(isQuestionValid('Does ___ influence ___ in ___?')).toBe(false)
    expect(isQuestionValid('Does sleep influence exam scores in first-year students?')).toBe(true)
  })
  it('gives every mode a placeholder and an editable template', () => {
    for (const m of DEEP_RESEARCH_MODES) {
      expect(m.placeholder.length).toBeGreaterThan(10)
      expect(hasUnfilledTemplate(m.template)).toBe(true)
    }
  })
})

describe('suggestQuestions', () => {
  it('reshapes a "correlation between" title into a relationship question', () => {
    const qs = suggestQuestions('The Correlation Between Generative AI Tool Use and Academic Performance')
    expect(qs[0]).toBe('Does generative AI tool use influence academic performance?')
    expect(qs.length).toBeLessThanOrEqual(3)
  })
  it('falls back to topic questions, keeping acronyms', () => {
    const qs = suggestQuestions('Adoption of LMS in Rural Schools')
    expect(qs[0]).toBe('What does the literature say about adoption of LMS in rural schools?')
  })
  it('suggests nothing for an empty or placeholder title', () => {
    expect(suggestQuestions('')).toEqual([])
    expect(suggestQuestions('Hi')).toEqual([])
  })
  it('every suggestion is a valid question', () => {
    for (const q of suggestQuestions('Impact of Mobile Banking on Financial Inclusion in Uganda')) expect(isQuestionValid(q)).toBe(true)
  })
})
