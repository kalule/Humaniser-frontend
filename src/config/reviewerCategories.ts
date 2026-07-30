import type { ReviewType } from '../types/reviewer'

// Fixed categorical hue order (never cycled per-instance, only assigned positionally
// per review) — validated for CVD-safe adjacent contrast. A review has at most 9
// categories (Proposal) so 8 slots + a wraparound covers every review type.
export const CATEGORY_COLORS = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
  '#e87ba4', // magenta
  '#eb6834', // orange
]

export function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
}

// One-line descriptions shown under each category name in the left rail — flat map
// since category names don't collide across review types.
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  // Proposal
  'Proposal Overview':      'Approval readiness and committee risks',
  'Methodology Feasibility': 'Design, sampling, instruments, data collection, and feasibility',
  'Analysis Plan':          'Planned quantitative, qualitative, or mixed-methods analysis',
  'Literature Foundation':  'Current sources, gap support, and framework grounding',
  'Alignment Logic':        'Title, problem, aim, objectives, questions, and methods alignment',
  'Ethics & Permissions':   'Consent, risk, privacy, site approval, and vulnerable groups',
  'Protocol Readiness':     'Can another researcher execute the proposed protocol?',
  'Contribution & Gap':     'Originality, significance, and research gap strength',
  'Writing & Structure':    'Proposal clarity, academic tone, and supervisor readability',

  // Thesis
  'Chapter Coherence & Flow':    'Logical progression and consistency across chapters',
  'Methodology Rigor':           'Execution fidelity versus the original protocol',
  'Findings & Analysis Depth':   'Statistical depth and honesty of interpretation',
  'Literature Integration':      'Prior work woven into discussion, not just summarized',
  'Contribution & Originality':  'Clarity and defensibility of the original contribution',
  'Writing & Academic Style':    'Tense consistency, academic register, and referencing',

  // Manuscript
  'Abstract & Framing':              'Accuracy and significance framing of the abstract',
  'Methods Transparency':            'Replicability from the methods section alone',
  'Results Presentation':            'Clarity and completeness without over-interpretation',
  'Discussion & Interpretation':     'Honest limitations and positioning versus prior work',
  'Journal Fit & Novelty':           'Contribution novelty and fit for a peer-reviewed journal',
  'Formatting & Citation Compliance': 'Reference and citation formatting consistency',

  // Literature Review
  'Search Strategy & Coverage': 'Comprehensiveness of the literature search',
  'Synthesis Quality':          'Cross-source synthesis into themes, not a study list',
  'Critical Analysis':          'Critical evaluation versus mere summarizing',
  'Thematic Organization':      'Structure organized by theme, not by source',
  'Gap Identification':         'Clarity of the knowledge gap motivating further research',
}

export const OVERVIEW_DESCRIPTION: Record<ReviewType, string> = {
  Proposal:         'Approval readiness and committee risks',
  Thesis:           'Defense readiness and examiner risks',
  Manuscript:       'Submission readiness and editorial risks',
  LiteratureReview: 'Publication readiness and reviewer risks',
}

export const OVERVIEW_LABEL: Record<ReviewType, string> = {
  Proposal:         'Proposal Overview',
  Thesis:           'Thesis Overview',
  Manuscript:       'Manuscript Overview',
  LiteratureReview: 'Literature Review Overview',
}

export const READINESS_LABEL: Record<ReviewType, string> = {
  Proposal:         'Proposal Approval Readiness',
  Thesis:           'Thesis Defense Readiness',
  Manuscript:       'Manuscript Publication Readiness',
  LiteratureReview: 'Review Quality Readiness',
}

export const CRITERIA_LABEL: Record<ReviewType, string> = {
  Proposal:         'Proposal Criteria',
  Thesis:           'Thesis Criteria',
  Manuscript:       'Manuscript Criteria',
  LiteratureReview: 'Review Criteria',
}

// A category name matching this is treated as the review's own holistic-overview
// entry (if the model produces one) — excluded from the left rail's itemized list
// since the pinned "Overview" tab already covers it via overviewNarrative, and
// excluded from color assignment so the 8-hue palette is never stretched thin.
export function isOverviewCategory(name: string): boolean {
  return /overview/i.test(name)
}
