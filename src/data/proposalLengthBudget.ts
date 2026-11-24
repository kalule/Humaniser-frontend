/**
 * The fixed length of a proposal: sections 1.0-6.3 together are at most PROPOSAL_WORD_LIMIT words. Students do not
 * pick a length per section. The backend enforces the same table (HumaniseAI.Infrastructure/Services/
 * ProposalLengthBudget.cs) whatever length a client sends; this copy is for display only, so keep the two in step.
 * The Abstract (0.0) sits outside the budget. 4.4 Hypotheses is counted, so a proposal without it ends under the cap.
 */
export const PROPOSAL_WORD_LIMIT = 10_000

export const PROPOSAL_SECTION_WORD_LIMITS: Readonly<Record<string, number>> = {
  '1.0': 700, '1.2': 600, '2.0': 1400,
  '3.1': 400, '3.2': 400, '3.3': 500,
  '4.1': 200, '4.2': 100, '4.3': 200, '4.4': 150,
  '5.1': 300, '5.2': 350, '5.3': 300, '5.4': 250, '5.5': 350, '5.6': 350,
  '5.7': 350, '5.7a': 550, '5.8': 400, '5.9': 300, '5.10': 300, '5.11': 400, '5.12': 300,
  '6.1': 300, '6.2': 300, '6.3': 250,
}

/** Fallback for a code outside the table: an even share of the cap over the 25 core sections. */
const FALLBACK_SECTION_WORDS = 400

export function sectionWordLimit(code: string | null | undefined): number {
  return (code && PROPOSAL_SECTION_WORD_LIMITS[code]) || FALLBACK_SECTION_WORDS
}
