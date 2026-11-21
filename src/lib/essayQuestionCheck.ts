import type { EssayQuestionAssessment, EssayQuestionCheckResult } from '../api/essayQuestionCheck'
import type { QuestionHints } from '../types/workbench'

/** Plain-language labels for the check's flags and gate reasons. Unknown codes are hidden rather than shown raw. */
export const FLAG_LABELS: Record<string, string> = {
  LOW_RESEARCHABILITY: 'Evidence for this may be hard to find',
  LOW_ANSWERABILITY: 'It is unclear what the essay should answer',
  UNINTELLIGIBLE: 'We could not understand this text',
  MULTIPLE_UNRELATED_QUESTIONS: 'Several unrelated questions in one',
  NOT_AN_ESSAY_QUESTION: 'This is a topic rather than a question',
  SENSITIVE_OR_HARMFUL: 'This is not a task we can help with',
}

export const DIMENSIONS: { key: keyof EssayQuestionAssessment; label: string }[] = [
  { key: 'specificityScore', label: 'Specificity' },
  { key: 'academicDepthScore', label: 'Academic depth' },
  { key: 'searchabilityScore', label: 'Searchability' },
  { key: 'researchabilityScore', label: 'Researchability' },
  { key: 'scopeFeasibilityScore', label: 'Scope' },
  { key: 'conceptualClarityScore', label: 'Clarity' },
  { key: 'answerabilityScore', label: 'Answerability' },
]

export function flagLabels(flags: string[]): string[] {
  return flags.map(f => FLAG_LABELS[f]).filter((l): l is string => Boolean(l))
}

/** The panel is shown only when the result has something to say; a ready question goes straight to writing. */
export function shouldShowResult(result: EssayQuestionCheckResult | null): boolean {
  return Boolean(result?.available && result.assessment && result.gate !== 'Proceed')
}

/**
 * A rewrite replaces the question. An angle on a set question keeps the question and adds the angle on its own line,
 * replacing any angle added before, so the set wording the lecturer gave is never changed.
 */
export function applySuggestion(topic: string, suggestion: string, mode: EssayQuestionAssessment['suggestedPromptMode']): string {
  if (mode === 'Rewrites') return suggestion
  const base = topic.replace(/\n+Angle: .*$/s, '').trimEnd()
  return `${base}\n\nAngle: ${suggestion}`
}

/** The check's concepts and search terms, passed on to essay planning as search leads. Undefined when there is nothing to pass. */
export function questionHintsFrom(assessment: EssayQuestionAssessment | null | undefined): QuestionHints | undefined {
  if (!assessment) return undefined
  const clean = (values: string[]) => [...new Set(values.map(v => v.trim()).filter(v => v.length > 0 && v.length <= 120))]
  const hints = { concepts: clean(assessment.centralConcepts).slice(0, 8), searchKeywords: clean(assessment.searchKeywords.map(k => k.term)).slice(0, 5) }
  return hints.concepts.length + hints.searchKeywords.length > 0 ? hints : undefined
}

export function bandTone(percent: number | null): 'good' | 'mid' | 'poor' {
  if (percent == null) return 'mid'
  if (percent >= 70) return 'good'
  if (percent >= 55) return 'mid'
  return 'poor'
}
