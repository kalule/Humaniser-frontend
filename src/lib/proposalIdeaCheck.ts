import type { IdeaQualityKey, ProposalIdeaCheckResult } from '../api/research'

/** The server refuses shorter ideas, so the link stays disabled below this. */
export const MIN_IDEA_LENGTH = 15

export function canCheckIdea(topic: string): boolean {
  return topic.trim().length >= MIN_IDEA_LENGTH
}

/** One modest line per verdict. The verdict is said in words (and an icon), never by colour alone. Null when there is nothing to show. */
export function ideaHeadline(result: ProposalIdeaCheckResult | null): string | null {
  if (!result?.available) return null
  switch (result.verdict) {
    case 'proceed': return 'This topic looks ready to start.'
    case 'proceed_with_changes': return 'This topic is workable with a few changes.'
    case 'rework': return 'This topic needs reworking before you start.'
    default: return null
  }
}

export const QUALITY_LABELS: Record<IdeaQualityKey, string> = {
  researchable: 'Researchable',
  specific: 'Specific',
  causal_wording: 'Wording',
  novelty: 'Novelty',
  level_fit: 'Level fit',
}

/** Scores in words so the meaning never depends on colour. */
export function scoreWord(score: number): string {
  return score >= 2 ? 'Good' : score === 1 ? 'Needs work' : 'Problem'
}

export const CLAIM_LABELS: Record<string, string> = {
  descriptive: 'can describe what is happening',
  exploratory: 'can explore how and why',
  association: 'can show associations',
  causal: 'can support causal claims',
}
