import { describe, expect, it } from 'vitest'
import { recommendMethodology } from './methodologyRecommendation'

describe('recommendMethodology', () => {
  it('suggests correlational quantitative research for a relationship title', () => {
    const result = recommendMethodology({ title: 'Usability Challenges and Their Relationship with Student Satisfaction in Learning Management Systems at Selected South African Universities' })
    expect(result).toMatchObject({ approach: 'Quantitative', design: 'Correlational', timeFrame: 'Unspecified' })
    expect(result.dataCollection).toContain('Questionnaire')
  })

  it('suggests qualitative research for experiences', () => {
    expect(recommendMethodology({ title: 'Students’ lived experiences of online learning' }).approach).toBe('Qualitative')
  })

  it('requires integration evidence for mixed methods', () => {
    expect(recommendMethodology({ title: 'A survey and interviews integrated to explain student retention' }).approach).toBe('Mixed Methods')
    expect(recommendMethodology({ title: 'Usability and satisfaction in universities' }).approach).not.toBe('Mixed Methods')
  })

  it('asks one clarification question for ambiguous intent, with clickable answer options', () => {
    const result = recommendMethodology({ title: 'Digital learning in South African universities' })
    expect(result.approach).toBe('Undetermined')
    expect(result.clarificationQuestion).toBeTruthy()
    expect(result.clarificationOptions?.length).toBeGreaterThan(0)
  })

  it('does not turn impact into an experiment', () => {
    const result = recommendMethodology({ title: 'The impact of mobile learning on achievement' })
    expect(result.approach).toBe('Undetermined')
    expect(result.design).toBeUndefined()
  })

  it('keeps design, collection, and analysis separate', () => {
    const result = recommendMethodology({ title: 'The relationship between usability and satisfaction using a questionnaire' })
    expect(result.design).toBe('Correlational')
    expect(result.dataCollection).toEqual(['Questionnaire'])
    expect(result.analysis).toContain('Regression')
  })
})
