import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, BookOpen, FolderOpen, Files } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tooltip } from '../ui/Tooltip'
import { useWebLibraryStore } from '../../store/webLibraryStore'

const TRASH = '__trash__'

// The descriptions are what tell Collections and Evidence packages apart: collections are groups of
// your saved papers; evidence packages are verified evidence produced by a Deep Research session.
const TABS = [
  { key: 'find',        label: 'Find Papers',       icon: Search,     path: '/app/web-library/find',        description: 'Search scholarly databases' },
  { key: 'library',     label: 'Saved Sources',     icon: BookOpen,   path: '/app/web-library',             description: 'Every paper you have saved or imported' },
  { key: 'collections', label: 'Collections',       icon: FolderOpen, path: '/app/web-library/collections', description: 'Your own groups of saved papers, e.g. by topic' },
  { key: 'packages',    label: 'Evidence packages', icon: Files,      path: '/app/web-library/packages',    description: 'Verified evidence from a Deep Research session' },
] as const

export function WebLibraryTabBar({ active }: { active: 'find' | 'library' | 'collections' | 'packages' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const savedCount = useWebLibraryStore(s => s.documents.filter(d => d.folderId !== TRASH).length)
  const hasLoaded = useWebLibraryStore(s => s.hasLoaded)
  const collectionCount = useWebLibraryStore(s => s.collections.length)
  const collectionsLoaded = useWebLibraryStore(s => s.collectionsLoaded)
  const loadCollections = useWebLibraryStore(s => s.loadCollections)

  useEffect(() => { if (!collectionsLoaded) void loadCollections() }, [collectionsLoaded, loadCollections])

  // A count only once it's known; evidence packages live per Deep Research session, so there is
  // no cheap total to show for them.
  const counts: Partial<Record<(typeof TABS)[number]['key'], number>> = {
    ...(hasLoaded ? { library: savedCount } : {}),
    ...(collectionsLoaded ? { collections: collectionCount } : {}),
  }

  return (
    <nav aria-label="Research Library" className="shrink-0 border-b border-slate-200 bg-white px-5">
      <div className="flex flex-wrap items-end gap-1 -mb-px">
        {TABS.map(tab => {
          const isActive = active === tab.key
          const count = counts[tab.key]
          return (
            <Tooltip key={tab.key} label={tab.description} side="bottom">
              <button
                onClick={() => { if (location.pathname !== tab.path) navigate(tab.path, { state: { fromTabBar: true } }) }}
                aria-current={isActive ? 'page' : undefined}
                aria-describedby={`weblib-tab-desc-${tab.key}`}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded-t',
                  isActive
                    ? 'border-purple-accent text-purple-accent'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300',
                )}
              >
                <tab.icon size={14} aria-hidden className={isActive ? 'text-purple-accent' : 'text-slate-500'} />
                {tab.label}
                {count !== undefined && (
                  <span className={cn('rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums', isActive ? 'bg-purple-tint text-purple-text' : 'bg-slate-100 text-slate-600')}>
                    {count}
                  </span>
                )}
              </button>
              <span id={`weblib-tab-desc-${tab.key}`} className="sr-only">{tab.description}</span>
            </Tooltip>
          )
        })}
      </div>
    </nav>
  )
}
