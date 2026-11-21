import { describe, expect, it } from 'vitest'
import { inferEssaySubType } from './essayTypeInference'

describe('inferEssaySubType', () => {
  it.each([
    ['To what extent does intermittent fasting improve cognitive performance in adolescents?', 'Argumentative', 'to what extent'],
    ['Should universities replace examinations with coursework?', 'Argumentative', 'should'],
    ['Critically evaluate the use of AI in medical diagnosis.', 'CriticalEvaluation', 'critically evaluate'],
    ['Evaluate the effectiveness of sugar taxes.', 'CriticalEvaluation', 'evaluate'],
    ['Compare the healthcare systems of the UK and Canada.', 'CompareAndContrast', 'compare'],
    ['How do remote and office work differ in productivity?', 'CompareAndContrast', undefined],
    ['Discuss the ethics of gene editing.', 'Discussion', 'discuss'],
    ['Explain the causes of the 2008 financial crisis.', 'Expository', 'explain'],
    ['Reflect on your clinical placement and what you learned.', 'Reflective', undefined],
    ['Review the literature on mindfulness interventions for anxiety.', 'LiteratureBased', undefined],
  ])('%s -> %s', (question, type, cue) => {
    const result = inferEssaySubType(question)
    expect(result?.type).toBe(type)
    if (cue) expect(result?.cue).toBe(cue)
  })

  it('prefers the more specific task when several cues appear', () => {
    expect(inferEssaySubType('Critically discuss and compare two theories of motivation.')?.type).toBe('CompareAndContrast')
    expect(inferEssaySubType('Critically evaluate whether schools should ban phones.')?.type).toBe('CriticalEvaluation')
  })

  it('returns null when there is no cue, so the current choice is kept', () => {
    expect(inferEssaySubType('Climate change and coral reefs')).toBeNull()
    expect(inferEssaySubType('AI')).toBeNull()
  })
})
