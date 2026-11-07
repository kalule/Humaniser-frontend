import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEPTH, DEPTH_ORDER, DEPTH_TIERS, depthCost, detectIntent, hasUnfilledTemplate, isNormativeQuestion,
  guessIntent, rewriteNormative, startLabel, suggestQuestions,
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
  // [question, label shown (null = no label), why]
  const cases: [string, string | null][] = [
    // clear
    ['Does learning management system usability influence student satisfaction?', 'RelationshipInvestigation'],
    ['What is the impact of remote work on productivity in Kenya?', 'RelationshipInvestigation'],
    ['Which theories explain technology adoption among students?', 'TheoreticalFramework'],
    ['Which validated scales measure attitudes towards generative AI?', 'MeasurementInstrument'],
    ['What evidence disagrees that social media lowers grades?', 'ContradictoryEvidence'],
    ['Is AI-assisted feedback under-researched in African universities?', 'ResearchGapInvestigation'],
    ['What evidence supports purposive sampling for lecturer interviews?', 'MethodologyEvidence'],
    ['Is there evidence that retrieval practice improves retention?', 'EvidenceForClaim'],
    ['What do we know about digital learning in rural schools?', 'TopicExploration'],
    // ambiguous: two different kinds match, so no label
    ['Which theories explain the impact of social media on grades?', null],
    ['What evidence disagrees that sleep affects exam scores?', null],
    // generic wh-question with no clear kind
    ['What factors matter for student retention at university?', null],
    ['How do students use ChatGPT in their coursework?', null],
    // normative: not a clear kind, so no label
    ['Should universities ban generative AI in student assessment?', null],
    // very short / empty
    ['AI', null],
    ['impact of AI', null],
    ['', null],
    // not English: must not be matched by English-looking stems ("impacto", "teoria")
    ['¿Cuál es el impacto de la tecnología en el rendimiento académico?', null],
    ['技术对学生成绩有什么影响？', null],
    ['Quelle est la théorie qui explique l’adoption des technologies ?', null],
  ]
  it.each(cases)('%s → %s', (q, label) => expect(detectIntent(q)).toBe(label))

  it('prints the table (for the verification report)', () => {
    console.log(cases.map(([q, l]) => `${(l ?? '(no label)').padEnd(27)} ${q}`).join(String.fromCharCode(10)))
  })

  it('still picks a mode to run with when it shows no label, and says what it guessed', () => {
    expect(guessIntent('Should universities ban generative AI in student assessment?')).toEqual({ label: null, mode: 'EvidenceForClaim' })
    expect(guessIntent('Which theories explain the impact of social media on grades?').mode).toBe('TheoreticalFramework')
    expect(guessIntent('AI')).toEqual({ label: null, mode: 'TopicExploration' })
  })
  it('only ever returns a mode the server knows', () => {
    const known = new Set(DEEP_RESEARCH_MODES.map(m => m.value))
    for (const [q] of cases) { const g = guessIntent(q); expect(known.has(g.mode)).toBe(true); if (g.label) expect(known.has(g.label)).toBe(true) }
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

describe('normative rewrite keeps the student’s topic, population and region', () => {
  it.each([
    'Should universities in South Africa ban generative AI in student assessment?',
    'Should first-year nursing students in Kenya be allowed to use ChatGPT for care plans?',
    'Is it right to use AI detectors on Zulu-language essays in KwaZulu-Natal?',
    'Is it ethical for rural schools in Uganda to track pupils online?',
    'Ought small businesses in Lagos to adopt mobile payments?',
  ])('%s', q => {
    const out = rewriteNormative(q)
    // every content word of the original (other than the verdict frame) is still there
    const frame = /^(should|ought|must|is|it|right|wrong|ethical|ok|okay|to|for)$/i
    for (const w of q.replace(/[?.,]/g, '').split(/\s+/).filter(w => !frame.test(w))) expect(out.toLowerCase()).toContain(w.toLowerCase())
    expect(isNormativeQuestion(out)).toBe(false)
    expect(isQuestionValid(out)).toBe(true)
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
