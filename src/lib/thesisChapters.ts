import type { ThesisChapterKind } from '../types/workbench'

export const THESIS_CHAPTERS: { value: ThesisChapterKind; label: string; description: string }[] = [
  { value: 'Introduction',     label: 'Introduction',      description: 'Background, problem, gap, aims and research questions' },
  { value: 'LiteratureReview', label: 'Literature review', description: 'Themed, source-grounded review ending in the gaps your study addresses' },
  { value: 'Methodology',      label: 'Methodology',       description: 'Design, sampling, data collection, analysis, validity and ethics' },
  { value: 'Results',          label: 'Results',           description: 'Needs verified analysis output; blocked otherwise so nothing is invented' },
  { value: 'Discussion',       label: 'Discussion',        description: 'Interprets verified findings against the literature' },
  { value: 'Conclusion',       label: 'Conclusion',        description: 'Contribution, implications, limitations and future research' },
]
