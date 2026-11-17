import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Loader2, Bookmark, BookMarked } from 'lucide-react'
import { cautionText } from '../../lib/paperSearchLabels'
import { activeFilterLabels, emptyStateChips, withoutFilter } from '../../lib/findPapersChips'
import { cn } from '../../lib/utils'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { PaperSearchResultCard } from '../../components/webLibrary/PaperSearchResultCard'
import { SaveToLibraryModal } from '../../components/webLibrary/SaveToLibraryModal'
import { SearchFiltersPopover } from '../../components/webLibrary/SearchFiltersPopover'
import { Skeleton } from '../../components/ui/Skeleton'
import type { PaperSearchResult } from '../../types/webLibrary'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PaperDetailsDrawer } from '../../components/webLibrary/PaperDetailsDrawer'
import type { PaperDetails } from '../../types/researchLibrary'

const RECENT_SEARCHES_KEY = 'research_library_recent_searches'
const MAX_RECENT = 5

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

// One width for the search bar, filter chips, results and empty state, so they line up under the tabs.
const COLUMN = 'w-full max-w-5xl'

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[12.5px] text-slate-700 bg-white hover:bg-purple-tint/50 hover:border-purple-accent/40 border border-slate-200 rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
    >
      {label}
    </button>
  )
}

export default function FindPapersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const {
    searchQuery, searchResults, isSearching, searchError, searchPapers, clearSearch,
    searchTotal, isLoadingMore, loadMoreResults, searchFilters, setSearchFilters,
  } = useWebLibraryStore()
  const documents = useWebLibraryStore(s => s.documents)
  const [input, setInput] = useState(searchQuery)
  const [saveModalFor, setSaveModalFor] = useState<PaperSearchResult | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches())
  const ranInitialQuery = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    inputRef.current?.focus()
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
  // title — over whatever's currently loaded in My Library.
  const libraryKeys = useMemo(() => ({
    dois: new Set(documents.map(d => d.doi).filter((d): d is string => !!d)),
    titles: new Set(documents.map(d => normaliseTitle(d.title))),
  }), [documents])

  const isDuplicate = (result: PaperSearchResult) =>
    (result.doi != null && libraryKeys.dois.has(result.doi)) || libraryKeys.titles.has(normaliseTitle(result.title))

  const openPaperId = params.get('paper')
  // The drawer can also open from a shared ?paper= link with no search loaded; then there is no
  // result to save from, so it shows details only.
  const openResult = openPaperId ? searchResults.find(r => r.canonicalId === openPaperId) ?? null : null
  const closeDetails = () => { const next = new URLSearchParams(params); next.delete('paper'); setParams(next, { replace: true }) }

  const chips = emptyStateChips(recentSearches)
  const filterChips = activeFilterLabels(searchFilters)
  const canSearch = input.trim().length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <WebLibraryTabBar active="find" />

      <div className="border-b border-slate-100 px-5 py-4 shrink-0">
        <form
          role="search"
          onSubmit={e => { e.preventDefault(); handleSubmit() }}
          className={cn(COLUMN, 'flex flex-wrap sm:flex-nowrap items-center gap-2')}
        >
          <div className="relative flex-1 min-w-[14rem]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              aria-label="Search scholarly literature"
              // Not "author or DOI": the server keeps only results whose title or abstract
              // contain the query words, so those searches return nothing.
              placeholder="Search by topic, title or keywords"
              className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 text-[14px] text-slate-800 placeholder-slate-500 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 transition-colors"
            />
            {input && (
              <button type="button" onClick={handleClear} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <SearchFiltersPopover value={searchFilters} onApply={setSearchFilters} />
          <button
            type="submit"
            disabled={!canSearch}
            aria-busy={isSearching}
            title={canSearch ? undefined : 'Type something to search'}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium text-white bg-purple-accent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 focus-visible:ring-offset-2',
              canSearch ? 'hover:bg-purple-deep' : 'opacity-50 cursor-not-allowed',
            )}
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </form>

        {filterChips.length > 0 && (
          <div className={cn(COLUMN, 'mt-2.5 flex flex-wrap items-center gap-1.5')}>
            {filterChips.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-purple-tint/60 px-2.5 py-1 text-[12px] text-purple-text">
                {c.label}
                <button onClick={() => setSearchFilters(withoutFilter(searchFilters, c.key))} aria-label={`Remove filter: ${c.label}`} className="rounded-full p-0.5 hover:bg-purple-tint">
                  <X size={11} />
                </button>
              </span>
            ))}
            <button onClick={() => setSearchFilters({})} className="ml-1 text-[12px] font-medium text-slate-600 hover:text-slate-900">Clear filters</button>
          </div>
        )}

        {searchQuery && !isSearching && !searchError && (
          <p className={cn(COLUMN, 'text-[12px] text-slate-500 mt-2')} aria-live="polite">
            {searchResults.length > 0
              ? `Showing ${searchResults.length} of ${Math.max(searchTotal, searchResults.length)} results for "${searchQuery}"`
              : `No results for "${searchQuery}"`}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isSearching && (
          <div className={cn(COLUMN, 'space-y-3')} aria-label="Loading results">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} variant="card" tone="light" />
            ))}
          </div>
        )}

        {!isSearching && searchError && (
          <div className={cn(COLUMN, 'py-12')} role="alert">
            <p className="text-slate-800 font-medium text-[14px]">Search failed</p>
            <p className="text-slate-600 text-[13px] mt-1">{searchError}</p>
            <button onClick={() => handleSubmit(searchQuery)} className="mt-3 text-[13px] font-medium text-purple-accent hover:text-purple-deep transition-colors">
              Try again
            </button>
          </div>
        )}

        {!isSearching && !searchError && !searchQuery && (
          <div className={cn(COLUMN, 'py-8')}>
            <h2 className="text-slate-900 font-semibold text-[15px]">Search scholarly literature</h2>
            <div className="mt-2 max-w-2xl space-y-1.5 text-[13px] leading-relaxed text-slate-600">
              <p>Results come from open scholarly databases such as OpenAlex, Semantic Scholar and PubMed. Each result shows which one it came from and whether it has an abstract or a PDF link.</p>
              <p>Save a paper to add it to Saved Sources. From there you can cite it in your documents, group it into collections, and add it to Proposal Studio or Thesis Studio projects.</p>
            </div>

            {chips.recent.length > 0 && (
              <section className="mt-6" aria-labelledby="recent-searches-heading">
                <div className="flex items-center gap-3 mb-2">
                  <h3 id="recent-searches-heading" className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Recent searches</h3>
                  <button
                    onClick={() => { try { localStorage.removeItem(RECENT_SEARCHES_KEY) } catch { /* ignore */ } setRecentSearches([]) }}
                    className="text-[12px] text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chips.recent.map(q => <Chip key={q} label={q} onClick={() => handleSubmit(q)} />)}
                </div>
              </section>
            )}

            {chips.examples.length > 0 && (
              <section className="mt-6" aria-labelledby="examples-heading">
                <h3 id="examples-heading" className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Try an example</h3>
                <div className="flex flex-wrap gap-2">
                  {chips.examples.map(q => <Chip key={q} label={q} onClick={() => handleSubmit(q)} />)}
                </div>
              </section>
            )}
          </div>
        )}

        {!isSearching && !searchError && searchQuery && searchResults.length === 0 && (
          <div className={cn(COLUMN, 'py-12')}>
            <p className="text-slate-800 font-medium text-[14px]">No papers found for "{searchQuery}"</p>
            <p className="text-slate-600 text-[13px] mt-1">
              {filterChips.length > 0 ? 'Your filters may be too narrow. ' : ''}Try broader keywords or a different phrasing.
            </p>
            {filterChips.length > 0 && (
              <button onClick={() => setSearchFilters({})} className="mt-3 text-[13px] font-medium text-purple-accent hover:text-purple-deep">Clear filters</button>
            )}
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <div className={COLUMN}>
            <div className="divide-y divide-slate-100">
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
            <div className="border-t border-slate-100 py-5 text-center">
              {searchResults.length < searchTotal ? (
                <button
                  onClick={() => void loadMoreResults()}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {isLoadingMore && <Loader2 size={14} className="animate-spin" />}
                  {isLoadingMore ? 'Loading…' : 'Load more results'}
                </button>
              ) : (
                <p className="text-[12px] text-slate-500">End of results. Try different keywords to find more.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <SaveToLibraryModal
        open={saveModalFor !== null}
        result={saveModalFor}
        onClose={() => setSaveModalFor(null)}
      />
      <PaperDetailsDrawer
        workId={openPaperId}
        onClose={closeDetails}
        onOpenPdf={(paper: PaperDetails) => navigate(`/app/web-library/papers/${paper.id}/pdf`)}
        caution={openResult ? cautionText(openResult.caution) : null}
        actions={openResult && (
          // Closes the drawer first: the save modal and the drawer would both claim Escape and focus.
          <button
            onClick={() => { closeDetails(); setSaveModalFor(openResult) }}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              openResult.isSaved || isDuplicate(openResult)
                ? 'bg-green-tint text-green-text hover:opacity-80'
                : 'border border-purple-accent text-purple-accent hover:bg-purple-tint',
            )}
          >
            {openResult.isSaved || isDuplicate(openResult) ? <><BookMarked size={15} />Saved · manage collections</> : <><Bookmark size={15} />Save to library</>}
          </button>
        )}
      />
    </div>
  )
}
