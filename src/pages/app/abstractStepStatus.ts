export type AbstractPrerequisiteSection = {
  code: string
  status: string
}

const isApproved = (sections: readonly AbstractPrerequisiteSection[], code: string) =>
  sections.some(section => section.code === code && section.status === 'Approved')

/**
 * The Abstract is the only StepRail chapter with sibling approval prerequisites — mirrors
 * ResearchService's own document-type-forked gate (BuildThesisSectionPromptAsync). A Thesis/
 * Dissertation Abstract summarizes completed findings, so it waits on Conclusion (8.0) and
 * Recommendations (8.1). A Proposal-stage Abstract summarizes the INTENDED study instead — there
 * is no Conclusion yet to wait on — so it waits on Problem Statement (3.1), Justification (3.2),
 * General Objective (4.2), Specific Objectives (4.3), and Study Design (5.2) instead.
 */
export function isAbstractStepLocked(
  sections: readonly AbstractPrerequisiteSection[],
  documentType: string,
): boolean {
  if (documentType === 'Thesis' || documentType === 'Dissertation') {
    return !isApproved(sections, '8.0') || !isApproved(sections, '8.1')
  }
  return !['3.1', '3.2', '4.2', '4.3', '5.2'].every(code => isApproved(sections, code))
}
