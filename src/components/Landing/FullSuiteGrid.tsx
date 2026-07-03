import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Library, Globe, MessageSquare, BookMarked,
  FileText, Sparkles, RefreshCw, SpellCheck, Scissors,
  Shield, BookOpen,
  Brain, Mic, Layers,
  Search, PenLine, ShieldCheck, GraduationCap,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const CATEGORIES = [
  {
    id: 'research',
    label: 'Research',
    icon: Search,
    headerColor: 'text-blue-700',
    headerBg: 'bg-blue-50',
    tools: [
      { icon: Library, label: 'My Library', desc: 'Organise papers, PDFs, and research documents', to: '/app/library', badge: 'New', iconBg: 'bg-blue-100', iconColor: 'text-blue-700' },
      { icon: Globe, label: 'Web Library', desc: 'Save and organise web sources and articles', to: '/app/web-library', badge: 'New', iconBg: 'bg-sky-100', iconColor: 'text-sky-700' },
      { icon: MessageSquare, label: 'Document Chat', desc: 'Ask questions about your PDFs and papers', to: '/app/document-chat', badge: 'New', iconBg: 'bg-teal-100', iconColor: 'text-teal-700' },
      { icon: BookMarked, label: 'Citations', desc: 'Generate references in any citation style', to: '/app/citations', badge: 'New', iconBg: 'bg-orange-100', iconColor: 'text-orange-700' },
    ],
  },
  {
    id: 'write',
    label: 'Write & Edit',
    icon: PenLine,
    headerColor: 'text-violet-700',
    headerBg: 'bg-violet-50',
    tools: [
      { icon: FileText, label: 'Doc Writer', desc: 'Create and edit academic documents', to: '/app/editor/new', badge: 'New', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700' },
      { icon: Sparkles, label: 'AI Humaniser', desc: 'Make AI text sound naturally human', to: '/app/humaniser', iconBg: 'bg-violet-100', iconColor: 'text-violet-700' },
      { icon: RefreshCw, label: 'Paraphraser', desc: 'Rewrite while preserving meaning', to: '/app/paraphrase', iconBg: 'bg-purple-100', iconColor: 'text-purple-700' },
      { icon: SpellCheck, label: 'Grammar', desc: 'Fix errors and improve clarity', to: '/app/grammar', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
      { icon: Scissors, label: 'Summariser', desc: 'Condense long text to key points', to: '/app/summarise', iconBg: 'bg-cyan-100', iconColor: 'text-cyan-700' },
    ],
  },
  {
    id: 'verify',
    label: 'Check & Verify',
    icon: ShieldCheck,
    headerColor: 'text-rose-700',
    headerBg: 'bg-rose-50',
    tools: [
      { icon: Shield, label: 'AI Detector', desc: 'Sentence-level human score detection', to: '/app/detector', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
      { icon: BookOpen, label: 'Source Check', desc: 'Detect copied or plagiarised content', to: '/app/plagiarism', iconBg: 'bg-rose-100', iconColor: 'text-rose-700' },
    ],
  },
  {
    id: 'study',
    label: 'Study & Review',
    icon: GraduationCap,
    headerColor: 'text-emerald-700',
    headerBg: 'bg-emerald-50',
    tools: [
      { icon: Brain, label: 'Flashcards', desc: 'Create study cards from any text', to: '/app/flashcards', badge: 'New', iconBg: 'bg-green-100', iconColor: 'text-green-700' },
      { icon: Mic, label: 'Lecture Notes', desc: 'Transcribe and summarise lectures', to: '/app/lecture', badge: 'New', iconBg: 'bg-pink-100', iconColor: 'text-pink-700' },
      { icon: Layers, label: 'Workbench', desc: 'Advanced multi-tool workspace', to: '/app/workbench', badge: 'Beta', iconBg: 'bg-slate-100', iconColor: 'text-slate-700' },
    ],
  },
]

export function FullSuiteGrid() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="py-24 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-[#ede9fe] border border-violet-200 text-[#5b21b6] text-xs font-semibold mb-4">
            Full Platform Suite
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a18] mb-4">
            Every tool your research needs
          </h2>
          <p className="text-[#555555] text-base max-w-xl mx-auto">
            14 tools built around how researchers actually work — from source collection to final submission.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {CATEGORIES.map((cat) => (
            <motion.div
              key={cat.id}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.4 }}
              className="border border-[#e0e0da] rounded-2xl overflow-hidden bg-white"
            >
              {/* Category header */}
              <div className={cn('flex items-center gap-2 px-5 py-3 border-b border-[#e0e0da]', cat.headerBg)}>
                <cat.icon size={14} className={cat.headerColor} />
                <span className={cn('text-sm font-semibold', cat.headerColor)}>{cat.label}</span>
                <span className="ml-auto text-xs text-[#888888]">{cat.tools.length} tools</span>
              </div>

              {/* Tools */}
              <div className="divide-y divide-[#e0e0da]">
                {cat.tools.map((tool, ti) => (
                  <Link
                    key={tool.label}
                    to={tool.to}
                    className={cn(
                      'flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors group',
                      ti % 2 === 0 && cat.tools.length > 2 ? '' : '',
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tool.iconBg)}>
                      <tool.icon size={15} className={tool.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-medium text-[#1a1a18] group-hover:text-[#7c3aed] transition-colors">
                          {tool.label}
                        </span>
                        {'badge' in tool && tool.badge && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#ede9fe] text-[#5b21b6] text-[10px] font-semibold">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#888888] leading-tight">{tool.desc}</p>
                    </div>
                    <span className="text-[#d1d5db] group-hover:text-[#7c3aed] transition-colors shrink-0 mt-1">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
