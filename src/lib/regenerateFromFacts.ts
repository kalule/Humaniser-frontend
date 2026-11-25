import type { ProposalIssue } from '../types/research'

/**
 * PR 13b (2026-11-25): a contradiction is resolved, not narrated. For a conflict the checks found (two sections, or a section
 * and the study's design, disagree), Fix issues offers to regenerate the affected section from the stored facts and study
 * decisions; the old text is replaced, and the instruction forbids describing the conflict, an earlier version or a
 * reconciliation (the editing-text check also rejects such notes).
 */
const CONFLICT_TYPES = new Set([
  'fact_conflict',
  'section_rule_participant_language', 'section_rule_ethics_for_people', 'section_rule_corpus_definition_missing',
  'section_rule_allocation_mismatch', 'section_rule_definition_conflict', 'section_rule_duration_mismatch',
  'section_rule_collector_conflict', 'section_rule_frame_conflict', 'section_rule_power_mismatch', 'section_rule_precision_mismatch',
  'section_rule_mediator_moderator_conflict', 'section_rule_sem_sample_unsupported', 'section_rule_instrument_table_mismatch',
  'section_rule_template_residue', 'section_rule_data_protection_law',
])

const SECTION_CODE = /^\d+\.\d+[a-z]?$/

export function canRegenerateFromFacts(issue: ProposalIssue): boolean {
  if (issue.dismissed || !SECTION_CODE.test(issue.sectionKey)) return false
  return issue.type.startsWith('contradiction_') || CONFLICT_TYPES.has(issue.type)
}

export function regenerationInstructions(issue: ProposalIssue): string {
  return [
    `Correct this conflict found by the proposal checks: ${issue.message}`,
    'Write the section from the study’s stored facts and study decisions, so it agrees with the rest of the proposal.',
    'State the corrected design plainly as the plan. Do not mention the conflict, an earlier version, a revision, a correction or a reconciliation.',
  ].join(' ')
}
