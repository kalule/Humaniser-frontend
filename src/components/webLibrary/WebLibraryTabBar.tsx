import { useNavigate, useLocation } from 'react-router-dom'
import { Search, BookOpen, FolderOpen, Files } from 'lucide-react'
import { cn } from '../../lib/utils'

const TABS = [
  { key: 'find',        label: 'Find Papers',  icon: Search,     path: '/app/web-library/find' },
  { key: 'library',     label: 'My Library',   icon: BookOpen,   path: '/app/web-library' },
  { key: 'collections', label: 'Collections',  icon: FolderOpen, path: '/app/web-library/collections' },
  { key: 'packages', label: 'Evidence packages', icon: Files, path: '/app/web-library/packages' },
] as const

export function WebLibraryTabBar({ active }: { active: 'find' | 'library' | 'collections' | 'packages' }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-11 shrink-0 border-b border-slate-100 flex flex-wrap items-center px-5 gap-1 bg-white">
      {TABS.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => { if (location.pathname !== tab.path) navigate(tab.path, { state: { fromTabBar: true } }) }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
              isActive
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
            )}
          >
            <tab.icon size={14} className={isActive ? 'text-slate-700' : 'text-slate-400'} />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
