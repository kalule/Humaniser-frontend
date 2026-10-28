import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { PaperSearchResultCard } from '../../components/webLibrary/PaperSearchResultCard'
import { SaveToLibraryModal } from '../../components/webLibrary/SaveToLibraryModal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tooltip } from '../../components/ui/Tooltip'
import type { PaperSearchResult } from '../../types/webLibrary'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import type { PaperDetails } from '../../types/researchLibrary'

const RECENT_SEARCHES_KEY = 'research_library_recent_searches'
const MAX_RECENT = 5

// Illustrative starting points, not domain-tuned — swap for real popular
// queries once there's usage data (Research Library UX audit, 2026-10-03).
const EXAMPLE_SEARCHES = [
  'AI in healthcare',
  'Climate change adaptation',
  'Machine learning bias',
  'Mental health interventions',
]

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch { return [] }
}

function saveRecentSearch(query: string) {
  try {
    const existing = loadRecentSearches().filter(q => q.toLowerCase() !== query.toLowerCase())
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([query, ...existing].slice(0, MAX_RECENT)))
  } catch { /* storage unavailable — recent searches just won't persist */ }
}

// Best-effort only: normalises a title for a loose match against the
// currently loaded library (DOI match is the real identity check).
function normaliseTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export default function FindPapersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { searchQuery, searchResults, isSearching, searchError, searchPapers, clearSearch } = useWebLibraryStore()
  const documents = useWebLibraryStore(s => s.documents)
  const [input, setInput] = useState(searchQuery)
  const [saveModalFor, setSaveModalFor] = useState<PaperSearchResult | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches())
  const ranInitialQuery = useRef(false)

  const handleSubmit = (query?: string) => {
    const trimmed = (query ?? input).trim()
    if (!trimmed || isSearching) return
    setInput(trimmed)
    saveRecentSearch(trimmed)
    setRecentSearches(loadRecentSearches())
    void searchPapers(trimmed)
  }

  const handleClear = () => {
    setInput('')
    clearSearch()
  }

  // `?q=` prefill — additive, doesn't touch any other page (e.g. Proposal
  // Studio's own, separate "Find similar papers" modal is untouched).
  useEffect(() => {
    if (ranInitialQuery.current) return
    const q = params.get('q')
    if (!q) return
    ranInitialQuery.current = true
    setInput(q)
    handleSubmit(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Best-effort client-side duplicate check — DOI first, then a normalised
  // title — over whatever's currently loaded in My Library. The search
  // endpoint is paginated and this page never requests page 2, so this can
  // only see what's already loaded, same as the library itself.
  const libraryKeys = useMemo(() => ({
    dois: new Set(documents.map(d => d.doi).filter((d): d is string => !!d)),
    titles: new Set(documents.map(d => normaliseTitle(d.title))),
  }), [documents])

  const isDuplicate = (result: PaperSearchResult) =>
    (result.doi != null && libraryKeys.dois.has(result.doi)) || libraryKeys.titles.has(normaliseTitle(result.title))

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="find" />

      <div className="border-b border-slate-100 px-5 py-4 shrink-0">
        <div className="flex items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="Search scholarly literature — e.g. AI in healthcare"
              className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 text-[14px] text-slate-700 placeholder-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
            />
            {input && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <Tooltip label={input.trim() ? 'Search' : 'Type something to search'}>
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isSearching}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors',
                input.trim() && !isSearching
                  ? 'bg-purple-accent hover:bg-purple-deep text-white shadow-sm'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed',
              )}
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </Tooltip>
        </div>
        {searchQuery && !isSearching && (
          <p className="text-[12px] text-slate-400 mt-2">
            {searchResults.length > 0 ? `Results for "${searchQuery}"` : `No results for "${searchQuery}"`}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isSearching && (
          <div className="space-y-3 max-w-3xl">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} variant="card" tone="light" />
            ))}
          </div>
        )}

        {!isSearching && searchError && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="text-slate-700 font-medium text-[14px]">Search failed</p>
            <p className="text-slate-400 text-[13px] mt-1">{searchError}</p>
            <button onClick={() => handleSubmit(searchQuery)} className="mt-3 text-[13px] font-medium text-purple-accent hover:text-purple-deep transition-colors">
              Try again
            </button>
          </div>
        )}

        {!isSearching && !searchError && !searchQuery && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="text-slate-700 font-medium text-[14px]">Search millions of scholarly works</p>
            <p className="text-slate-400 text-[13px] mt-1">Build your research library by saving sources you want to use later.</p>

            <div className="mt-6 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Try an example</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_SEARCHES.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSubmit(q)}
                    className="text-[12px] text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div className="mt-6 text-left">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Recent searches</p>
                  <button
                    onClick={() => { try { localStorage.removeItem(RECENT_SEARCHES_KEY) } catch { /* ignore */ } setRecentSearches([]) }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {recentSearches.map(q => (
                    <button
                      key={q}
                      onClick={() => handleSubmit(q)}
                      className="text-[12px] text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isSearching && !searchError && searchQuery && searchResults.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16">
            <p className="text-slate-700 font-medium text-[14px]">No papers found for "{searchQuery}"</p>
            <p className="text-slate-400 text-[13px] mt-1">Try broader keywords or a different phrasing.</p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <div className="space-y-3 max-w-3xl">
            {searchResults.map(result => (
              <PaperSearchResultCard
                key={result.canonicalId}
                result={result}
                alreadyInLibrary={isDuplicate(result)}
                onSave={() => setSaveModalFor(result)}
                onDetails={() => { const next = new URLSearchParams(params); next.set('paper', result.canonicalId); setParams(next, { replace: true }) }}
              />
            ))}
          </div>
        )}
      </div>

      <SaveToLibraryModal
        open={saveModalFor !== null}
        result={saveModalFor}
        onClose={() => setSaveModalFor(null)}
      />
      <PaperDetailsDrawer
        workId={params.get('paper')}
        onClose={() => { const next = new URLSearchParams(params); next.delete('paper'); setParams(next, { replace: true }) }}
        onOpenPdf={(paper: PaperDetails) => navigate(`/app/web-library/papers/${paper.id}/pdf`)}
      />
    </div>
  )
}
