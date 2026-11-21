import type { ProposalIdeaCheckResult } from '../api/research'
import type { AcademicLevel } from '../types/research'

/** The server refuses shorter ideas, so the link stays disabled below this. */
export const MIN_IDEA_LENGTH = 15

const LEVEL_WORDS: Record<AcademicLevel, string> = { UNDERGRADUATE: 'an undergraduate', MASTERS: 'a Masters', PHD: 'a PhD' }

export function canCheckIdea(topic: string): boolean {
  return topic.trim().length >= MIN_IDEA_LENGTH
}

/** One modest line per verdict. The verdict is said in words (and an icon), never by colour alone. Null when there is nothing to show. */
export function ideaHeadline(result: ProposalIdeaCheckResult | null, level: AcademicLevel): string | null {
  if (!result?.available) return null
  switch (result.verdict) {
    case 'ready': return 'This looks ready to start.'
    case 'too_broad': return `This may be too broad for ${LEVEL_WORDS[level]} study.`
    case 'too_narrow': return `This may be too narrow for ${LEVEL_WORDS[level]} study.`
    case 'unclear': return 'It is not yet clear what you want to study.'
    case 'not_researchable': return 'This may be hard to study as written.'
    default: return null
  }
}

export function ideaEvidenceNote(result: ProposalIdeaCheckResult | null): string | null {
  return result?.available && result.evidenceHint?.level === 'few'
    ? 'Few published studies found on this. The proposal may rely on related work.'
    : null
}
