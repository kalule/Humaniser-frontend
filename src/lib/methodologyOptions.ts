// Data-collection choices offered when a methodology is confirmed. The backend derives whether human participants are
// involved from this text (StudyDesignBusinessRules.InvolvementFrom) and picks the methodology-section framing from it,
// so the no-participant options say so in their label: the "(no participants)" marker is what the backend reads.
export const DATA_COLLECTION_OPTIONS = [
  'Questionnaire',
  'Interview',
  'Focus Group',
  'Observation',
  'Existing Records',
  'Software, system runs or simulation (no participants)',
  'Documents or published literature (no participants)',
  'Other',
] as const
