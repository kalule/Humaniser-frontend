import {
  Library, Globe, MessageSquare, BookMarked,
  FileText, Sparkles, RefreshCw, SpellCheck, Scissors,
  Shield, BookOpen,
  Brain, Mic, Layers,
  Search, PenLine, ShieldCheck, GraduationCap,
  ScrollText, BarChart2,
  type LucideIcon,
} from 'lucide-react'

export interface CatalogTool {
  icon: LucideIcon
  label: string
  desc: string
  longDesc: string
  to: string
  badge?: string
  iconBg: string
  iconColor: string
}

export interface CatalogCategory {
  id: string
  label: string
  blurb: string
  icon: LucideIcon
  headerColor: string
  headerBg: string
  tools: CatalogTool[]
}

export const TOOL_CATEGORIES: CatalogCategory[] = [
  {
    id: 'research',
    label: 'Research',
    blurb: 'Collect sources, chat with your papers, and build fully cited proposals.',
    icon: Search,
    headerColor: 'text-blue-700',
    headerBg: 'bg-blue-50',
    tools: [
      { icon: ScrollText, label: 'Proposal Studio', desc: 'AI literature review and research proposal writer', longDesc: 'Generate a fully cited research proposal or literature review from your topic — sources, structure, and citations included.', to: '/app/proposal-studio', badge: 'New', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700' },
      { icon: BarChart2, label: 'Data Analyst', desc: 'Upload data and get statistical analysis', longDesc: 'Upload a CSV, Excel, or academic data file (.dta, .rds, .omv) and get statistical analysis, charts, and plain-English findings.', to: '/app/analyst', badge: 'New', iconBg: 'bg-purple-100', iconColor: 'text-purple-700' },
      { icon: Library, label: 'My Library', desc: 'Organise papers, PDFs, and research documents in one place', longDesc: 'Keep every paper, PDF, and source you collect organised in one searchable library, ready to cite or chat with.', to: '/app/library', badge: 'New', iconBg: 'bg-blue-100', iconColor: 'text-blue-700' },
      { icon: Globe, label: 'Web Library', desc: 'Save and organise web sources and articles for your research', longDesc: 'Clip and save web articles and sources as you browse, then pull them straight into your proposals and essays.', to: '/app/web-library', badge: 'New', iconBg: 'bg-sky-100', iconColor: 'text-sky-700' },
      { icon: MessageSquare, label: 'Document Chat', desc: 'Ask questions about your PDFs and get instant answers', longDesc: 'Ask questions directly against a PDF or paper and get instant, cited answers instead of re-reading the whole document.', to: '/app/document-chat', badge: 'New', iconBg: 'bg-teal-100', iconColor: 'text-teal-700' },
      { icon: BookMarked, label: 'Citations', desc: 'Generate APA, Harvard, and MLA references automatically', longDesc: 'Generate accurate APA, Harvard, and MLA references automatically from a source URL, DOI, or upload.', to: '/app/citations', badge: 'New', iconBg: 'bg-orange-100', iconColor: 'text-orange-700' },
    ],
  },
  {
    id: 'write',
    label: 'Write & Edit',
    blurb: 'Draft, humanise, and polish your writing so it sounds like you.',
    icon: PenLine,
    headerColor: 'text-violet-700',
    headerBg: 'bg-violet-50',
    tools: [
      { icon: FileText, label: 'Doc Writer', desc: 'Create and edit academic documents and essays', longDesc: 'Write and edit academic documents and essays in a distraction-free editor built for long-form academic work.', to: '/app/editor/new', badge: 'New', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700' },
      { icon: Sparkles, label: 'AI Humaniser', desc: 'Rewrite AI text so it reads naturally human', longDesc: 'Rewrite AI-generated text so it reads naturally human — adjustable strength, tone, and full meaning preservation.', to: '/app/humaniser', iconBg: 'bg-violet-100', iconColor: 'text-violet-700' },
      { icon: RefreshCw, label: 'Paraphraser', desc: 'Rewrite sentences while keeping the original meaning', longDesc: 'Rewrite sentences and paragraphs while keeping your original meaning intact — useful for avoiding repetition or tightening prose.', to: '/app/paraphrase', iconBg: 'bg-purple-100', iconColor: 'text-purple-700' },
      { icon: SpellCheck, label: 'Grammar', desc: 'Fix grammar errors and improve writing clarity', longDesc: 'Catch grammar, spelling, and clarity issues before you submit — built for academic and professional writing.', to: '/app/grammar', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
      { icon: Scissors, label: 'Summariser', desc: 'Summarise long documents down to key points', longDesc: 'Condense long documents, articles, or papers down to the key points in seconds.', to: '/app/summarise', iconBg: 'bg-cyan-100', iconColor: 'text-cyan-700' },
    ],
  },
  {
    id: 'verify',
    label: 'Check & Verify',
    blurb: 'Confirm your writing is original and human before you submit it.',
    icon: ShieldCheck,
    headerColor: 'text-rose-700',
    headerBg: 'bg-rose-50',
    tools: [
      { icon: Shield, label: 'AI Detector', desc: 'Check if text was written by ChatGPT or other AI', longDesc: 'Check whether text was written by ChatGPT or another AI model, with a sentence-level human/AI probability score.', to: '/app/detector', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
      { icon: BookOpen, label: 'Source Check', desc: 'Academic plagiarism checker for essays and papers', longDesc: 'Scan essays and papers for copied or unoriginal content before you submit, with matched sources highlighted.', to: '/app/plagiarism', iconBg: 'bg-rose-100', iconColor: 'text-rose-700' },
    ],
  },
  {
    id: 'study',
    label: 'Study & Review',
    blurb: 'Turn source material into study aids and manage bigger projects.',
    icon: GraduationCap,
    headerColor: 'text-emerald-700',
    headerBg: 'bg-emerald-50',
    tools: [
      { icon: Brain, label: 'Flashcards', desc: 'Turn any text into study cards for exam revision', longDesc: 'Turn any text, chapter, or set of notes into study flashcards for exam revision in a couple of clicks.', to: '/app/flashcards', badge: 'New', iconBg: 'bg-green-100', iconColor: 'text-green-700' },
      { icon: Mic, label: 'Lecture Notes', desc: 'Transcribe and summarise recorded lectures', longDesc: 'Upload a recorded lecture and get a full transcript plus a structured, summarised set of notes.', to: '/app/lecture', badge: 'New', iconBg: 'bg-pink-100', iconColor: 'text-pink-700' },
      { icon: Layers, label: 'Workbench', desc: 'Advanced multi-tool research workspace', longDesc: 'Combine multiple tools in one advanced workspace for larger, multi-step research and writing projects.', to: '/app/workbench', badge: 'Beta', iconBg: 'bg-slate-100', iconColor: 'text-slate-700' },
    ],
  },
]

export const TOOL_COUNT = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0)
