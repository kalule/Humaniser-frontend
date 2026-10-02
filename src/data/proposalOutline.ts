// Shared between ResearchAgentPage (the manual step-by-step wizard) and
// AutonomousProposalTools (autonomous one-click generation, used from
// Proposal Studio) — kept in its own module, separate from ResearchAgentPage's
// component code, so importing it doesn't pull that page's whole
// (multi-thousand-line) chunk into the autonomous flow's lazy-loaded bundle.

export const STEPS: {
  id: string
  label: string
  group: 'setup' | 'chapters' | 'output'
  type: 'wizard' | 'chapter' | 'output'
  sectionKey?: string
  description?: string
}[] = [
  { id: 'research-topic',   label: 'Research Topic',              group: 'setup',    type: 'wizard',  description: 'What is your research about?' },
  { id: 'research-title',   label: 'Research Title',              group: 'setup',    type: 'wizard',  description: 'Give your proposal a working title.' },
  { id: 'location',         label: 'Location',                    group: 'setup',    type: 'wizard',  description: 'Where is the study being conducted?' },
  { id: 'methodology-type', label: 'Methodology Type',            group: 'setup',    type: 'wizard',  description: 'Is this study qualitative, quantitative, or mixed methods?' },
  { id: 'literature',       label: 'Literature Gathering',        group: 'setup',    type: 'wizard',  description: 'Select documents or paste web references.' },
  { id: '1.0',            label: '1.0 Introduction',            group: 'chapters', type: 'chapter', sectionKey: '1.0' },
  { id: '1.2',            label: '1.2 Background',              group: 'chapters', type: 'chapter', sectionKey: '1.2' },
  { id: '2.0',            label: '2.0 Literature Review',       group: 'chapters', type: 'chapter', sectionKey: '2.0' },
  { id: '3.1',            label: '3.1 Problem Statement',       group: 'chapters', type: 'chapter', sectionKey: '3.1' },
  { id: '3.2',            label: '3.2 Justification',           group: 'chapters', type: 'chapter', sectionKey: '3.2' },
  { id: '3.3',            label: '3.3 Conceptual Framework',    group: 'chapters', type: 'chapter', sectionKey: '3.3' },
  { id: '4.1',            label: '4.1 Research Questions',      group: 'chapters', type: 'chapter', sectionKey: '4.1' },
  { id: '4.2',            label: '4.2 General Objective',       group: 'chapters', type: 'chapter', sectionKey: '4.2' },
  { id: '4.3',            label: '4.3 Specific Objectives',     group: 'chapters', type: 'chapter', sectionKey: '4.3' },
  { id: '4.4',            label: '4.4 Hypotheses',              group: 'chapters', type: 'chapter', sectionKey: '4.4' },
  { id: '5.1',            label: '5.1 Study Area',              group: 'chapters', type: 'chapter', sectionKey: '5.1' },
  { id: '5.2',            label: '5.2 Study Design',            group: 'chapters', type: 'chapter', sectionKey: '5.2' },
  { id: '5.3',            label: '5.3 Study Population',        group: 'chapters', type: 'chapter', sectionKey: '5.3' },
  { id: '5.4',            label: '5.4 Inclusion/Exclusion',     group: 'chapters', type: 'chapter', sectionKey: '5.4' },
  { id: '5.5',            label: '5.5 Sample Size',             group: 'chapters', type: 'chapter', sectionKey: '5.5' },
  { id: '5.6',            label: '5.6 Sampling Procedure',      group: 'chapters', type: 'chapter', sectionKey: '5.6' },
  { id: '5.7',            label: '5.7 Study Variables',         group: 'chapters', type: 'chapter', sectionKey: '5.7' },
  // Split out of 5.7 on 2026-09-05 — see ResearchService._proposalSectionDefs for why this is a
  // sub-number and not a renumbering of 5.8+ (the backend section prompts cross-reference each
  // other by number in their own guidance text). Must stay in sync with
  // AutonomousChapterCodes.Ordered.
  { id: '5.7a',           label: '5.7a Data Analysis Plan',     group: 'chapters', type: 'chapter', sectionKey: '5.7a' },
  { id: '5.8',            label: '5.8 Data Collection',         group: 'chapters', type: 'chapter', sectionKey: '5.8' },
  { id: '5.9',            label: '5.9 Quality Assurance',       group: 'chapters', type: 'chapter', sectionKey: '5.9' },
  { id: '5.10',           label: '5.10 Data Management',        group: 'chapters', type: 'chapter', sectionKey: '5.10' },
  { id: '5.11',           label: '5.11 Ethical Considerations', group: 'chapters', type: 'chapter', sectionKey: '5.11' },
  { id: '5.12',           label: '5.12 Study Limitations',      group: 'chapters', type: 'chapter', sectionKey: '5.12' },
  { id: '6.1',            label: '6.1 Timeline',                group: 'chapters', type: 'chapter', sectionKey: '6.1' },
  { id: '6.2',            label: '6.2 Budget',                  group: 'chapters', type: 'chapter', sectionKey: '6.2' },
  { id: '6.3',            label: '6.3 Dissemination',           group: 'chapters', type: 'chapter', sectionKey: '6.3' },
  { id: 'references',     label: 'References',                  group: 'output',   type: 'output' },
  { id: 'full-document',  label: 'Full Document',               group: 'output',   type: 'output' },
  { id: 'download',       label: 'Download',                    group: 'output',   type: 'output' },
]

// Display-only label override for chapters whose framing changes under a qualitative design
// (see ResearchPrompts.GetMethodologyGuidanceOverride's headings server-side). Deliberately a
// frontend-only relabel, not a rename of the canonical stored SectionTitle — changing the stored
// title would desync already-generated section headers and the bibliography/full-document
// compilation, which read SectionTitle verbatim.
export function getStepLabel(step: { id: string; label: string }, methodologyType?: string): string {
  if (methodologyType === 'Qualitative') {
    if (step.id === '5.7') return '5.7 Key Research Constructs'
    if (step.id === '5.9') return '5.9 Trustworthiness'
  }
  if (methodologyType === 'Mixed Methods' && step.id === '5.7') {
    return '5.7 Study Variables and Research Constructs'
  }
  return step.label
}

export const SECTION_PROMPTS: Record<string, { heading: string; prompt: string }> = {
  '1.0':  { heading: 'Introduction',          prompt: 'Write a compelling introduction that contextualises the study and outlines its importance within the field.' },
  '1.2':  { heading: 'Background',            prompt: 'Describe the historical and contextual background of the research problem, tracing its development and significance.' },
  '2.0':  { heading: 'Literature Review',     prompt: 'Synthesise existing research relevant to your topic. Identify key themes, debates, and gaps in the literature.' },
  '3.1':  { heading: 'Problem Statement',     prompt: 'Articulate the specific research problem your study addresses. Be precise about what gap or issue you are solving.' },
  '3.2':  { heading: 'Justification',         prompt: 'Justify why this research is necessary, timely, and valuable to the academic community and/or practitioners.' },
  '3.3':  { heading: 'Conceptual Framework',  prompt: 'Describe the theoretical or conceptual framework guiding the study, including key concepts and their relationships.' },
  '4.1':  { heading: 'Research Questions',    prompt: 'State the primary and secondary research questions that your study aims to answer.' },
  '4.2':  { heading: 'General Objective',     prompt: 'State the overarching goal of the study in one clear sentence.' },
  '4.3':  { heading: 'Specific Objectives',   prompt: 'List 3–5 measurable specific objectives that align with the research questions.' },
  '4.4':  { heading: 'Hypotheses',             prompt: 'State null and alternative hypotheses for each quantitative objective, including the variables and planned statistical test.' },
  '5.1':  { heading: 'Study Area',            prompt: 'Describe the geographic, institutional, or conceptual scope of the study area, including relevant characteristics.' },
  '5.2':  { heading: 'Study Design',          prompt: 'Specify the research design (e.g., cross-sectional, longitudinal, case study) and justify your choice.' },
  '5.3':  { heading: 'Study Population',      prompt: 'Define the target population, including key demographic characteristics and relevance to the study.' },
  '5.4':  { heading: 'Inclusion/Exclusion Criteria', prompt: 'List clear criteria for who or what will be included and excluded from the study, and justify each criterion.' },
  '5.5':  { heading: 'Sample Size',           prompt: 'Describe the sample size calculation method and the determined sample size with statistical justification.' },
  '5.6':  { heading: 'Sampling Procedure',    prompt: 'Describe the sampling technique (random, stratified, purposive, etc.) and the step-by-step procedure.' },
  '5.7':  { heading: 'Study Variables',       prompt: 'List and define the independent, dependent, and confounding variables, and state each one’s role. Describe measurement scales and how any composite score is built.' },
  '5.7a': { heading: 'Data Analysis Plan',    prompt: 'Map every research question to the exact statistical test that answers it, with assumptions, covariate entry, and the missing-data strategy.' },
  '5.8':  { heading: 'Data Collection',       prompt: 'Describe the instruments, tools, and methods used to collect data, including validation approaches.' },
  '5.9':  { heading: 'Quality Assurance',     prompt: 'Explain measures taken to ensure data quality including training, pre-testing, and supervision protocols.' },
  '5.10': { heading: 'Data Management',       prompt: 'Describe how data will be stored, coded, cleaned, and backed up. Address data security and access controls.' },
  '5.11': { heading: 'Ethical Considerations', prompt: 'Outline the ethical issues considered: informed consent, confidentiality, anonymity, IRB approval, etc.' },
  '5.12': { heading: 'Study Limitations',     prompt: 'Honestly discuss the limitations of the study design, sample, instruments, and potential biases.' },
  '6.1':  { heading: 'Timeline',              prompt: 'Present a Gantt-style timeline of activities from proposal approval through data collection, analysis, and write-up.' },
  '6.2':  { heading: 'Budget',                prompt: 'Provide a detailed budget breakdown covering personnel, materials, travel, data collection, and dissemination costs.' },
  '6.3':  { heading: 'Dissemination',         prompt: 'Describe how findings will be communicated to stakeholders, journals, conferences, and policymakers.' },
}

export const CHAPTER_STEPS = STEPS.filter(s => s.group === 'chapters')
