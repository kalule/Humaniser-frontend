import type { EssaySubType } from '../types/workbench'

export interface InferredEssayType { type: EssaySubType; cue: string }

/**
 * Suggests the essay type from the question's command words. Rule-based on purpose: it runs on every keystroke,
 * costs nothing, and the student can always change it. Order matters: a more specific task wins over a general one
 * ("critically evaluate" before "evaluate", "compare" before "discuss"). Returns null when no cue is found, so the
 * current choice is left alone.
 */
const RULES: { type: EssaySubType; pattern: RegExp }[] = [
  { type: 'Reflective', pattern: /\b(reflect(?:ion|ive)? on|reflect\b|your (?:own )?(?:experience|practice|placement|learning)|personal experience|what (?:have|did) you learn)/i },
  { type: 'LiteratureBased', pattern: /\b(literature review|review (?:of )?the (?:literature|research|evidence)|what does the (?:literature|research|evidence) (?:say|suggest|show)|synthesi[sz]e (?:the )?(?:literature|research|studies))/i },
  { type: 'CompareAndContrast', pattern: /\b(compare|contrast|similarities and differences|differences between|how (?:does|do) .{1,80}? differ|versus|vs\.?)\b/i },
  { type: 'CriticalEvaluation', pattern: /\b(critically (?:evaluate|assess|analy[sz]e|examine|appraise|discuss)|evaluate|assess|appraise|how effective|how successful|strengths and (?:weaknesses|limitations))\b/i },
  { type: 'Argumentative', pattern: /\b(to what extent|how far|do you agree|agree or disagree|should\b|argue|is it (?:justified|right|fair|true)|make (?:a|the) case)/i },
  { type: 'Discussion', pattern: /\b(discuss|debate|consider (?:the )?(?:arguments|views|perspectives))\b/i },
  { type: 'Expository', pattern: /\b(explain|describe|outline|analy[sz]e|examine|explore|what (?:are|were) the (?:causes|effects|factors|reasons)|why (?:did|do|does|is|are|was|were)|how (?:does|do|did|has|have))\b/i },
]

export function inferEssaySubType(question: string): InferredEssayType | null {
  const text = question.trim()
  if (text.length < 8) return null
  for (const rule of RULES) {
    const match = rule.pattern.exec(text)
    if (match) return { type: rule.type, cue: match[0].trim().toLowerCase() }
  }
  return null
}
