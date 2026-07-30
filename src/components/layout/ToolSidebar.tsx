import { useLocation, Link } from 'react-router-dom'
import {
  Library, Globe, FileText, GraduationCap, Sparkles, Shield, RefreshCw,
  SpellCheck, BookOpen, Scissors, BarChart2, MessageSquare, BookMarked,
  Brain, Mic, Settings,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

export const TOOL_NAV: { label: string; icon: React.ElementType; link: string }[] = [
  { label: 'My Library',     icon: Library,       link: '/app/library' },
  { label: 'Web Library',    icon: Globe,         link: '/app/web-library' },
  { label: 'Doc Writer',     icon: FileText,      link: '/app/editor/new' },
  { label: 'Research Agent', icon: GraduationCap, link: '/app/research-agent/new' },
  { label: 'Rewrite',     icon: Sparkles,      link: '/app/humaniser' },
  { label: 'AI Detector',    icon: Shield,        link: '/app/detector' },
  { label: 'Paraphraser',    icon: RefreshCw,     link: '/app/paraphrase' },
  { label: 'Grammar',        icon: SpellCheck,    link: '/app/grammar' },
  { label: 'Source Check',   icon: BookOpen,      link: '/app/plagiarism' },
  { label: 'Summariser',     icon: Scissors,      link: '/app/summarise' },
  { label: 'Data Analyst',   icon: BarChart2,     link: '/app/analyst' },
  { label: 'Document Chat',  icon: MessageSquare, link: '/app/document-chat' },
  { label: 'Citations',      icon: BookMarked,    link: '/app/citations' },
  { label: 'Flashcards',     icon: Brain,         link: '/app/flashcards' },
  { label: 'Lecture Notes',  icon: Mic,           link: '/app/lecture' },
]

export function ToolSidebar() {
  const location = useLocation()
  const { user } = useAuthStore()
  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U')

  const isToolActive = (link: string) =>
    link === '/app/research-agent/new'
      ? location.pathname.includes('/research-agent/')
      : location.pathname === link

  return (
    <aside
      className="shrink-0 flex flex-col items-center overflow-hidden"
      style={{ width: 52, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}
    >
      {/* Logo mark */}
      <div className="w-full flex items-center justify-center py-3 shrink-0">
        <div
          className="flex items-center justify-center text-white font-semibold rounded-lg"
          style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            fontSize: 13,
          }}
        >
          H
        </div>
      </div>

      {/* Hairline divider */}
      <div className="shrink-0 mx-auto" style={{ width: 24, height: 0.5, background: '#e2e8f0' }} />

      {/* Tool icons */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-y-auto w-full px-2">
        {TOOL_NAV.map(tool => {
          const active = isToolActive(tool.link)
          return (
            <Link
              key={tool.label}
              to={tool.link}
              aria-label={tool.label}
              title={tool.label}
              className={cn(
                'flex items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-[#ede9fe] text-[#7c3aed]'
                  : 'text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]',
              )}
              style={{ width: 36, height: 36 }}
            >
              <tool.icon size={17} />
            </Link>
          )
        })}
      </div>

      {/* Settings + Avatar */}
      <div className="shrink-0 flex flex-col items-center gap-2 pb-3 pt-1">
        <Link
          to="/app/account"
          aria-label="Settings"
          title="Settings"
          className="flex items-center justify-center rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569] transition-colors"
          style={{ width: 36, height: 36 }}
        >
          <Settings size={17} />
        </Link>
        <Link
          to="/app/account"
          aria-label="Account"
          title="Account"
          className="flex items-center justify-center rounded-full text-white font-semibold"
          style={{ width: 32, height: 32, background: '#7c3aed', fontSize: 12 }}
        >
          {userInitials}
        </Link>
      </div>
    </aside>
  )
}
