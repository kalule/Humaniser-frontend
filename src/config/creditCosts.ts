/**
 * Flat per-action credit costs, mirroring HumaniseAI.Domain.Constants.CreditCosts on the backend.
 * Client-side values are for display/pre-flight disabling only — the server-side reservation is
 * the real gate, so a mismatch here only affects UI copy, not billing.
 */
export const CREDIT_COSTS = {
  dataAnalystQuery: 10,
  // Raised from 5 (2026-07 citation-count remediation) — mirrors
  // HumaniseAI.Domain.Constants.CreditCosts.ProposalSectionGeneration; see its comment for why.
  proposalSectionGeneration: 7,
  systematicReviewTitleAbstractScreening: 8,
  systematicReviewScreeningAgreementCheck: 8,
  systematicReviewFullTextScreening: 8,
  systematicReviewExtraction: 8,
  systematicReviewRiskOfBias: 8,
  systematicReviewRobinsI: 8,
  systematicReviewEvidenceGrading: 8,
  systematicReviewManuscriptGeneration: 10,
} as const
