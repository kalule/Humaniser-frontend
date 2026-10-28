import { describe, expect, it } from 'vitest'
import {
  GAP_STAGES, GAP_TYPE_LABEL, VERIFICATION_HELP, VERIFICATION_LABEL, parseQueryLines, percent, stageIndex,
} from './gapFinderLabels'

describe('gap finder labels', () => {
  it('never claims that nothing exists or guarantees novelty', () => {
    const copy = [...Object.values(VERIFICATION_LABEL), ...Object.values(VERIFICATION_HELP), ...Object.values(GAP_TYPE_LABEL)].join(' ')
    expect(copy).not.toMatch(/no research exists|never been studied|guarantee|first study|novel/i)
    expect(VERIFICATION_HELP.no_clear_answer_found).toMatch(/not proof/i)
  })

  it('has a label for every verification status and gap type', () => {
    expect(Object.keys(VERIFICATION_LABEL).sort()).toEqual(
      ['narrowed', 'no_clear_answer_found', 'not_verified', 'partly_addressed', 'rejected'])
    expect(Object.keys(GAP_TYPE_LABEL).sort()).toEqual(
      ['conflicting', 'insufficient', 'unreliable_methods', 'wrong_question'])
  })

  it('orders the stages and clamps unknown ones to the first', () => {
    expect(GAP_STAGES.map(s => s.id)).toEqual(['scope', 'retrieve', 'screen', 'extract', 'candidates', 'verify', 'present'])
    expect(stageIndex('verify')).toBe(5)
    expect(stageIndex('nonsense' as never)).toBe(0)
  })

  it('formats shares as whole percentages of preprints, not as a confidence', () => {
    expect(percent(0.34)).toBe('34%')
    expect(percent(0)).toBe('0%')
  })

  it('parses edited queries: trims, drops blanks, short and duplicate lines, caps at four', () => {
    expect(parseQueryLines('  nurse burnout  \n\nab\nNurse Burnout\nsecond query here\nthird query here\nfourth query here\nfifth query here'))
      .toEqual(['nurse burnout', 'second query here', 'third query here', 'fourth query here'])
    expect(parseQueryLines('')).toEqual([])
  })
})

import { parseDois } from './gapFinderLabels'
import { isValidQuestion, questionFromDescription } from './GapQuestionEditor'

describe('corpus editing and question helpers', () => {
  it('parses pasted DOIs from links and prefixes, dedupes, ignores junk, caps at five', () => {
    expect(parseDois('https://doi.org/10.1016/j.x.2024.1, doi:10.1000/ABC.2; 10.1016/J.X.2024.1 not-a-doi\n10.5555/a 10.5555/b 10.5555/c 10.5555/d'))
      .toEqual(['10.1016/j.x.2024.1', '10.1000/ABC.2', '10.5555/a', '10.5555/b', '10.5555/c'])
    expect(parseDois('')).toEqual([])
  })

  it('reads the question back out of a topic description', () => {
    expect(questionFromDescription('Research question: How does X relate to Y?')).toBe('How does X relate to Y?')
    expect(questionFromDescription('plain')).toBe('plain')
  })

  it('bounds the research question to 10-400 characters', () => {
    expect(isValidQuestion('too short')).toBe(false)
    expect(isValidQuestion('How does X relate to Y?')).toBe(true)
    expect(isValidQuestion('a'.repeat(401))).toBe(false)
  })
})
